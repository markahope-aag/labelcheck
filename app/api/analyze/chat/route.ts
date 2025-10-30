import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { supabaseAdmin } from '@/lib/supabase';
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

    // Get user from database (use admin client to bypass RLS)
    const { data: user } = await supabaseAdmin
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

      // Include ingredient list so AI can answer questions about specific ingredients
      if (latestAnalysis.result_data?.ingredient_labeling?.ingredients_list?.length > 0) {
        cachedContext += '**Complete Ingredient List (as analyzed from the label):**\n';
        cachedContext += latestAnalysis.result_data.ingredient_labeling.ingredients_list.join(', ') + '\n\n';
        cachedContext += `IMPORTANT: This is the complete list of ALL ingredients found on the label. If an ingredient is not in this list, it is NOT present in the product.\n\n`;
      }

      // Include GRAS compliance data if available
      if (latestAnalysis.result_data?.gras_compliance) {
        cachedContext += 'GRAS Compliance Check:\n';
        cachedContext += `- Total ingredients checked: ${latestAnalysis.result_data.gras_compliance.total || 0}\n`;
        cachedContext += `- GRAS-compliant: ${latestAnalysis.result_data.gras_compliance.compliant || 0}\n`;
        if (latestAnalysis.result_data.gras_compliance.nonGRASIngredients?.length > 0) {
          cachedContext += `- Non-GRAS ingredients: ${latestAnalysis.result_data.gras_compliance.nonGRASIngredients.join(', ')}\n`;
        }
        cachedContext += '\n';
      }

      // Include claims analysis if available
      if (latestAnalysis.result_data?.claims) {
        cachedContext += 'Label Claims Analysis:\n';
        cachedContext += `- Status: ${latestAnalysis.result_data.claims.status || 'unknown'}\n`;

        if (latestAnalysis.result_data.claims.structure_function_claims?.length > 0) {
          cachedContext += `- Structure/Function Claims Found: ${latestAnalysis.result_data.claims.structure_function_claims.join('; ')}\n`;
        }

        if (latestAnalysis.result_data.claims.nutrient_content_claims?.length > 0) {
          cachedContext += `- Nutrient Content Claims Found: ${latestAnalysis.result_data.claims.nutrient_content_claims.join('; ')}\n`;
        }

        if (latestAnalysis.result_data.claims.health_claims?.length > 0) {
          cachedContext += `- Health Claims Found: ${latestAnalysis.result_data.claims.health_claims.join('; ')}\n`;
        }

        if (latestAnalysis.result_data.claims.prohibited_claims?.length > 0) {
          cachedContext += `- PROHIBITED Claims Detected: ${latestAnalysis.result_data.claims.prohibited_claims.join('; ')}\n`;
        }

        if (!latestAnalysis.result_data.claims.structure_function_claims?.length &&
            !latestAnalysis.result_data.claims.nutrient_content_claims?.length &&
            !latestAnalysis.result_data.claims.health_claims?.length &&
            !latestAnalysis.result_data.claims.prohibited_claims?.length) {
          cachedContext += '- No claims detected on the label\n';
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
    dynamicContext += 'CRITICAL INSTRUCTIONS:\n';
    dynamicContext += '1. Answer ONLY based on the analysis data provided above. Do not speculate, add caveats, or suggest checking things manually.\n';
    dynamicContext += '2. If the analysis data says "no allergens detected" - simply confirm NO allergens are present. Do not mention cross-contamination or trace amounts.\n';
    dynamicContext += '3. If an ingredient is in the "Complete Ingredient List" - confirm it IS present. If it is NOT in the list - confirm it is NOT present.\n';
    dynamicContext += '4. If the "Label Claims Analysis" shows claims - list them. If it shows no claims - state no claims were detected.\n';
    dynamicContext += '5. Be direct and confident. The analysis has already been completed thoroughly.\n';
    dynamicContext += '6. For regulatory questions, cite the relevant CFR section.\n';
    dynamicContext += '7. For compliance issues, provide specific, actionable guidance.\n';
    dynamicContext += '8. FORMATTING: Use plain text only - no markdown formatting (no asterisks, no headers).';

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
