import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext, getRecommendedDocuments } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';
import { buildAnalysisPrompt } from '@/lib/prompts/analysis-prompt';
import { postProcessAnalysis } from '@/lib/analysis/post-processor';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Use admin client to bypass RLS when looking up user
    let user = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle()
      .then(res => res.data);

    // If user doesn't exist in Supabase, create them (fallback for webhook issues)
    if (!user) {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || '';

        if (!userEmail) {
          console.error('No email found for Clerk user:', userId);
          return NextResponse.json({ error: 'User email not found' }, { status: 400 });
        }

        // Use admin client to bypass RLS when creating user
        const { data: newUser, error: createError } = await supabaseAdmin
          .from('users')
          .insert({
            clerk_user_id: userId,
            email: userEmail,
          })
          .select('id, email')
          .single();

        if (createError) {
          console.error('Error creating user in Supabase:', createError);
          return NextResponse.json({
            error: `Failed to create user record: ${createError.message}`
          }, { status: 500 });
        }

        if (!newUser) {
          console.error('User creation returned no data');
          return NextResponse.json({ error: 'Failed to create user record' }, { status: 500 });
        }

        user = newUser;
        console.log('Successfully created user:', newUser.id);
      } catch (err: any) {
        console.error('Exception creating user:', err);
        return NextResponse.json({
          error: `Failed to create user: ${err.message}`
        }, { status: 500 });
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);

    // Use admin client for usage tracking (bypass RLS)
    const { data: usage } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!usage) {
      // Use admin client for subscription lookup (bypass RLS)
      const { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const limits: Record<string, number> = {
        starter: 10,
        professional: 50,
        business: 200,
      };

      const planTier = subscription?.plan_tier || 'starter';
      const limit = limits[planTier] || 10;

      // Use admin client to create usage tracking (bypass RLS)
      const { error: usageError } = await supabaseAdmin.from('usage_tracking').insert({
        user_id: user.id,
        month: currentMonth,
        analyses_used: 0,
        analyses_limit: limit,
      });

      if (usageError) {
        console.error('Error creating usage tracking:', usageError);
      }
    }

    // Use admin client for usage lookup (bypass RLS)
    const { data: currentUsage } = await supabaseAdmin
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!currentUsage) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    // Check if user is an admin - admins have unlimited access
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const isAdmin = clerkUser?.publicMetadata?.role === 'admin';

    // Only enforce limits for non-admin users
    if (
      !isAdmin &&
      currentUsage.analyses_limit !== -1 &&
      currentUsage.analyses_used >= currentUsage.analyses_limit
    ) {
      return NextResponse.json(
        { error: 'Monthly analysis limit reached. Please upgrade your plan.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const existingSessionId = formData.get('sessionId') as string | null;
    const labelName = formData.get('labelName') as string | null;
    const forcedCategory = formData.get('forcedCategory') as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Handle session creation or use existing session
    let sessionId = existingSessionId;
    let session = null;

    if (!sessionId) {
      // Create a new session for this analysis
      const productHint = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
      const { data: newSession, error: sessionError } = await createSession(
        user.id,
        `Analysis: ${productHint}`,
        true // use admin
      );

      if (sessionError || !newSession) {
        console.error('Error creating session:', sessionError);
        // Don't fail the analysis if session creation fails
        // The analysis will work without a session (backward compatible)
      } else {
        session = newSession;
        sessionId = newSession.id;
        console.log('Created new session:', sessionId);
      }
    }

    console.log('📥 Processing image file...');
    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Detect if this is a PDF or image
    const isPdf = imageFile.type === 'application/pdf';
    let base64Data: string | undefined;
    let pdfTextContent: string | undefined;
    let mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'; // Default
    let contentType: 'image' | 'document' | 'text';

    if (isPdf) {
      // Hybrid PDF processing: text extraction first, CloudConvert fallback
      const pdfResult = await processPdfForAnalysis(buffer);

      if (pdfResult.type === 'text') {
        // Text extraction successful
        pdfTextContent = pdfResult.content as string;
        contentType = 'text';
        console.log(`✅ Using extracted text (${pdfTextContent.length} characters)`);
      } else {
        // CloudConvert converted PDF to image
        const imageBuffer = pdfResult.content as Buffer;
        base64Data = imageBuffer.toString('base64');
        mediaType = 'image/jpeg';
        contentType = 'document';
        console.log('✅ Using CloudConvert image conversion');
      }
    } else {
      console.log('🖼️ Preprocessing image...');
      // For images, preprocess to improve readability
      const processedBuffer = await preprocessImage(buffer);
      base64Data = processedBuffer.toString('base64');
      mediaType = 'image/jpeg';
      contentType = 'image';
      console.log('✅ Image preprocessed');
    }

    console.log('📚 Fetching regulatory documents...');
    let regulatoryDocuments;
    let ragInfo = null;
    let extractedTextForRag: string | undefined;

    // For images, do a quick text extraction to enable RAG lite filtering
    if (!pdfTextContent && base64Data) {
      try {
        console.log('🔍 Extracting key text from image for RAG lite...');
        const quickOcrResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Extract the key text from this label image. Focus on: panel type (Supplement Facts vs Nutrition Facts), product name, product type, and any prominent keywords. Keep it brief (max 500 characters).',
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mediaType};base64,${base64Data}`,
                    detail: 'low', // Use low detail for speed
                  },
                },
              ],
            },
          ],
          max_completion_tokens: 200,
          temperature: 0,
        });

        extractedTextForRag = quickOcrResponse.choices[0]?.message?.content || '';
        console.log(`✅ Extracted ${extractedTextForRag.length} characters for RAG lite`);
      } catch (ocrError) {
        console.warn('⚠️ Quick OCR failed, will use all documents:', ocrError);
      }
    }

    // Use RAG lite for both PDFs and images (if text extraction succeeded)
    const textForRag = pdfTextContent || extractedTextForRag;

    if (textForRag) {
      // RAG lite - filter by pre-classified category
      const { documents, preClassifiedCategory, documentCount, totalCount } =
        await getRecommendedDocuments(textForRag);
      regulatoryDocuments = documents;
      ragInfo = { preClassifiedCategory, documentCount, totalCount };
      console.log(`✅ RAG Lite: Loaded ${documentCount}/${totalCount} documents for ${preClassifiedCategory}`);
    } else {
      // Fallback - load all documents if text extraction failed
      regulatoryDocuments = await getActiveRegulatoryDocuments();
      console.log(`✅ Loaded all ${regulatoryDocuments.length} documents (fallback mode)`);
    }

    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    // Build analysis prompt using extracted function
    const analysisInstructions = buildAnalysisPrompt({ isPdf, forcedCategory });

    // Helper function to call OpenAI API with retry logic for rate limits
    const callOpenAIWithRetry = async (maxRetries = 3) => {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`🤖 Calling OpenAI GPT-5 mini (attempt ${attempt}/${maxRetries})...`);
        try {
          // Construct the message content based on content type
          let userMessage: any;

          if (pdfTextContent) {
            // Text-only mode (PDF with extractable text)
            userMessage = {
              role: 'user' as const,
              content:
                regulatoryContext +
                '\n\n' +
                analysisInstructions +
                '\n\n## Extracted PDF Text:\n\n' +
                pdfTextContent,
            };
          } else if (base64Data) {
            // Image mode (regular images or CloudConvert-converted PDFs)
            userMessage = {
              role: 'user' as const,
              content: [
                {
                  type: 'text' as const,
                  text: regulatoryContext + '\n\n' + analysisInstructions,
                },
                {
                  type: 'image_url' as const,
                  image_url: {
                    url: `data:${mediaType};base64,${base64Data}`,
                    detail: 'high' as const,
                  },
                },
              ],
            };
          } else {
            throw new Error('No content available for analysis');
          }

          return await openai.chat.completions.create({
            model: 'gpt-4o',
            max_completion_tokens: 8192,
            messages: [userMessage],
            response_format: { type: 'json_object' },
          });
        } catch (error: any) {
          // Check if it's a rate limit error
          if (error?.status === 429 || error?.error?.type === 'rate_limit_error') {
            console.log(`Rate limit hit, attempt ${attempt}/${maxRetries}`);

            if (attempt === maxRetries) {
              // On final attempt, throw a user-friendly error
              throw new Error('API rate limit reached. Please wait 60 seconds and try again. If this persists, you may need to upgrade your OpenAI API plan at https://platform.openai.com/settings');
            }

            // Exponential backoff: wait 5s, 10s, 20s
            const waitTime = 5000 * Math.pow(2, attempt - 1);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            continue;
          }

          // If not a rate limit error, throw immediately
          throw error;
        }
      }

      throw new Error('Failed to get response from API after retries');
    };

    // Call OpenAI API
    const completion = await callOpenAIWithRetry();

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('No text response from AI');
    }

    console.log('=== AI Response (first 500 chars) ===');
    console.log(responseText.substring(0, 500));
    console.log('=== End preview ===');

    // Parse JSON response
    // OpenAI's JSON mode should return clean JSON, but we'll add error handling
    let analysisData: any;
    try {
      analysisData = JSON.parse(responseText);
      console.log('✅ Successfully parsed analysis data');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      throw new Error('Failed to parse AI response');
    }

    // Run post-processing: GRAS, NDI, allergen checks, and status enforcement
    await postProcessAnalysis(analysisData);

    // Determine compliance status from the new analysis structure
    const complianceStatus = analysisData.overall_assessment?.primary_compliance_status || 'unknown';
    const dbComplianceStatus =
      complianceStatus === 'compliant' || complianceStatus === 'likely_compliant' ? 'compliant' :
      complianceStatus === 'potentially_non_compliant' ? 'minor_issues' :
      'major_violations';

    const { data: analysis, error: insertError} = await supabaseAdmin
      .from('analyses')
      .insert({
        user_id: user.id,
        image_url: base64Data
          ? `data:${mediaType};base64,${base64Data.substring(0, 100)}...`
          : `text/plain;preview,${pdfTextContent?.substring(0, 100) || ''}...`,
        image_name: imageFile.name,
        label_name: labelName || null,
        analysis_result: analysisData,
        compliance_status: dbComplianceStatus,
        issues_found: analysisData.recommendations?.filter((r: any) => r.priority === 'critical' || r.priority === 'high')?.length || 0,
        session_id: sessionId || null,
        product_category: analysisData.product_category || null,
        category_rationale: analysisData.category_rationale || null,
        category_confidence: analysisData.category_confidence || null,
        is_category_ambiguous: analysisData.category_ambiguity?.is_ambiguous || false,
        alternative_categories: analysisData.category_ambiguity?.alternative_categories || null,
        // user_selected_category, category_selection_reason, compared_categories remain NULL initially
        // These are set when user makes a selection in the Category Selector UI
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error saving analysis:', insertError);
      return NextResponse.json({ error: 'Failed to save analysis' }, { status: 500 });
    }

    const { error: usageUpdateError } = await supabase
      .from('usage_tracking')
      .update({ analyses_used: currentUsage.analyses_used + 1 })
      .eq('user_id', user.id)
      .eq('month', currentMonth);

    if (usageUpdateError) {
      console.error('Error updating usage:', usageUpdateError);
    }

    // Create iteration record if this is part of a session
    if (sessionId) {
      const { error: iterationError } = await addIteration(
        sessionId,
        'image_analysis',
        {
          image_name: imageFile.name,
          file_size: imageFile.size,
          media_type: mediaType,
        },
        analysisData,
        analysis.id,
        undefined,
        true // use admin
      );

      if (iterationError) {
        console.error('Error creating iteration:', iterationError);
        // Don't fail the analysis if iteration creation fails
      } else {
        console.log('Created iteration for session:', sessionId);
      }
    }

    try {
      const emailHtml = generateAnalysisResultEmail({
        productName: analysisData.product_name || 'Unknown Product',
        summary: analysisData.overall_assessment?.summary || 'Analysis completed successfully.',
        healthScore: 0, // No longer using health score
        complianceStatus: analysis.compliance_status,
        recommendations: analysisData.recommendations?.map((r: any) =>
          `[${r.priority.toUpperCase()}] ${r.recommendation} (${r.regulation})`
        ) || [],
        analyzedAt: analysis.created_at,
      });

      await sendEmail({
        to: user.email,
        subject: `Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    // Determine if category selector should be shown
    const showCategorySelector =
      analysisData.category_confidence !== 'high' ||
      analysisData.category_ambiguity?.is_ambiguous ||
      (analysisData.category_ambiguity?.label_conflicts &&
       analysisData.category_ambiguity.label_conflicts.length > 0);

    return NextResponse.json({
      id: analysis.id,
      image_name: analysis.image_name,
      compliance_status: analysis.compliance_status,
      issues_found: analysis.issues_found,
      created_at: analysis.created_at,
      ...analysisData,
      show_category_selector: showCategorySelector,
      usage: {
        used: currentUsage.analyses_used + 1,
        limit: currentUsage.analyses_limit,
      },
      session: sessionId ? {
        id: sessionId,
        title: session?.title || null,
      } : null,
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}

