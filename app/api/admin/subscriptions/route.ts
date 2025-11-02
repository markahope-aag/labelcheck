import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/subscriptions' });

  try {
    const { userId } = await auth();

    if (!userId) {
      requestLogger.warn('Unauthorized subscriptions fetch attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestLogger.info('Admin subscriptions fetch started', { userId });

    // Check if user is system admin in database
    const { data: currentUser } = await supabaseAdmin
      .from('users')
      .select('is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (!currentUser?.is_system_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

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
      requestLogger.error('Failed to fetch subscriptions', { error });
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 });
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
  } catch (error: any) {
    requestLogger.error('Admin subscriptions fetch failed', { error, message: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
