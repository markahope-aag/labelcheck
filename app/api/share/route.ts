import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { analysisId } = body;

    if (!analysisId) {
      return NextResponse.json({ error: 'Analysis ID required' }, { status: 400 });
    }

    // Get user's internal ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify the analysis belongs to the user
    const { data: analysis } = await supabase
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

    // Update the analysis with the share token
    const { error: updateError } = await supabase
      .from('analyses')
      .update({ share_token: shareToken })
      .eq('id', analysisId);

    if (updateError) {
      console.error('Error updating share token:', updateError);
      return NextResponse.json({ error: 'Failed to generate share link' }, { status: 500 });
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/${shareToken}`;

    return NextResponse.json({ shareToken, shareUrl });
  } catch (error: any) {
    console.error('Error generating share link:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate share link' }, { status: 500 });
  }
}
