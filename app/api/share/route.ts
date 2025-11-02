import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';
import { logger, createRequestLogger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/share' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized share request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestLogger.info('Share link generation requested', { userId });

    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    }

    // Get user's internal ID (use admin client to bypass RLS)
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the analysis belongs to the user (use admin client to bypass RLS)
    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('id, share_token')
      .eq('id', analysisId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    // If analysis already has a share token, return it
    if (analysis.share_token) {
      const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/${analysis.share_token}`;
      return NextResponse.json({ shareToken: analysis.share_token, shareUrl });
    }

    // Generate a new share token
    const shareToken = randomBytes(16).toString('hex');

    // Update the analysis with the share token (use admin client to bypass RLS)
    const { error: updateError } = await supabaseAdmin
      .from('analyses')
      .update({ share_token: shareToken })
      .eq('id', analysisId);

    if (updateError) {
      requestLogger.error('Failed to update share token', {
        error: updateError,
        analysisId,
        userId,
      });
      return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/${shareToken}`;

    requestLogger.info('Share link generated', {
      userId,
      analysisId,
      shareToken,
    });

    return NextResponse.json({ shareToken, shareUrl });
  } catch (error: any) {
    requestLogger.error('Share link generation failed', { error, message: error.message });
    return NextResponse.json(
      { error: error.message || 'Failed to generate share link' },
      { status: 500 }
    );
  }
}
