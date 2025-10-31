import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin access (throws if not admin)
    await requireAdmin();

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
      const client = await clerkClient();
      await client.users.deleteUser(userToDelete.clerk_user_id);
    } catch (clerkError: any) {
      console.error('Error deleting user from Clerk:', clerkError);
      // Continue even if Clerk deletion fails - user is already deleted from DB
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/users/[id]:', error);

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
