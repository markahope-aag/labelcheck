import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = params.id;

    // Get current user and verify they are a system admin
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id, is_system_admin')
      .eq('clerk_user_id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 404 }
      );
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
      return NextResponse.json(
        { error: 'Target user not found' },
        { status: 404 }
      );
    }

    // Toggle admin status
    const newAdminStatus = !targetUser.is_system_admin;

    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_system_admin: newAdminStatus })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Error updating admin status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update admin status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      is_system_admin: newAdminStatus,
      email: targetUser.email,
    }, { status: 200 });
  } catch (error) {
    console.error('Error in toggle admin:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
