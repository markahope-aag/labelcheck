import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/users' });

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

    requestLogger.info('Admin users fetch started');

    // Get all users with their subscriptions using a single query
    const { data: users, error: usersError } = await supabaseAdmin
      .from('users')
      .select(
        `
        *,
        subscriptions (
          plan_tier,
          status
        )
      `
      )
      .order('created_at', { ascending: false });

    if (usersError) {
      throw handleSupabaseError(usersError, 'fetch users');
    }

    // Get analysis counts for all users in a single aggregated query (fixes N+1 problem)
    const { data: analysisCounts, error: countsError } = await supabaseAdmin
      .from('analyses')
      .select('user_id');

    if (countsError) {
      throw handleSupabaseError(countsError, 'fetch analysis counts');
    }

    // Build a map of user_id -> count for O(1) lookup
    const countMap = new Map<string, number>();
    analysisCounts?.forEach((analysis) => {
      const currentCount = countMap.get(analysis.user_id) || 0;
      countMap.set(analysis.user_id, currentCount + 1);
    });

    // Combine users with their analysis counts
    const usersWithCounts =
      users?.map((user) => ({
        ...user,
        subscription: user.subscriptions?.[0] || null,
        analyses_count: countMap.get(user.id) || 0,
      })) || [];

    requestLogger.debug('Users fetched successfully', { count: usersWithCounts.length });
    return NextResponse.json(usersWithCounts);
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
