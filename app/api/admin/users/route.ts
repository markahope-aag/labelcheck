import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

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
      console.error('Error fetching users:', usersError);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get analysis counts for all users in a single aggregated query (fixes N+1 problem)
    const { data: analysisCounts, error: countsError } = await supabaseAdmin
      .from('analyses')
      .select('user_id');

    if (countsError) {
      console.error('Error fetching analysis counts:', countsError);
      return NextResponse.json({ error: 'Failed to fetch analysis counts' }, { status: 500 });
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

    return NextResponse.json(usersWithCounts);
  } catch (error: any) {
    console.error('Error in GET /api/admin/users:', error);

    // Handle auth errors with appropriate status codes
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
