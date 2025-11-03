import { auth } from '@clerk/nextjs/server';
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
import {
  handleApiError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  ExternalServiceError,
  handleSupabaseError,
} from '@/lib/error-handler';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized analysis request');
      throw new AuthenticationError();
    }

    requestLogger.info('Analysis request started', { userId });

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

    // 3. Parse form data
    const formData = await request.formData();
    const imageFile = formData.get('image') as File;
    const existingSessionId = formData.get('sessionId') as string | null;
    const labelName = formData.get('labelName') as string | null;
    const forcedCategory = formData.get('forcedCategory') as string | null;

    if (!imageFile) {
      throw new ValidationError('Image is required', { field: 'image' });
    }

    // Validate file size (10MB limit)
    if (imageFile.size > 10 * 1024 * 1024) {
      throw new ValidationError('File too large. Maximum file size is 10MB.', {
        field: 'image',
        maxSize: '10MB',
        actualSize: `${(imageFile.size / (1024 * 1024)).toFixed(2)}MB`,
      });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(imageFile.type)) {
      throw new ValidationError(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`, {
        field: 'image',
        allowedTypes,
        actualType: imageFile.type,
      });
    }

    // 4. Handle session
    const { sessionId, session } = await handleSession(user.id, existingSessionId, imageFile);

    // 5. Process file (image or PDF)
    const { isPdf, base64Data, pdfTextContent, mediaType } = await processFile(imageFile);

    // 6. Extract text for RAG lite (if needed)
    let extractedTextForRag: string | undefined;
    if (!pdfTextContent && base64Data) {
      extractedTextForRag = await extractTextForRag(openai, base64Data, mediaType);
    }

    // 7. Load regulatory documents with RAG lite filtering
    const { regulatoryContext } = await loadRegulatoryDocuments(
      pdfTextContent,
      extractedTextForRag
    );

    // 8. Build analysis prompt
    const analysisInstructions = buildAnalysisPrompt({ isPdf, forcedCategory });

    // 9. Call AI with retry logic
    const completion = await callAIWithRetry(
      openai,
      regulatoryContext,
      analysisInstructions,
      pdfTextContent,
      base64Data,
      mediaType
    );

    // 10. Parse AI response
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

    // 11. Post-process: GRAS, NDI, allergen checks, status enforcement
    await postProcessAnalysis(analysisData);

    // 12. Save analysis to database
    const analysis = await saveAnalysis(
      user.id,
      imageFile,
      labelName,
      analysisData,
      base64Data,
      pdfTextContent,
      mediaType,
      sessionId
    );

    // 13. Update usage counter
    const currentMonth = new Date().toISOString().slice(0, 7);
    await updateUsage(user.id, currentMonth, currentUsage.analyses_used);

    // 14. Save iteration if part of a session
    if (sessionId) {
      await saveIteration(sessionId, imageFile, analysisData, analysis.id, mediaType);
    }

    // 15. Send email notification
    await sendNotificationEmail(user.email, analysisData, analysis);

    // 16. Build response
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
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
