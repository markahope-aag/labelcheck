import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '@/lib/supabase';
import { getSessionWithIterations, addIteration } from '@/lib/session-helpers';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
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
    const { session, iterations, error: sessionError } = await getSessionWithIterations(
      sessionId,
      false
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

    // Build context from iterations
    let contextMessage = 'You are a regulatory compliance expert helping a user understand their label analysis.\n\n';

    // Find the most recent analysis iteration
    const analysisIterations = iterations.filter(
      (iter) =>
        iter.iteration_type === 'image_analysis' ||
        iter.iteration_type === 'text_check' ||
        iter.iteration_type === 'revised_analysis'
    );

    if (analysisIterations.length > 0) {
      const latestAnalysis = analysisIterations[analysisIterations.length - 1];
      contextMessage += '## Latest Analysis Results\n\n';
      contextMessage += `**Product:** ${latestAnalysis.result_data?.product_name || 'Unknown'}\n`;
      contextMessage += `**Product Type:** ${latestAnalysis.result_data?.product_type || 'Unknown'}\n\n`;

      if (latestAnalysis.result_data?.overall_assessment) {
        contextMessage += '**Overall Compliance Status:** ';
        contextMessage += `${latestAnalysis.result_data.overall_assessment.primary_compliance_status}\n`;
        contextMessage += `**Summary:** ${latestAnalysis.result_data.overall_assessment.summary}\n\n`;
      }

      if (latestAnalysis.result_data?.recommendations) {
        contextMessage += '**Key Recommendations:**\n';
        latestAnalysis.result_data.recommendations.forEach((rec: any, idx: number) => {
          contextMessage += `${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.recommendation} (${rec.regulation})\n`;
        });
        contextMessage += '\n';
      }

      if (latestAnalysis.result_data?.allergen_labeling) {
        contextMessage += '**Allergen Status:** ';
        contextMessage += `${latestAnalysis.result_data.allergen_labeling.status}\n`;
        if (latestAnalysis.result_data.allergen_labeling.potential_allergens?.length > 0) {
          contextMessage += `**Potential Allergens:** ${latestAnalysis.result_data.allergen_labeling.potential_allergens.join(', ')}\n`;
        }
        contextMessage += '\n';
      }
    }

    // Include recent chat history for context
    const chatIterations = iterations.filter(
      (iter) => iter.iteration_type === 'chat_question'
    );

    if (chatIterations.length > 0) {
      contextMessage += '## Recent Conversation History\n\n';
      const recentChats = chatIterations.slice(-3); // Last 3 chat exchanges
      recentChats.forEach((chat) => {
        contextMessage += `**User:** ${chat.input_data?.message || ''}\n`;
        contextMessage += `**Assistant:** ${chat.result_data?.response || ''}\n\n`;
      });
    }

    contextMessage += '## Current Question\n\n';
    contextMessage += `The user is now asking: "${message}"\n\n`;
    contextMessage += 'Please provide a clear, helpful answer based on the analysis context above. ';
    contextMessage += 'If the question is about a specific regulation, cite the relevant CFR section. ';
    contextMessage += 'If the question is about how to fix an issue, provide specific, actionable guidance.';

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: contextMessage,
        },
      ],
    });

    const textContent = response.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    const aiResponse = textContent.text;

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
      false // Use regular client (user owns this session)
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
