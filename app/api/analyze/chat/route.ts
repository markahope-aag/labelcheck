import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabase } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sessionId, message, parentIterationId } = await request.json();

    if (!sessionId || !message) {
      return NextResponse.json(
        { error: 'Session ID and message are required' },
        { status: 400 }
      );
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

    // Get session with all iterations to build context
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

    // Get regulatory documents for reference
    const regulatoryDocuments = await getActiveRegulatoryDocuments();
    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    // Build cached context (regulatory docs + latest analysis - these don't change often)
    let cachedContext = regulatoryContext + '\n\n';
    cachedContext += 'You are a regulatory compliance expert helping a user understand their label analysis.\n\n';

    // Find the most recent analysis iteration
    const analysisIterations = iterations.filter(
      (iter) =>
        iter.iteration_type === 'image_analysis' ||
        iter.iteration_type === 'text_check' ||
        iter.iteration_type === 'revised_analysis'
    );

    if (analysisIterations.length > 0) {
      const latestAnalysis = analysisIterations[analysisIterations.length - 1];
      cachedContext += '## Latest Analysis Results\n\n';
      cachedContext += `**Product:** ${latestAnalysis.result_data?.product_name || 'Unknown'}\n`;
      cachedContext += `**Product Type:** ${latestAnalysis.result_data?.product_type || 'Unknown'}\n\n`;

      if (latestAnalysis.result_data?.overall_assessment) {
        cachedContext += '**Overall Compliance Status:** ';
        cachedContext += `${latestAnalysis.result_data.overall_assessment.primary_compliance_status}\n`;
        cachedContext += `**Summary:** ${latestAnalysis.result_data.overall_assessment.summary}\n\n`;
      }

      if (latestAnalysis.result_data?.recommendations) {
        cachedContext += '**Key Recommendations:**\n';
        latestAnalysis.result_data.recommendations.forEach((rec: any, idx: number) => {
          cachedContext += `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation} (${rec.regulation})\n`;
        });
        cachedContext += '\n';
      }

      if (latestAnalysis.result_data?.allergen_labeling) {
        cachedContext += '**Allergen Status:** ';
        cachedContext += `${latestAnalysis.result_data.allergen_labeling.status}\n`;
        if (latestAnalysis.result_data.allergen_labeling.potential_allergens?.length > 0) {
          cachedContext += `**Potential Allergens:** ${latestAnalysis.result_data.allergen_labeling.potential_allergens.join(', ')}\n`;
        }
        cachedContext += '\n';
      }
    }

    // Build dynamic context (chat history + current question - these change frequently)
    let dynamicContext = '';

    // Include recent chat history for context
    const chatIterations = iterations.filter(
      (iter) => iter.iteration_type === 'chat_question'
    );

    if (chatIterations.length > 0) {
      dynamicContext += '## Recent Conversation History\n\n';
      const recentChats = chatIterations.slice(-5); // Last 5 chat exchanges
      recentChats.forEach((chat) => {
        dynamicContext += `**User:** ${chat.input_data?.message || ''}\n`;
        dynamicContext += `**Assistant:** ${chat.result_data?.response || ''}\n\n`;
      });
    }

    dynamicContext += '## Current Question\n\n';
    dynamicContext += `The user is now asking: "${message}"\n\n`;
    dynamicContext += 'Please provide a clear, helpful answer based on the analysis context above. ';
    dynamicContext += 'If the question is about a specific regulation, cite the relevant CFR section. ';
    dynamicContext += 'If the question is about how to fix an issue, provide specific, actionable guidance.';

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: cachedContext + '\n\n' + dynamicContext,
        },
      ],
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No text response from AI');
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
      console.error('Error saving chat iteration:', iterationError);
      // Don't fail the request if we can't save the iteration
    }

    return NextResponse.json({
      response: aiResponse,
      iterationId: iteration?.id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error in chat endpoint:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
