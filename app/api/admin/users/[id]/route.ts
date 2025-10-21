import { auth, clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    if (user.publicMetadata?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

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
    await supabaseAdmin
      .from('analyses')
      .delete()
      .eq('user_id', userIdToDelete);

    await supabaseAdmin
      .from('usage_tracking')
      .delete()
      .eq('user_id', userIdToDelete);

    await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userIdToDelete);

    await supabaseAdmin
      .from('user_settings')
      .delete()
      .eq('user_id', userIdToDelete);

    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', userIdToDelete);

    if (deleteError) {
      console.error('Error deleting user from Supabase:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete user from database' },
        { status: 500 }
      );
    }

    // Delete from Clerk
    try {
      await client.users.deleteUser(userToDelete.clerk_user_id);
    } catch (clerkError: any) {
      console.error('Error deleting user from Clerk:', clerkError);
      // Continue even if Clerk deletion fails - user is already deleted from DB
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/users/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
