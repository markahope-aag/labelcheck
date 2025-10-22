import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized - Please sign in first' }, { status: 401 });
    }

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Invitation token is required' }, { status: 400 });
    }

    // Get current user's email from Clerk (source of truth)
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const userEmail = clerkUser.emailAddresses.find(
      (email) => email.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    }

    // Get current user from database
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    console.log('Current user lookup:', { userId, currentUser, currentUserError });

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Find the pending invitation
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('pending_invitations')
      .select(`
        id,
        organization_id,
        email,
        role,
        invited_by,
        invited_at,
        expires_at,
        accepted_at,
        organizations (
          id,
          name
        )
      `)
      .eq('invitation_token', token)
      .maybeSingle();

    if (invitationError) {
      console.error('Error fetching invitation:', invitationError);
      return NextResponse.json({ error: 'Error processing invitation' }, { status: 500 });
    }

    if (!invitation) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 404 });
    }

    // Check if invitation has already been accepted
    if (invitation.accepted_at) {
      return NextResponse.json(
        { error: 'This invitation has already been used' },
        { status: 400 }
      );
    }

    // Check if invitation has expired
    const expiresAt = new Date(invitation.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'This invitation has expired. Please request a new invitation.' },
        { status: 410 }
      );
    }

    // Log email comparison for debugging (but don't block if they don't match)
    // Since the user has the invitation token (which is secret), we trust they have access
    console.log('Email comparison:', {
      invitationEmail: invitation.email,
      clerkEmail: userEmail,
      match: invitation.email.toLowerCase() === userEmail.toLowerCase()
    });

    // Check if user is already a member
    const { data: existingMember } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('organization_id', invitation.organization_id)
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (existingMember) {
      // Mark invitation as accepted even though they're already a member
      await supabaseAdmin
        .from('pending_invitations')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);

      return NextResponse.json(
        {
          message: 'You are already a member of this organization',
          organizationName: (invitation.organizations as any)?.name,
          role: invitation.role,
        },
        { status: 200 }
      );
    }

    // Add user to organization
    console.log('Adding user to organization:', {
      organization_id: invitation.organization_id,
      user_id: currentUser.id,
      role: invitation.role,
      invited_by: invitation.invited_by,
    });

    const { data: newMember, error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        organization_id: invitation.organization_id,
        user_id: currentUser.id,
        role: invitation.role,
        invited_by: invitation.invited_by,
        joined_at: new Date().toISOString(),
      })
      .select();

    console.log('Member insertion result:', { newMember, memberError });

    if (memberError) {
      console.error('Error adding member:', memberError);
      return NextResponse.json(
        { error: 'Failed to add you to the organization' },
        { status: 500 }
      );
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from('pending_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Don't fail the request as the user was already added
    }

    return NextResponse.json(
      {
        message: 'Successfully joined the organization!',
        organizationName: (invitation.organizations as any)?.name,
        role: invitation.role,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
