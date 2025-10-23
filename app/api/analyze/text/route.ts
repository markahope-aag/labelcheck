import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { processPdfForAnalysis } from '@/lib/pdf-helpers';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let sessionId: string;
    let textContent: string | undefined;
    let pdfFile: File | undefined;
    let isPdfMode = false;

    // Check if this is a FormData request (PDF upload) or JSON (text)
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      // PDF upload mode
      const formData = await request.formData();
      sessionId = formData.get('sessionId') as string;
      pdfFile = formData.get('pdf') as File;
      isPdfMode = true;

      if (!sessionId || !pdfFile) {
        return NextResponse.json(
          { error: 'Session ID and PDF file are required' },
          { status: 400 }
        );
      }
    } else {
      // Text mode
      const body = await request.json();
      sessionId = body.sessionId;
      textContent = body.textContent;

      if (!sessionId || !textContent) {
        return NextResponse.json(
          { error: 'Session ID and text content are required' },
          { status: 400 }
        );
      }
    }

    // Get user from database
    const { data: user } = await supabase
      .from('users')
      .select('id, email')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get session with all iterations to find original analysis
    // Use admin client to bypass RLS since sessions are created with admin
    const { session, iterations, error: sessionError } = await getSessionWithIterations(
      sessionId,
      true
    );

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError);
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    // Verify session belongs to user
    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied to this session' },
        { status: 403 }
      );
    }

    // Find the original image analysis
    const originalAnalysis = iterations.find(
      (iter) => iter.iteration_type === 'image_analysis'
    );

    let originalContext = '';
    if (originalAnalysis?.result_data) {
      originalContext += '\n\n## Original Label Analysis (For Comparison)\n\n';
      originalContext += `**Product:** ${originalAnalysis.result_data.product_name || 'Unknown'}\n`;
      originalContext += `**Overall Status:** ${originalAnalysis.result_data.overall_assessment?.primary_compliance_status || 'Unknown'}\n`;

      if (originalAnalysis.result_data.recommendations) {
        originalContext += '\n**Original Issues Found:**\n';
        originalAnalysis.result_data.recommendations.forEach((rec: any, idx: number) => {
          originalContext += `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation}\n`;
        });
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

    console.log('=== AI Text Analysis Response (first 500 chars) ===');
    console.log(responseText.substring(0, 500));
    console.log('=== End preview ===');

    let analysisData;
    try {
      analysisData = JSON.parse(responseText);
      console.log('Successfully parsed text analysis data');
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw response (first 1000 chars):', responseText.substring(0, 1000));
      throw new Error('Failed to parse AI response');
    }

    // Save text check iteration to database
    const { data: iteration, error: iterationError } = await addIteration(
      sessionId,
      'text_check',
      {
        inputType: isPdfMode ? 'pdf' : 'text',
        textContent: isPdfMode ? undefined : textContent?.substring(0, 5000), // Limit stored text length
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
      console.error('Error saving text check iteration:', iterationError);
      // Don't fail the request if we can't save the iteration
    }

    return NextResponse.json({
      ...analysisData,
      iterationId: iteration?.id || null,
      analysisType: 'text_check',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error analyzing text content:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze text content' },
      { status: 500 }
    );
  }
}
