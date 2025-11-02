import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

    const currentDate = new Date();
    const currentMonth = currentDate.toISOString().slice(0, 7);
    const firstDayOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    ).toISOString();

    // Get total users
    const { count: totalUsers } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get new users this month
    const { count: newUsersThisMonth } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstDayOfMonth);

    // Get active subscriptions
    const { count: activeSubscriptions } = await supabaseAdmin
      .from('subscriptions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Get total analyses
    const { count: totalAnalyses } = await supabaseAdmin
      .from('analyses')
      .select('*', { count: 'exact', head: true });

    // Get analyses this month
    const { count: analysesThisMonth } = await supabaseAdmin
      .from('analyses')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', firstDayOfMonth);

    // Calculate monthly revenue (this is a simplified calculation)
    // In production, you'd query Stripe for actual revenue
    const { data: subscriptionsData } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_tier')
      .eq('status', 'active');

    let monthlyRevenue = 0;
    subscriptionsData?.forEach((sub) => {
      switch (sub.plan_tier) {
        case 'basic':
          monthlyRevenue += 29;
          break;
        case 'pro':
          monthlyRevenue += 99;
          break;
        case 'enterprise':
          monthlyRevenue += 299;
          break;
      }
    });

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeSubscriptions: activeSubscriptions || 0,
      totalAnalyses: totalAnalyses || 0,
      monthlyRevenue,
      newUsersThisMonth: newUsersThisMonth || 0,
      analysesThisMonth: analysesThisMonth || 0,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/stats:', error);

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
