import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const requestLogger = createRequestLogger({ endpoint: '/api/admin/users/[id]/toggle-admin' });

  try {
    const { userId } = await auth();
    if (!userId) {
      requestLogger.warn('Unauthorized admin toggle attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    requestLogger.info('Admin toggle request started', { userId });

    const targetUserId = params.id;

    // Get current user and verify they are a system admin
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id, is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'Current user not found' }, { status: 404 });
    }

    if (!currentUser.is_system_admin) {
      return NextResponse.json(
        { error: 'Only system administrators can manage admin roles' },
        { status: 403 }
      );
    }

    // Prevent user from removing their own admin rights
    if (currentUser.id === targetUserId) {
      return NextResponse.json(
        { error: 'You cannot modify your own admin status' },
        { status: 400 }
      );
    }

    // Get target user
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('users')
      .select('id, email, is_system_admin')
      .eq('id', targetUserId)
      .single();

    if (targetUserError || !targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // Toggle admin status
    const newAdminStatus = !targetUser.is_system_admin;

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_system_admin: newAdminStatus })
      .eq('id', targetUserId);

    if (updateError) {
      requestLogger.error('Failed to update admin status', {
        error: updateError,
        targetUserId: targetUserId,
        newAdminStatus,
      });
      return NextResponse.json({ error: 'Failed to update admin status' }, { status: 500 });
    }

    requestLogger.info('Admin status toggled successfully', {
      targetUserId,
      targetUserEmail: targetUser.email,
      newAdminStatus,
      toggledBy: userId,
    });

    return NextResponse.json(
      {
        success: true,
        is_system_admin: newAdminStatus,
        email: targetUser.email,
      },
      { status: 200 }
    );
  } catch (error) {
    requestLogger.error('Admin toggle failed', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
