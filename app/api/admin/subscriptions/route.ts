import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  handleSupabaseError,
} from '@/lib/error-handler';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/subscriptions' });

  try {
    const { userId } = await auth();

    if (!userId) {
      throw new AuthenticationError();
    }

    // Check if user is admin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (!user || !user.is_system_admin) {
      throw new AuthorizationError('Admin access required');
    }

    requestLogger.info('Admin subscriptions fetch started', { userId });

    // Get all subscriptions with user details
    const { data: subscriptions, error } = await supabaseAdmin
      .from('subscriptions')
      .select(
        `
        *,
        users (
          id,
          email,
          clerk_user_id
        )
      `
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw handleSupabaseError(error, 'fetch subscriptions');
    }

    // Calculate stats
    const stats = {
      active: subscriptions?.filter((s) => s.status === 'active').length || 0,
      canceled: subscriptions?.filter((s) => s.status === 'canceled').length || 0,
      total: subscriptions?.length || 0,
    };

    requestLogger.debug('Subscriptions fetched successfully', {
      count: subscriptions?.length,
      stats,
    });

    return NextResponse.json({
      subscriptions: subscriptions || [],
      stats,
    });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
