/**
 * Analysis Orchestrator
 *
 * Coordinates the analysis workflow by managing:
 * - User authentication and creation
 * - Usage tracking and limits
 * - Session management
 * - File processing
 * - RAG document loading
 * - AI API calls with retry logic
 * - Database operations
 * - Email notifications
 */

import { clerkClient } from '@clerk/nextjs/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext, getRecommendedDocuments } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';

export interface UserInfo {
  id: string;
  email: string;
}

export interface UsageInfo {
  analyses_used: number;
  analyses_limit: number;
}

export interface SessionInfo {
  id: string;
  title: string | null;
}

export interface ProcessedFile {
  isPdf: boolean;
  base64Data?: string;
  pdfTextContent?: string;
  mediaType: 'image/jpeg' | 'image/png';
  contentType: 'image' | 'document' | 'text';
}

export interface DocumentLoadResult {
  regulatoryDocuments: any[];
  regulatoryContext: string;
  ragInfo: {
    preClassifiedCategory: string | null;
    documentCount: number;
    totalCount: number;
  } | null;
}

/**
 * Get user from database or create if not exists
 */
export async function getUserWithFallback(userId: string): Promise<UserInfo> {
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
        throw new Error('User email not found');
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
        throw new Error(`Failed to create user record: ${createError.message}`);
      }

      if (!newUser) {
        console.error('User creation returned no data');
        throw new Error('Failed to create user record');
      }

      user = newUser;
      console.log('Successfully created user:', newUser.id);
    } catch (err: any) {
      console.error('Exception creating user:', err);
      throw new Error(`Failed to create user: ${err.message}`);
    }
  }

  return user;
}

/**
 * Check usage limits and return current usage info
 */
export async function checkUsageLimits(
  userId: string,
  userInternalId: string
): Promise<UsageInfo> {
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Use admin client for usage tracking (bypass RLS)
  const { data: usage } = await supabaseAdmin
    .from('usage_tracking')
    .select('*')
    .eq('user_id', userInternalId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!usage) {
    // Use admin client for subscription lookup (bypass RLS)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_tier, status')
      .eq('user_id', userInternalId)
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
      user_id: userInternalId,
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
    .eq('user_id', userInternalId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (!currentUsage) {
    throw new Error('Failed to track usage');
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
    throw new Error('Monthly analysis limit reached. Please upgrade your plan.');
  }

  return currentUsage;
}

/**
 * Handle session creation or retrieval
 */
export async function handleSession(
  userInternalId: string,
  existingSessionId: string | null,
  imageFile: File
): Promise<{ sessionId: string | null; session: SessionInfo | null }> {
  let sessionId = existingSessionId;
  let session = null;

  if (!sessionId) {
    // Create a new session for this analysis
    const productHint = imageFile.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const { data: newSession, error: sessionError } = await createSession(
      userInternalId,
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

  return { sessionId, session };
}

/**
 * Process uploaded file (image or PDF)
 */
export async function processFile(imageFile: File): Promise<ProcessedFile> {
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

  return {
    isPdf,
    base64Data,
    pdfTextContent,
    mediaType,
    contentType,
  };
}

/**
 * Extract text from image for RAG lite filtering
 */
export async function extractTextForRag(
  openai: OpenAI,
  base64Data: string,
  mediaType: 'image/jpeg' | 'image/png'
): Promise<string | undefined> {
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

    const extractedText = quickOcrResponse.choices[0]?.message?.content || '';
    console.log(`✅ Extracted ${extractedText.length} characters for RAG lite`);
    return extractedText;
  } catch (ocrError) {
    console.warn('⚠️ Quick OCR failed, will use all documents:', ocrError);
    return undefined;
  }
}

/**
 * Load regulatory documents with RAG lite filtering
 */
export async function loadRegulatoryDocuments(
  pdfTextContent?: string,
  extractedTextForRag?: string
): Promise<DocumentLoadResult> {
  console.log('📚 Fetching regulatory documents...');

  // Use RAG lite for both PDFs and images (if text extraction succeeded)
  const textForRag = pdfTextContent || extractedTextForRag;

  if (textForRag) {
    // RAG lite - filter by pre-classified category
    const { documents, preClassifiedCategory, documentCount, totalCount } =
      await getRecommendedDocuments(textForRag);
    console.log(`✅ RAG Lite: Loaded ${documentCount}/${totalCount} documents for ${preClassifiedCategory}`);

    return {
      regulatoryDocuments: documents,
      regulatoryContext: buildRegulatoryContext(documents),
      ragInfo: { preClassifiedCategory, documentCount, totalCount },
    };
  } else {
    // Fallback - load all documents if text extraction failed
    const documents = await getActiveRegulatoryDocuments();
    console.log(`✅ Loaded all ${documents.length} documents (fallback mode)`);

    return {
      regulatoryDocuments: documents,
      regulatoryContext: buildRegulatoryContext(documents),
      ragInfo: null,
    };
  }
}

/**
 * Call OpenAI API with retry logic for rate limits
 */
export async function callAIWithRetry(
  openai: OpenAI,
  regulatoryContext: string,
  analysisInstructions: string,
  pdfTextContent: string | undefined,
  base64Data: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  maxRetries = 3
): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🤖 Calling OpenAI GPT-4o (attempt ${attempt}/${maxRetries})...`);
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
}

/**
 * Save analysis to database
 */
export async function saveAnalysis(
  userInternalId: string,
  imageFile: File,
  labelName: string | null,
  analysisData: any,
  base64Data: string | undefined,
  pdfTextContent: string | undefined,
  mediaType: 'image/jpeg' | 'image/png',
  sessionId: string | null
): Promise<any> {
  // Determine compliance status from the new analysis structure
  const complianceStatus = analysisData.overall_assessment?.primary_compliance_status || 'unknown';
  const dbComplianceStatus =
    complianceStatus === 'compliant' || complianceStatus === 'likely_compliant' ? 'compliant' :
    complianceStatus === 'potentially_non_compliant' ? 'minor_issues' :
    'major_violations';

  const { data: analysis, error: insertError } = await supabaseAdmin
    .from('analyses')
    .insert({
      user_id: userInternalId,
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
    throw new Error('Failed to save analysis');
  }

  return analysis;
}

/**
 * Update usage counter
 */
export async function updateUsage(
  userInternalId: string,
  currentMonth: string,
  currentUsed: number
): Promise<void> {
  const { error: usageUpdateError } = await supabase
    .from('usage_tracking')
    .update({ analyses_used: currentUsed + 1 })
    .eq('user_id', userInternalId)
    .eq('month', currentMonth);

  if (usageUpdateError) {
    console.error('Error updating usage:', usageUpdateError);
  }
}

/**
 * Save iteration record for analysis session
 */
export async function saveIteration(
  sessionId: string,
  imageFile: File,
  analysisData: any,
  analysisId: string,
  mediaType: 'image/jpeg' | 'image/png'
): Promise<void> {
  const { error: iterationError } = await addIteration(
    sessionId,
    'image_analysis',
    {
      image_name: imageFile.name,
      file_size: imageFile.size,
      media_type: mediaType,
    },
    analysisData,
    analysisId,
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

/**
 * Send email notification to user
 */
export async function sendNotificationEmail(
  userEmail: string,
  analysisData: any,
  analysis: any
): Promise<void> {
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
      to: userEmail,
      subject: `Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
      html: emailHtml,
    });
  } catch (emailError) {
    console.error('Error sending email notification:', emailError);
    // Don't fail the analysis if email fails
  }
}
