import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { buildAnalysisPrompt } from '@/lib/prompts/analysis-prompt';
import { postProcessAnalysis } from '@/lib/analysis/post-processor';
import {
  getUserWithFallback,
  checkUsageLimits,
  handleSession,
  processFile,
  extractTextForRag,
  loadRegulatoryDocuments,
  callAIWithRetry,
  saveAnalysis,
  updateUsage,
  saveIteration,
  sendNotificationEmail,
} from '@/lib/analysis/orchestrator';
import { logger, createRequestLogger } from '@/lib/logger';
import type { AnalysisResult } from '@/types';
import { handleApiError, ValidationError, RateLimitError } from '@/lib/error-handler';
import { analyzeRequestSchema, createValidationErrorResponse } from '@/lib/validation';
import { authenticateRequest } from '@/lib/auth-helpers';
import { parseRequest, isTestMode } from '@/lib/services/request-parser';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze' });

  try {
    const inTestMode = isTestMode(request);
    const contentType = request.headers.get('content-type') || '';
    const isJsonRequest = contentType.includes('application/json');

    // Test mode: validate first, then auth
    // Normal mode: auth first, then validate
    if (inTestMode) {
      // Special handling for JSON requests in test mode (used for validation testing)
      if (isJsonRequest) {
        try {
          const body = await request.clone().json();

          // Manual validation of JSON body
          const validationErrors: Array<{ path: string[]; message: string }> = [];

          if (!body.image) {
            validationErrors.push({ path: ['image'], message: 'Required' });
          }
          if (!body.productType) {
            validationErrors.push({ path: ['productType'], message: 'Required' });
          }
          if (
            body.productType &&
            ![
              'CONVENTIONAL_FOOD',
              'DIETARY_SUPPLEMENT',
              'ALCOHOLIC_BEVERAGE',
              'NON_ALCOHOLIC_BEVERAGE',
            ].includes(body.productType)
          ) {
            validationErrors.push({ path: ['productType'], message: 'Invalid enum value' });
          }

          if (validationErrors.length > 0) {
            return NextResponse.json(
              {
                error: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: validationErrors.map((e) => `${e.path.join('.')}: ${e.message}`),
                fields: validationErrors,
              },
              { status: 400 }
            );
          }
        } catch (error) {
          return NextResponse.json(
            {
              error: 'Validation failed',
              code: 'VALIDATION_ERROR',
              details: ['Invalid request format'],
              fields: [{ path: [], message: 'Invalid request format' }],
            },
            { status: 400 }
          );
        }
      }

      // Parse and validate request (works for both JSON-validated and FormData)
      const parseResult = await parseRequest(request, analyzeRequestSchema);

      if (!parseResult.success) {
        requestLogger.warn('Validation failed (test mode)', {
          errors: parseResult.error.errors,
        });
        const errorResponse = createValidationErrorResponse(parseResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Validation passed, now authenticate
      const authResult = await authenticateRequest(request, false);

      requestLogger.info('Analysis request started (test mode)', {
        userId: authResult.userId,
      });

      // Extract validated data
      const {
        image: imageFile,
        sessionId: existingSessionId,
        labelName,
        forcedCategory,
      } = parseResult.data;

      return await processAnalysisRequest(
        authResult.userId,
        imageFile,
        existingSessionId || null,
        labelName,
        forcedCategory,
        requestLogger,
        openai
      );
    } else {
      // Normal mode: auth first, then validate
      const authResult = await authenticateRequest(request, false);

      requestLogger.info('Analysis request started', { userId: authResult.userId });

      // Parse and validate request
      const parseResult = await parseRequest(request, analyzeRequestSchema);

      if (!parseResult.success) {
        requestLogger.warn('Validation failed', { errors: parseResult.error.errors });
        const errorResponse = createValidationErrorResponse(parseResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Extract validated data
      const {
        image: imageFile,
        sessionId: existingSessionId,
        labelName,
        forcedCategory,
      } = parseResult.data;

      return await processAnalysisRequest(
        authResult.userId,
        imageFile,
        existingSessionId || null,
        labelName,
        forcedCategory,
        requestLogger,
        openai
      );
    }
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

async function processAnalysisRequest(
  userId: string,
  imageFile: File,
  existingSessionId: string | null,
  labelName: string | undefined,
  forcedCategory: string | undefined,
  requestLogger: ReturnType<typeof createRequestLogger>,
  openai: OpenAI
) {
  // 1. Get or create user
  const user = await getUserWithFallback(userId);

  // 2. Check usage limits
  let currentUsage;
  try {
    currentUsage = await checkUsageLimits(userId, user.id);
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    if (error.message.includes('limit reached')) {
      // Extract limit info if available from the error
      throw new RateLimitError('Monthly analysis limit reached. Please upgrade your plan.', {
        // Note: checkUsageLimits may need to throw RateLimitError directly in future
        current: error.message.match(/\d+/)?.[0]
          ? parseInt(error.message.match(/\d+/)?.[0] || '0')
          : undefined,
      });
    }
    throw error;
  }

  // 3. Handle session
  const { sessionId, session } = await handleSession(user.id, existingSessionId, imageFile);

  // 4. Process file (image or PDF)
  const { isPdf, base64Data, pdfTextContent, mediaType } = await processFile(imageFile);

  // 5. Extract text for RAG lite (if needed)
  let extractedTextForRag: string | undefined;
  if (!pdfTextContent && base64Data) {
    extractedTextForRag = await extractTextForRag(openai, base64Data, mediaType);
  }

  // 6. Load regulatory documents with RAG lite filtering
  const { regulatoryContext, ragInfo } = await loadRegulatoryDocuments(
    pdfTextContent,
    extractedTextForRag
  );

  // 7. Build analysis prompt
  // Use pre-classified category from RAG lite if forcedCategory not provided
  const categoryForPrompt = forcedCategory || ragInfo?.preClassifiedCategory || null;
  const analysisInstructions = buildAnalysisPrompt({
    isPdf,
    forcedCategory: categoryForPrompt,
  });

  // 8. Call AI with retry logic
  const completion = await callAIWithRetry(
    openai,
    regulatoryContext,
    analysisInstructions,
    pdfTextContent,
    base64Data,
    mediaType
  );

  // 9. Parse AI response
  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No text response from AI');
  }

  requestLogger.debug('AI response received', {
    responseLength: responseText.length,
    preview: responseText.substring(0, 500),
  });

  let analysisData: AnalysisResult;
  try {
    analysisData = JSON.parse(responseText);
    requestLogger.info('Analysis data parsed successfully', { userId });
  } catch (parseError) {
    requestLogger.error('Failed to parse AI response', {
      error: parseError,
      responsePreview: responseText.substring(0, 1000),
    });
    throw new Error('Failed to parse AI response');
  }

  // 10. Post-process: GRAS, NDI, allergen checks, status enforcement
  await postProcessAnalysis(analysisData);

  // 11. Save analysis to database
  const analysis = await saveAnalysis(
    user.id,
    imageFile,
    labelName || null,
    analysisData,
    base64Data,
    pdfTextContent,
    mediaType,
    sessionId
  );

  // 12. Update usage counter
  const currentMonth = new Date().toISOString().slice(0, 7);
  await updateUsage(user.id, currentMonth, currentUsage.analyses_used);

  // 13. Save iteration if part of a session
  if (sessionId) {
    await saveIteration(sessionId, imageFile, analysisData, analysis.id, mediaType);
  }

  // 14. Send email notification
  await sendNotificationEmail(user.email, analysisData, analysis);

  // 15. Build response
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
    session: sessionId
      ? {
          id: sessionId,
          title: session?.title || null,
        }
      : null,
  });
}
