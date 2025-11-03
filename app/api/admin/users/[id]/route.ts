import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  handleSupabaseError,
} from '@/lib/error-handler';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/users/[id]' });

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

    const resolvedParams = await params;
    const userIdToDelete = resolvedParams.id;

    requestLogger.info('Admin user deletion started');

    // Get user to find their clerk_user_id
    const { data: userToDelete, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('clerk_user_id')
      .eq('id', userIdToDelete)
      .single();

    if (fetchError) {
      throw handleSupabaseError(fetchError, 'fetch user');
    }

    if (!userToDelete) {
      throw new NotFoundError('User', userIdToDelete);
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
      throw handleSupabaseError(deleteError, 'delete user from database');
    }

    // Delete from Clerk
    try {
      const client = await clerkClient();
      await client.users.deleteUser(userToDelete.clerk_user_id);
      requestLogger.info('User deleted from Clerk', {
        userId: userIdToDelete,
        clerkUserId: userToDelete.clerk_user_id,
      });
    } catch (err: unknown) {
      const clerkError = err instanceof Error ? err : new Error(String(err));
      requestLogger.error('Failed to delete user from Clerk', {
        error: clerkError,
        userId: userIdToDelete,
        clerkUserId: userToDelete.clerk_user_id,
      });
      // Continue even if Clerk deletion fails - user is already deleted from DB
    }

    requestLogger.info('User deleted successfully', { userId: userIdToDelete });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
