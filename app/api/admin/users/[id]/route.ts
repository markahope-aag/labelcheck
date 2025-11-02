import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';
import { logger, createRequestLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/users/[id]' });

  try {
    // Require admin access (throws if not admin)
    await requireAdmin();
    requestLogger.info('Admin user deletion started');

    const resolvedParams = await params;
    const userIdToDelete = resolvedParams.id;

    // Get user to find their clerk_user_id
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id')
      .eq('id', userIdToDelete)
      .single();

    if (fetchError || !userToDelete) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete from Supabase (cascading deletes will handle related records)
    // Delete in order: analyses, usage_tracking, subscriptions, user_settings, then user
    await supabaseAdmin.from('analyses').delete().eq('user_id', userIdToDelete);

    await supabaseAdmin.from('usage_tracking').delete().eq('user_id', userIdToDelete);

    await supabaseAdmin.from('subscriptions').delete().eq('user_id', userIdToDelete);

    await supabaseAdmin.from('user_settings').delete().eq('user_id', userIdToDelete);

    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userIdToDelete);

    if (deleteError) {
      requestLogger.error('Failed to delete user from Supabase', {
        error: deleteError,
        userId: userIdToDelete,
      });
      return NextResponse.json({ error: 'Failed to delete user from database' }, { status: 500 });
    }

    // Delete from Clerk
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userToDelete.clerk_user_id);
      requestLogger.info('User deleted from Clerk', {
        userId: userIdToDelete,
        clerkUserId: userToDelete.clerk_user_id,
      });
    } catch (clerkError: any) {
      requestLogger.error('Failed to delete user from Clerk', {
        error: clerkError,
        userId: userIdToDelete,
        clerkUserId: userToDelete.clerk_user_id,
      });
      // Continue even if Clerk deletion fails - user is already deleted from DB
    }

    requestLogger.info('User deleted successfully', { userId: userIdToDelete });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    requestLogger.error('Admin user deletion failed', { error, message: error.message });

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
