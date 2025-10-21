import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    // Get all users with their subscriptions and analysis counts
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        *,
        subscriptions (
          plan_tier,
          status
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
    }

    // Get analysis counts for each user
    const usersWithCounts = await Promise.all(
      (users || []).map(async (user) => {
        const { count } = await supabaseAdmin
          .from('analyses')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        return {
          ...user,
          subscription: user.subscriptions?.[0] || null,
          analyses_count: count || 0,
        };
      })
    );

    return NextResponse.json(usersWithCounts);
  } catch (error: any) {
    console.error('Error in GET /api/admin/users:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
