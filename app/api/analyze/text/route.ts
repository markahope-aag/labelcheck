import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';
import { TEXT_LIMITS } from '@/lib/constants';
import { logger, createRequestLogger } from '@/lib/logger';
import { handleApiError, ValidationError } from '@/lib/error-handler';
import { textCheckerRequestSchema, createValidationErrorResponse } from '@/lib/validation';
import { authenticateRequest } from '@/lib/auth-helpers';
import { parseRequest, isTestMode } from '@/lib/services/request-parser';
import { getSessionWithAccess } from '@/lib/services/session-service';
import type { Recommendation } from '@/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/analyze/text' });

  try {
    const inTestMode = isTestMode(request);
    const contentType = request.headers.get('content-type') || '';
    const isPdfMode = contentType.includes('multipart/form-data');

    // Test mode: validate first, then auth
    // Normal mode: auth first, then validate
    if (inTestMode) {
      // Parse and validate in test mode (validation before auth)
      const parseResult = await parseRequest(request, textCheckerRequestSchema);

      if (!parseResult.success) {
        requestLogger.warn('Text checker validation failed (test mode)', {
          errors: parseResult.error.errors,
        });
        const errorResponse = createValidationErrorResponse(parseResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Validation passed, now authenticate
      const authResult = await authenticateRequest(request, false);

      requestLogger.info('Text analysis request started (test mode)', {
        userId: authResult.userId,
      });

      // Extract data from parsed result
      const { sessionId } = parseResult.data;
      const textContent = 'text' in parseResult.data ? parseResult.data.text : undefined;
      const pdfFile = 'pdf' in parseResult.data ? parseResult.data.pdf : undefined;

      return await processTextAnalysisRequest(
        sessionId,
        textContent,
        pdfFile,
        isPdfMode,
        authResult.userInternalId,
        requestLogger
      );
    } else {
      // Normal mode: auth first, then validate
      const authResult = await authenticateRequest(request, false);

      requestLogger.info('Text analysis request started', { userId: authResult.userId });

      // Parse and validate request
      const parseResult = await parseRequest(request, textCheckerRequestSchema);

      if (!parseResult.success) {
        requestLogger.warn('Text checker validation failed', {
          errors: parseResult.error.errors,
        });
        const errorResponse = createValidationErrorResponse(parseResult.error);
        return NextResponse.json(errorResponse, { status: 400 });
      }

      // Extract data from parsed result
      const { sessionId } = parseResult.data;
      const textContent = 'text' in parseResult.data ? parseResult.data.text : undefined;
      const pdfFile = 'pdf' in parseResult.data ? parseResult.data.pdf : undefined;

      return await processTextAnalysisRequest(
        sessionId,
        textContent,
        pdfFile,
        isPdfMode,
        authResult.userInternalId,
        requestLogger
      );
    }
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

async function processTextAnalysisRequest(
  sessionId: string,
  textContent: string | undefined,
  pdfFile: File | undefined,
  isPdfMode: boolean,
  userId: string,
  requestLogger: ReturnType<typeof createRequestLogger>
) {
  // Validate sessionId
  if (!sessionId) {
    throw new ValidationError('Session ID is required', { field: 'sessionId' });
  }

  // Get session with access verification
  const sessionResult = await getSessionWithAccess(sessionId, userId, true);

  if (!sessionResult.hasAccess) {
    return NextResponse.json(
      { error: sessionResult.error },
      { status: sessionResult.session ? 403 : 404 }
    );
  }

  const { session, iterations } = sessionResult;

  // Find the original image analysis
  const originalAnalysis = iterations.find((iter) => iter.iteration_type === 'image_analysis');

  let originalContext = '';
  if (originalAnalysis?.result_data) {
    const resultData = originalAnalysis.result_data;

    // Type guard: Check if result_data is an AnalysisResult (not a chat response)
    if ('product_name' in resultData) {
      originalContext += '\n\n## Original Label Analysis (For Comparison)\n\n';
      originalContext += `**Product:** ${resultData.product_name || 'Unknown'}\n`;
      originalContext += `**Overall Status:** ${resultData.overall_assessment?.primary_compliance_status || 'Unknown'}\n`;

      if (resultData.recommendations) {
        originalContext += '\n**Original Issues Found:**\n';
        resultData.recommendations.forEach((rec: Recommendation, idx: number) => {
          originalContext += `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}\n`;
        });
      }
    }
  }

  // Get regulatory documents
  const regulatoryDocuments = await getActiveRegulatoryDocuments();
  const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

  // Create AI prompt for text/PDF analysis
  let completion;

  if (isPdfMode && pdfFile) {
    // PDF mode - hybrid processing (text extraction first, CloudConvert fallback)
    const bytes = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const pdfResult = await processPdfForAnalysis(buffer);

    const analysisInstructions = `You are a labeling regulatory compliance expert. A user has uploaded a PDF of their prospective label design to check compliance BEFORE finalizing it.

${originalContext}

## Analysis Instructions

ANALYZE THIS PDF LABEL DESIGN for compliance.

IMPORTANT:
1. If there was an original analysis, compare this PDF's content to those findings
2. Note what issues have been RESOLVED (if any)
3. Note any NEW issues introduced
4. Note what's still MISSING or unclear
5. Be constructive - this is a draft the user is improving

Return your response as a JSON object with the same structure used for image analysis.`;

    if (pdfResult.type === 'text') {
      // Text extraction successful
      const pdfText = pdfResult.content as string;
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_completion_tokens: 8192,
        messages: [
          {
            role: 'user',
            content:
              regulatoryContext +
              '\n\n' +
              analysisInstructions +
              '\n\n## Extracted PDF Text:\n\n' +
              pdfText,
          },
        ],
        response_format: { type: 'json_object' },
      });
    } else {
      // CloudConvert converted to image
      const imageBuffer = pdfResult.content as Buffer;
      const base64Image = imageBuffer.toString('base64');
      completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_completion_tokens: 8192,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: regulatoryContext + '\n\n' + analysisInstructions,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });
    }
  } else {
    // Text mode - analyze plain text
    const analysisInstructions = `You are a labeling regulatory compliance expert. A user is testing prospective label content (text-only, not an image) to check compliance BEFORE creating a physical label.

${originalContext}

## Prospective Label Content (User is Testing)

The user wants to check if this proposed text content is compliant:

\`\`\`
${textContent}
\`\`\`

## Analysis Instructions

Analyze this text-only label content and provide compliance evaluation. This is PROSPECTIVE content - the user is testing it before finalizing their label design.

IMPORTANT:
1. If there was an original analysis, compare this text to those findings
2. Note what issues have been RESOLVED (if any)
3. Note any NEW issues introduced
4. Note what's still MISSING or unclear
5. Be constructive - this is a draft the user is improving

Follow the same JSON structure as image analysis, but note in your details that this is text-only analysis and certain visual elements cannot be evaluated (like font size, placement, prominence).

Return your response as a JSON object with the same structure used for image analysis, including:
- product_name (extracted from text)
- product_type (inferred from content)
- general_labeling (statement of identity, net quantity, manufacturer address)
- ingredient_labeling
- allergen_labeling
- nutrition_labeling
- additional_requirements
- overall_assessment
- compliance_table
- recommendations

Additionally, include a "comparison" field if original analysis exists:
{
  "comparison": {
    "issues_resolved": ["List of issues from original that are now fixed"],
    "issues_remaining": ["List of issues still present"],
    "new_issues": ["Any new problems introduced"],
    "improvement_summary": "Brief summary of progress made"
  }
}`;

    completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_completion_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: regulatoryContext + '\n\n' + analysisInstructions,
        },
      ],
      response_format: { type: 'json_object' },
    });
  }

  const responseText = completion.choices[0]?.message?.content;
  if (!responseText) {
    throw new Error('No text response from AI');
  }

  requestLogger.debug('AI response received', {
    responseLength: responseText.length,
    preview: responseText.substring(0, 200),
  });

  let analysisData;
  try {
    analysisData = JSON.parse(responseText);
    requestLogger.info('Text analysis data parsed successfully', { userId });
  } catch (parseError) {
    requestLogger.error('Failed to parse AI response', {
      error: parseError,
      responsePreview: responseText.substring(0, 1000),
    });
    throw new Error('Failed to parse AI response');
  }

  // Save text check iteration to database
  const { data: iteration, error: iterationError } = await addIteration(
    sessionId,
    'text_check',
    {
      inputType: isPdfMode ? 'pdf' : 'text',
      textContent: isPdfMode
        ? undefined
        : textContent?.substring(0, TEXT_LIMITS.MAX_STORED_TEXT_LENGTH), // Limit stored text length
      pdfFileName: isPdfMode && pdfFile ? pdfFile.name : undefined,
      pdfSize: isPdfMode && pdfFile ? pdfFile.size : undefined,
      timestamp: new Date().toISOString(),
    },
    analysisData,
    undefined,
    undefined,
    true // Use admin client to bypass RLS
  );

  if (iterationError) {
    requestLogger.error('Failed to save text check iteration', { error: iterationError });
    // Don't fail the request if we can't save the iteration
  }

  requestLogger.info('Text analysis completed successfully', {
    userId,
    iterationId: iteration?.id,
    analysisType: 'text_check',
  });

  return NextResponse.json({
    ...analysisData,
    iterationId: iteration?.id || null,
    analysisType: 'text_check',
    timestamp: new Date().toISOString(),
  });
}
