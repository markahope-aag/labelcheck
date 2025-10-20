import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getActiveRegulatoryDocuments, buildRegulatoryContext } from '@/lib/regulatory-documents';
import { sendEmail } from '@/lib/resend';
import { generateAnalysisResultEmail } from '@/lib/email-templates';
import { preprocessImage } from '@/lib/image-processing';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await supabase
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

    const { data: usage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!usage) {
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan_tier, status')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      const limits: Record<string, number> = {
        basic: 10,
        pro: 100,
        enterprise: -1,
      };

      const planTier = subscription?.plan_tier || 'basic';
      const limit = limits[planTier] || 5;

      const { error: usageError } = await supabase.from('usage_tracking').insert({
        user_id: user.id,
        month: currentMonth,
        analyses_used: 0,
        analyses_limit: limit,
      });

      if (usageError) {
        console.error('Error creating usage tracking:', usageError);
      }
    }

    const { data: currentUsage } = await supabase
      .from('usage_tracking')
      .select('*')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle();

    if (!currentUsage) {
      return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
    }

    if (
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

    if (!imageFile) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const bytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Preprocess the image to improve readability
    const processedBuffer = await preprocessImage(buffer);
    const base64Image = processedBuffer.toString('base64');

    // Use JPEG as media type since preprocessing converts to JPEG
    const mediaType = 'image/jpeg' as const;

    const regulatoryDocuments = await getActiveRegulatoryDocuments();
    const regulatoryContext = buildRegulatoryContext(regulatoryDocuments);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `${regulatoryContext}

Analyze this food label image and evaluate it against the regulatory requirements provided above.

IMPORTANT INSTRUCTIONS FOR READING THE IMAGE:
- The text on this label may be very small, difficult to read, or have poor contrast
- Text may be oriented vertically, sideways, or even upside-down
- If you encounter rotated text, mentally rotate the image to read it correctly
- Look very carefully at all text, including fine print and small ingredient lists
- If text is blurry or unclear, use context clues from surrounding text to decipher it
- Pay special attention to ingredient lists which are often in very small font
- Some labels may have text on dark backgrounds or vice versa - adjust your reading accordingly
- Take your time to examine every section of the label thoroughly
- If certain information is genuinely illegible, note that in your analysis

Return your response as a JSON object with the following structure:
{
  "product_name": "Name of the product",
  "summary": "A brief summary of the overall nutritional profile and healthiness (2-3 sentences)",
  "ingredients": ["ingredient1", "ingredient2", ...],
  "nutrition_facts": {
    "calories": "value with unit",
    "total_fat": "value with unit",
    "saturated_fat": "value with unit",
    "cholesterol": "value with unit",
    "sodium": "value with unit",
    "total_carbohydrate": "value with unit",
    "dietary_fiber": "value with unit",
    "total_sugars": "value with unit",
    "protein": "value with unit"
  },
  "health_score": 75,
  "recommendations": ["recommendation1", "recommendation2", ...]
}

Important:
- health_score should be a number from 0-100 based on overall nutritional quality AND regulatory compliance
- Include 3-5 specific, actionable recommendations based on both nutrition and regulatory requirements
- Identify any regulatory violations or compliance issues based on the documents provided
- Be specific about concerning ingredients or nutrients
- Only include nutrition facts that are visible in the image
- Reference specific regulations when identifying compliance issues`,
            },
          ],
        },
      ],
    });

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI');
    }

    let analysisData;
    try {
      const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      analysisData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      throw new Error('Failed to parse AI response');
    }

    const { data: analysis, error: insertError } = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        image_url: `data:${mediaType};base64,${base64Image.substring(0, 100)}...`,
        image_name: imageFile.name,
        analysis_result: analysisData,
        compliance_status: analysisData.health_score >= 80 ? 'compliant' : analysisData.health_score >= 60 ? 'minor_issues' : 'major_violations',
        issues_found: analysisData.recommendations?.length || 0,
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

    try {
      const emailHtml = generateAnalysisResultEmail({
        productName: analysisData.product_name || 'Unknown Product',
        summary: analysisData.summary || 'Analysis completed successfully.',
        healthScore: analysisData.health_score || 0,
        complianceStatus: analysis.compliance_status,
        recommendations: analysisData.recommendations || [],
        analyzedAt: analysis.created_at,
      });

      await sendEmail({
        to: user.email,
        subject: `Food Label Analysis Complete: ${analysisData.product_name || 'Your Product'}`,
        html: emailHtml,
      });
    } catch (emailError) {
      console.error('Error sending email notification:', emailError);
    }

    return NextResponse.json({
      ...analysis,
      usage: {
        used: currentUsage.analyses_used + 1,
        limit: currentUsage.analyses_limit,
      },
    });
  } catch (error: any) {
    console.error('Error analyzing image:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to analyze image' },
      { status: 500 }
    );
  }
}
