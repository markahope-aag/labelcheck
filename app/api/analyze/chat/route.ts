import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  ExternalServiceError,
} from '@/lib/error-handler';
import { chatRequestSchema, createValidationErrorResponse } from '@/lib/validation';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/chat' });

  try {
    // Check for test bypass - if present, validate before auth (for E2E tests)
    const testBypass = request.headers.get('X-Test-Bypass');
    const isTestMode =
      process.env.NODE_ENV !== 'production' && testBypass === process.env.TEST_BYPASS_TOKEN;

    // Parse JSON body once - clone request for test mode to avoid consuming stream
    let body: any;
    let validationResult: ReturnType<typeof chatRequestSchema.safeParse>;

    // If test mode, do validation first to return 400 before auth
    if (isTestMode) {
      body = await request.clone().json();
      validationResult = chatRequestSchema.safeParse(body);

      if (!validationResult.success) {
        requestLogger.warn('Chat validation failed (test mode)', {
          errors: validationResult.error.errors,
        });
        const errorResponse = createValidationErrorResponse(validationResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }
      // Validation passed, now parse original request for processing
      body = await request.json();
      validationResult = chatRequestSchema.safeParse(body);
    } else {
      // Normal flow: auth first, then validate
      body = await request.json();
      validationResult = chatRequestSchema.safeParse(body);

      if (!validationResult.success) {
        requestLogger.warn('Chat validation failed', { errors: validationResult.error.errors });
        const errorResponse = createValidationErrorResponse(validationResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }
    }

    // Auth check (after validation if test mode, before if normal mode)
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized chat request');
      throw new AuthenticationError();
    }

    requestLogger.info('Chat request started', { userId });

    const { sessionId, question: message } = validationResult.data;
    const { parentIterationId } = body; // Optional field, not in schema

    // Get user from database (use admin client to bypass RLS)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      throw new NotFoundError('User', userId);
    }

    // Get session with all iterations to build context
    // Use admin client to bypass RLS since sessions are created with admin
    const {
      session,
      iterations,
      error: sessionError,
    } = await getSessionWithIterations(sessionId, true);

    if (sessionError || !session) {
      requestLogger.error('Session fetch failed', { error: sessionError, sessionId });
      throw new NotFoundError('Analysis', sessionId);
    }

    // Verify session belongs to user
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'Access denied to this session' }, { status: 403 });
    }

    // Get regulatory documents for reference
    const regulatoryDocuments = await getActiveRegulatoryDocuments();
    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    // Build cached context (regulatory docs + latest analysis - these don't change often)
    let cachedContext = regulatoryContext + '\n\n';
    cachedContext +=
      'You are a regulatory compliance expert helping a user understand their label analysis.\n\n';

    // Find the most recent analysis iteration
    const analysisIterations = iterations.filter(
      (iter) =>
        iter.iteration_type === 'image_analysis' ||
        iter.iteration_type === 'text_check' ||
        iter.iteration_type === 'revised_analysis'
    );

    if (analysisIterations.length > 0) {
      const latestAnalysis = analysisIterations[analysisIterations.length - 1];
      const resultData = latestAnalysis.result_data;

      // Type guard: Check if result_data is an AnalysisResult (not a chat response)
      if (resultData && 'product_name' in resultData) {
        cachedContext += '## Latest Analysis Results\n\n';
        cachedContext += `**Product:** ${resultData.product_name || 'Unknown'}\n`;
        cachedContext += `**Product Type:** ${resultData.product_type || 'Unknown'}\n\n`;

        if (resultData.overall_assessment) {
          cachedContext += '**Overall Compliance Status:** ';
          cachedContext += `${resultData.overall_assessment.primary_compliance_status}\n`;
          cachedContext += `**Summary:** ${resultData.overall_assessment.summary}\n\n`;
        }

        if (resultData.recommendations) {
          cachedContext += '**Key Recommendations:**\n';
          resultData.recommendations.forEach((rec, idx: number) => {
            cachedContext += `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation} (${rec.regulation})\n`;
          });
          cachedContext += '\n';
        }

        if (resultData.allergen_labeling) {
          cachedContext += '**Allergen Status:** ';
          cachedContext += `${resultData.allergen_labeling.status}\n`;
          if (
            resultData.allergen_labeling.allergens_declared &&
            resultData.allergen_labeling.allergens_declared.length > 0
          ) {
            cachedContext += `**Allergens Declared:** ${resultData.allergen_labeling.allergens_declared.join(', ')}\n`;
          }
          cachedContext += '\n';
        }

        // Include ingredient list so AI can answer questions about specific ingredients
        if (
          resultData.ingredient_labeling?.ingredients_list &&
          resultData.ingredient_labeling.ingredients_list.length > 0
        ) {
          cachedContext += '**Complete Ingredient List (as analyzed from the label):**\n';
          cachedContext += resultData.ingredient_labeling.ingredients_list.join(', ') + '\n\n';
          cachedContext += `IMPORTANT: This is the complete list of ALL ingredients found on the label. If an ingredient is not in this list, it is NOT present in the product.\n\n`;
        }

        // Include GRAS compliance data if available
        if (resultData.ingredient_labeling?.gras_compliance) {
          const grasData = resultData.ingredient_labeling.gras_compliance;
          cachedContext += 'GRAS Compliance Check:\n';
          cachedContext += `- Total ingredients checked: ${grasData.total_ingredients || 0}\n`;
          cachedContext += `- GRAS-compliant: ${grasData.gras_compliant_count || 0}\n`;
          if (grasData.non_gras_ingredients && grasData.non_gras_ingredients.length > 0) {
            cachedContext += `- Non-GRAS ingredients: ${grasData.non_gras_ingredients.join(', ')}\n`;
          }
          cachedContext += '\n';
        }

        // Include claims analysis if available
        if (resultData.claims) {
          cachedContext += 'Label Claims Analysis:\n';

          if (
            resultData.claims.structure_function_claims?.claims_present &&
            resultData.claims.structure_function_claims.claims_found.length > 0
          ) {
            cachedContext += `- Structure/Function Claims Found: ${resultData.claims.structure_function_claims.claims_found.map((c) => c.claim_text).join('; ')}\n`;
          }

          if (
            resultData.claims.nutrient_content_claims?.claims_present &&
            resultData.claims.nutrient_content_claims.claims_found.length > 0
          ) {
            cachedContext += `- Nutrient Content Claims Found: ${resultData.claims.nutrient_content_claims.claims_found.map((c) => c.claim_text).join('; ')}\n`;
          }

          if (
            resultData.claims.health_claims?.claims_present &&
            resultData.claims.health_claims.claims_found.length > 0
          ) {
            cachedContext += `- Health Claims Found: ${resultData.claims.health_claims.claims_found.map((c) => c.claim_text).join('; ')}\n`;
          }

          if (
            resultData.claims.prohibited_claims?.claims_present &&
            resultData.claims.prohibited_claims.claims_found.length > 0
          ) {
            cachedContext += `- PROHIBITED Claims Detected: ${resultData.claims.prohibited_claims.claims_found.map((c) => c.claim_text).join('; ')}\n`;
          }

          if (
            !resultData.claims.structure_function_claims?.claims_present &&
            !resultData.claims.nutrient_content_claims?.claims_present &&
            !resultData.claims.health_claims?.claims_present &&
            !resultData.claims.prohibited_claims?.claims_present
          ) {
            cachedContext += '- No claims detected on the label\n';
          }

          cachedContext += '\n';
        }
      }
    }

    // Build dynamic context (chat history + current question - these change frequently)
    let dynamicContext = '';

    // Include recent chat history for context
    const chatIterations = iterations.filter((iter) => iter.iteration_type === 'chat_question');

    if (chatIterations.length > 0) {
      dynamicContext += '## Recent Conversation History\n\n';
      const recentChats = chatIterations.slice(-5); // Last 5 chat exchanges
      recentChats.forEach((chat) => {
        dynamicContext += `**User:** ${chat.input_data?.message || ''}\n`;
        // Type guard: Check if result_data is a chat response (has 'response' property)
        const chatResponse =
          chat.result_data && 'response' in chat.result_data ? chat.result_data.response : '';
        dynamicContext += `**Assistant:** ${chatResponse}\n\n`;
      });
    }

    dynamicContext += '## Current Question\n\n';
    dynamicContext += `The user is now asking: "${message}"\n\n`;
    dynamicContext += 'CRITICAL INSTRUCTIONS:\n';
    dynamicContext +=
      '1. Answer ONLY based on the analysis data provided above. Do not speculate, add caveats, or suggest checking things manually.\n';
    dynamicContext +=
      '2. If the analysis data says "no allergens detected" - simply confirm NO allergens are present. Do not mention cross-contamination or trace amounts.\n';
    dynamicContext +=
      '3. If an ingredient is in the "Complete Ingredient List" - confirm it IS present. If it is NOT in the list - confirm it is NOT present.\n';
    dynamicContext +=
      '4. If the "Label Claims Analysis" shows claims - list them. If it shows no claims - state no claims were detected.\n';
    dynamicContext +=
      '5. Be direct and confident. The analysis has already been completed thoroughly.\n';
    dynamicContext += '6. For regulatory questions, cite the relevant CFR section.\n';
    dynamicContext += '7. For compliance issues, provide specific, actionable guidance.\n';
    dynamicContext +=
      '8. FORMATTING: Use plain text only - no markdown formatting (no asterisks, no headers).';

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_completion_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: cachedContext + '\n\n' + dynamicContext,
        },
      ],
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new ExternalServiceError('OpenAI Chat', 'No text response from AI');
    }

    // Save chat iteration to database
    const { data: iteration, error: iterationError } = await addIteration(
      sessionId,
      'chat_question',
      {
        message,
        timestamp: new Date().toISOString(),
      },
      {
        response: aiResponse,
        timestamp: new Date().toISOString(),
      },
      undefined,
      parentIterationId || undefined,
      true // Use admin client to bypass RLS
    );

    if (iterationError) {
      requestLogger.error('Failed to save chat iteration', { error: iterationError, sessionId });
      // Don't fail the request if we can't save the iteration
    }

    requestLogger.info('Chat response completed', {
      userId,
      sessionId,
      iterationId: iteration?.id,
      responseLength: aiResponse.length,
    });

    return NextResponse.json({
      response: aiResponse,
      iterationId: iteration?.id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
