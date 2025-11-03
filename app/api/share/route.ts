import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { randomBytes } from 'crypto';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  NotFoundError,
  handleSupabaseError,
} from '@/lib/error-handler';
import { shareRequestSchema, createValidationErrorResponse } from '@/lib/validation';
import { getAuthenticatedUser } from '@/lib/auth-helpers';

export async function POST(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/share' });

  try {
    // Authenticate user
    const { userId, userInternalId } = await getAuthenticatedUser();

    requestLogger.info('Share link generation requested', { userId });

    // Parse and validate request body with Zod
    const body = await request.json();
    const validationResult = shareRequestSchema.safeParse(body);

    if (!validationResult.success) {
      requestLogger.warn('Share validation failed', { errors: validationResult.error.errors });
      const errorResponse = createValidationErrorResponse(validationResult.error);
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const { analysisId } = validationResult.data;

    // Verify the analysis belongs to the user (use admin client to bypass RLS)
    const { data: analysis } = await supabaseAdmin
      .from('analyses')
      .select('id, share_token')
      .eq('id', analysisId)
      .eq('user_id', userInternalId)
      .maybeSingle();

    if (!analysis) {
      throw new NotFoundError('Analysis', analysisId);
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
      throw handleSupabaseError(updateError, 'generate share token');
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/share/${shareToken}`;

    requestLogger.info('Share link generated', {
      userId,
      analysisId,
      shareToken,
    });

    return NextResponse.json({ shareToken, shareUrl });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
