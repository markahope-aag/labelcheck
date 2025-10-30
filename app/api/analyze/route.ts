import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext, getRecommendedDocuments } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';
import { createSession, addIteration } from '@/lib/session-helpers';
import { checkGRASCompliance } from '@/lib/gras-helpers';
import { checkNDICompliance } from '@/lib/ndi-helpers';
import { checkIngredientsForAllergens } from '@/lib/allergen-helpers';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';
import { buildAnalysisPrompt } from '@/lib/prompts/analysis-prompt';

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

    // GRAS Compliance Checking
    // Check if ingredients are present and validate against GRAS database
    // IMPORTANT: GRAS (21 CFR 170.3) only applies to CONVENTIONAL FOODS and BEVERAGES
    // Dietary supplements are regulated under DSHEA and do NOT require GRAS ingredients
    const isConventionalFoodProduct = analysisData.product_category === 'CONVENTIONAL_FOOD' ||
                                       analysisData.product_category === 'NON_ALCOHOLIC_BEVERAGE' ||
                                       analysisData.product_category === 'ALCOHOLIC_BEVERAGE';

    if (isConventionalFoodProduct &&
        analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking GRAS compliance for', analysisData.product_category, 'ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const grasCompliance = await checkGRASCompliance(analysisData.ingredient_labeling.ingredients_list);

        console.log('GRAS compliance check complete:', {
          total: grasCompliance.totalIngredients,
          compliant: grasCompliance.grasCompliant,
          nonGRAS: grasCompliance.nonGRASIngredients,
        });

        // Add GRAS compliance info to analysis data
        analysisData.gras_compliance = {
          status: grasCompliance.overallCompliant ? 'compliant' : 'non_compliant',
          total_ingredients: grasCompliance.totalIngredients,
          gras_compliant_count: grasCompliance.grasCompliant,
          non_gras_ingredients: grasCompliance.nonGRASIngredients,
          gras_ingredients: grasCompliance.grasIngredients,
          detailed_results: grasCompliance.detailedResults,
        };

        // If non-GRAS ingredients found, add critical recommendations
        if (!grasCompliance.overallCompliant && grasCompliance.nonGRASIngredients.length > 0) {
          console.log('CRITICAL: Non-GRAS ingredients detected:', grasCompliance.nonGRASIngredients);

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Determine severity based on number of non-GRAS ingredients
          const nonGRASCount = grasCompliance.nonGRASIngredients.length;
          const isSingleIngredient = nonGRASCount === 1;
          const priority = isSingleIngredient ? 'high' : 'critical';
          const complianceStatus = isSingleIngredient ? 'potentially_non_compliant' : 'non_compliant';
          const statusLabel = isSingleIngredient ? 'Potentially Non-Compliant' : 'Non-Compliant';

          // Add recommendations for each non-GRAS ingredient
          grasCompliance.nonGRASIngredients.forEach((ingredient) => {
            analysisData.recommendations.unshift({
              priority,
              recommendation: `${priority === 'critical' ? 'CRITICAL' : 'IMPORTANT'}: Ingredient "${ingredient}" is NOT found in the FDA GRAS (Generally Recognized as Safe) database. If this ingredient is being used, it must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or it may require FDA pre-market approval through a food additive petition. Provide documentation of GRAS self-determination or obtain proper FDA approval before marketing this product.`,
              regulation: '21 CFR 170.30(b) (GRAS self-determination)',
            });
          });

          // Update overall compliance status to reflect GRAS violations
          if (analysisData.overall_assessment) {
            analysisData.overall_assessment.primary_compliance_status = complianceStatus;

            // Update summary to reflect GRAS non-compliance
            if (isSingleIngredient) {
              analysisData.overall_assessment.summary = `The ${analysisData.product_name || 'product'} label is POTENTIALLY NON-COMPLIANT with FDA regulations due to the use of an ingredient not found in the FDA GRAS (Generally Recognized as Safe) database. This ingredient may be subject to industry self-affirmation of GRAS status. If this ingredient is being used, it must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or may require FDA pre-market approval through a food additive petition.`;
            } else {
              analysisData.overall_assessment.summary = `The ${analysisData.product_name || 'product'} label is NON-COMPLIANT with FDA regulations due to the use of multiple ingredients not found in the FDA GRAS (Generally Recognized as Safe) database. If these ingredients are being used, they must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or may require FDA pre-market approval through a food additive petition.`;
            }

            // Add GRAS violation to key findings
            if (!analysisData.overall_assessment.key_findings) {
              analysisData.overall_assessment.key_findings = [];
            }
            analysisData.overall_assessment.key_findings.unshift(
              `${priority === 'critical' ? 'CRITICAL' : 'IMPORTANT'}: ${nonGRASCount} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}`
            );
          }

          // Add to compliance table
          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.unshift({
            element: 'GRAS Ingredient Compliance',
            status: statusLabel,
            rationale: `${nonGRASCount} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}. ${isSingleIngredient ? 'May be subject to industry self-affirmation.' : 'Requires FDA approval or GRAS determination.'}`,
          });
        } else {
          // All ingredients are GRAS-compliant
          console.log('All ingredients are GRAS-compliant');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'GRAS Ingredient Compliance',
            status: 'Compliant',
            rationale: `All ${grasCompliance.totalIngredients} ingredients found in FDA GRAS database`,
          });
        }
      } catch (grasError) {
        console.error('Error checking GRAS compliance:', grasError);
        // Don't fail the analysis if GRAS check fails, just log the error
        // The analysis will continue without GRAS compliance info
      }
    } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
      console.log('Product is a dietary supplement - GRAS compliance not applicable (regulated under DSHEA, not 21 CFR 170.3)');
    } else {
      console.log('No ingredients found in analysis - skipping GRAS check');
    }

    // NDI (New Dietary Ingredient) Compliance Checking
    // Only check for dietary supplements (ingredients not marketed before Oct 15, 1994 require NDI notification)
    if (analysisData.product_category === 'DIETARY_SUPPLEMENT' &&
        analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking NDI compliance for dietary supplement ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const ndiCompliance = await checkNDICompliance(analysisData.ingredient_labeling.ingredients_list);

        console.log('NDI compliance check complete:', {
          total: ndiCompliance.summary.totalChecked,
          withNDI: ndiCompliance.summary.withNDI,
          withoutNDI: ndiCompliance.summary.withoutNDI,
          requiresNotification: ndiCompliance.summary.requiresNotification,
        });

        // Add NDI compliance info to analysis data
        analysisData.ndi_compliance = {
          status: ndiCompliance.summary.requiresNotification > 0 ? 'requires_verification' : 'compliant',
          total_ingredients: ndiCompliance.summary.totalChecked,
          with_ndi_count: ndiCompliance.summary.withNDI,
          without_ndi_count: ndiCompliance.summary.withoutNDI,
          requires_notification_count: ndiCompliance.summary.requiresNotification,
          detailed_results: ndiCompliance.results,
        };

        // If ingredients without NDI found, add informational recommendations
        if (ndiCompliance.summary.requiresNotification > 0) {
          console.log('INFO: Ingredients requiring NDI verification detected');

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Add informational note for ingredients that may require verification
          const ingredientsWithoutNDI = ndiCompliance.results
            .filter(r => r.requiresNDI)
            .map(r => r.ingredient);

          analysisData.recommendations.push({
            priority: 'low',
            recommendation: `INFORMATIONAL (Not a Compliance Issue): ${ndiCompliance.summary.requiresNotification} ingredient(s) are not in our dietary ingredients database: ${ingredientsWithoutNDI.join(', ')}. This is likely NOT a compliance issue - most supplement ingredients were marketed before October 15, 1994 and are grandfathered under DSHEA. Our database contains 2,193 pre-1994 ingredients and 1,253 NDI notifications, but cannot include every historical ingredient. Only ingredients first marketed AFTER October 15, 1994 require NDI notifications. Unless these are truly novel ingredients, no action is needed.`,
            regulation: 'FD&C Act Section 413 (DSHEA) - Informational Only',
          });

          // Add to compliance table
          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'NDI (New Dietary Ingredient) Compliance',
            status: 'Informational',
            rationale: `${ndiCompliance.summary.requiresNotification} ingredient(s) not found in our database. Likely grandfathered (pre-1994). Verify if truly new ingredients.`,
          });
        } else {
          console.log('All ingredients either have NDI notifications or verification not applicable');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'NDI (New Dietary Ingredient) Compliance',
            status: 'Compliant',
            rationale: `All ingredients either have NDI notifications on file or are exempt (pre-1994 ingredients)`,
          });
        }
      } catch (ndiError) {
        console.error('Error checking NDI compliance:', ndiError);
        // Don't fail the analysis if NDI check fails, just log the error
      }
    } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
      console.log('No ingredients found in supplement analysis - skipping NDI check');
    }

    // Major Food Allergen Compliance Checking (FALCPA/FASTER Act)
    // Check all products with ingredients for allergen presence and declaration
    if (analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0) {

      console.log('Checking major allergen compliance for ingredients:', analysisData.ingredient_labeling.ingredients_list);

      try {
        const allergenResults = await checkIngredientsForAllergens(analysisData.ingredient_labeling.ingredients_list);

        console.log('Allergen compliance check complete:', {
          totalIngredients: allergenResults.summary.totalIngredients,
          ingredientsWithAllergens: allergenResults.summary.ingredientsWithAllergens,
          uniqueAllergensDetected: allergenResults.summary.uniqueAllergensDetected,
          allergens: allergenResults.allergensDetected.map(a => a.allergen_name),
        });

        // Add allergen compliance info to analysis data
        analysisData.allergen_database_check = {
          total_ingredients: allergenResults.summary.totalIngredients,
          ingredients_with_allergens: allergenResults.summary.ingredientsWithAllergens,
          allergens_detected: allergenResults.allergensDetected.map(a => ({
            name: a.allergen_name,
            category: a.allergen_category,
            found_in: allergenResults.ingredientsWithAllergens
              .filter(i => i.allergens.some(al => al.allergen?.id === a.id))
              .map(i => i.ingredient),
          })),
          high_confidence_matches: allergenResults.summary.highConfidenceMatches,
          medium_confidence_matches: allergenResults.summary.mediumConfidenceMatches,
        };

        // If allergens are detected, verify proper declaration
        if (allergenResults.allergensDetected.length > 0) {
          console.log('ALLERGENS DETECTED:', allergenResults.allergensDetected.map(a => a.allergen_name).join(', '));

          // Check if AI analysis found proper allergen labeling
          const aiAllergenStatus = analysisData.allergen_labeling?.status;
          const hasContainsStatement = analysisData.allergen_labeling?.has_contains_statement;

          // Initialize recommendations array if it doesn't exist
          if (!analysisData.recommendations) {
            analysisData.recommendations = [];
          }

          // Cross-reference database findings with AI analysis
          // Only flag as critical if:
          // 1. AI explicitly says non-compliant, OR
          // 2. AI found allergen-containing ingredients but no Contains statement
          // Do NOT flag if AI says compliant (which means either no allergens OR properly declared)
          if (aiAllergenStatus === 'potentially_non_compliant' || aiAllergenStatus === 'non_compliant') {
            // AI detected missing allergen declarations - validate with database
            const detectedAllergenNames = allergenResults.allergensDetected.map(a => a.allergen_name);

            analysisData.recommendations.push({
              priority: 'critical',
              recommendation: `CRITICAL ALLERGEN VIOLATION: The following major food allergens were detected in ingredients but may not be properly declared: ${detectedAllergenNames.join(', ')}. Per FALCPA Section 403(w) and FASTER Act, all major food allergens MUST be declared either (1) in parentheses following the ingredient (e.g., "Whey (milk)") OR (2) in a "Contains:" statement immediately after the ingredient list. Missing allergen declarations can result in FDA enforcement action and mandatory recalls.`,
              regulation: 'FALCPA Section 403(w), FASTER Act, 21 USC §343(w)',
            });

            // Add detailed breakdown of which ingredients contain which allergens
            const allergenDetails = allergenResults.allergensDetected.map(allergen => {
              const ingredients = allergenResults.ingredientsWithAllergens
                .filter(i => i.allergens.some(al => al.allergen?.id === allergen.id))
                .map(i => i.ingredient);
              return `${allergen.allergen_name}: found in ${ingredients.join(', ')}`;
            });

            analysisData.recommendations.push({
              priority: 'high',
              recommendation: `Allergen source breakdown: ${allergenDetails.join('; ')}. Ensure proper declaration for ALL listed allergens.`,
              regulation: 'FALCPA/FASTER Act Compliance',
            });

            if (!analysisData.compliance_table) {
              analysisData.compliance_table = [];
            }
            analysisData.compliance_table.push({
              element: 'Major Food Allergen Declaration',
              status: 'Non-Compliant',
              rationale: `${allergenResults.allergensDetected.length} major allergen(s) detected in ingredients but proper declaration missing or unclear`,
            });
          } else if (aiAllergenStatus === 'compliant') {
            // AI says compliant - but we need to verify if allergens actually exist
            // Check if AI found any potential allergens
            const aiFoundAllergens = analysisData.allergen_labeling?.potential_allergens &&
                                    analysisData.allergen_labeling.potential_allergens.length > 0;

            if (aiFoundAllergens) {
              // AI found allergens AND says they're properly declared
              console.log('Allergens properly declared (validated by both AI and database)');

              if (!analysisData.compliance_table) {
                analysisData.compliance_table = [];
              }
              analysisData.compliance_table.push({
                element: 'Major Food Allergen Declaration',
                status: 'Compliant',
                rationale: `All ${allergenResults.allergensDetected.length} major allergen(s) properly declared per FALCPA/FASTER Act`,
              });
            } else {
              // AI found NO allergens (database has false positive)
              // Trust the AI over the database
              console.log('Database detected allergens but AI found none - likely false positive, treating as no allergens');

              if (!analysisData.compliance_table) {
                analysisData.compliance_table = [];
              }
              analysisData.compliance_table.push({
                element: 'Major Food Allergen Declaration',
                status: 'Not Applicable',
                rationale: 'No major food allergens detected in ingredients',
              });
            }
          }
        } else {
          // No allergens detected by database
          console.log('No major food allergens detected in ingredients');

          if (!analysisData.compliance_table) {
            analysisData.compliance_table = [];
          }
          analysisData.compliance_table.push({
            element: 'Major Food Allergen Declaration',
            status: 'Not Applicable',
            rationale: 'No major food allergens detected in ingredients',
          });
        }
      } catch (allergenError) {
        console.error('Error checking allergen compliance:', allergenError);
        // Don't fail the analysis if allergen check fails, just log the error
        // The AI-based allergen checking will still be present in analysisData.allergen_labeling
      }
    } else {
      console.log('No ingredients found in analysis - skipping allergen database check');
    }

    // Add general compliance monitoring recommendation
    if (!analysisData.recommendations) {
      analysisData.recommendations = [];
    }
    analysisData.recommendations.push({
      priority: 'low',
      recommendation: 'Continue monitoring for compliance with any new regulations or labeling requirements. FDA regulations and guidance documents are updated periodically, and maintaining ongoing awareness of regulatory changes is essential for continued compliance.',
      regulation: 'General FDA guidelines for product labeling',
    });

    // ENFORCE CONSISTENT COMPLIANCE STATUS BASED ON RECOMMENDATION PRIORITIES
    // This ensures the overall status matches the severity of issues found
    if (analysisData.recommendations && analysisData.recommendations.length > 0 && analysisData.overall_assessment) {
      const criticalCount = analysisData.recommendations.filter((r: any) => r.priority === 'critical').length;
      const highCount = analysisData.recommendations.filter((r: any) => r.priority === 'high').length;
      const mediumCount = analysisData.recommendations.filter((r: any) => r.priority === 'medium').length;
      const lowCount = analysisData.recommendations.filter((r: any) => r.priority === 'low').length;

      // Override primary_compliance_status to ensure consistency
      if (criticalCount > 0 || highCount > 0) {
        // Blocking issues present → Must be non-compliant
        analysisData.overall_assessment.primary_compliance_status = 'non_compliant';
        console.log(`Enforced non_compliant status due to ${criticalCount} critical and ${highCount} high priority issues`);
      } else if (mediumCount > 0) {
        // Only medium issues → Potentially non-compliant (requires verification)
        if (analysisData.overall_assessment.primary_compliance_status === 'compliant' ||
            analysisData.overall_assessment.primary_compliance_status === 'likely_compliant') {
          analysisData.overall_assessment.primary_compliance_status = 'potentially_non_compliant';
          console.log(`Enforced potentially_non_compliant status due to ${mediumCount} medium priority issues`);
        }
      } else if (lowCount > 0 && (criticalCount + highCount + mediumCount === 0)) {
        // Only low priority suggestions → Likely compliant
        if (analysisData.overall_assessment.primary_compliance_status === 'non_compliant' ||
            analysisData.overall_assessment.primary_compliance_status === 'potentially_non_compliant') {
          analysisData.overall_assessment.primary_compliance_status = 'likely_compliant';
          console.log(`Enforced likely_compliant status - only ${lowCount} low priority suggestions`);
        }
      }
    }

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

