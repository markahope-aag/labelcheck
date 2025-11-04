import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  NotFoundError,
  handleSupabaseError,
} from '@/lib/error-handler';
import type { PendingInvitation } from '@/types';

/**
 * Type for pending invitation with joined organization data from Supabase query
 */
interface InvitationWithOrganization extends PendingInvitation {
  organizations: {
    id: string;
    name: string;
  } | null;
}

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/accept-invitation' });

  try {
    const { userId } = await auth();
    if (!userId) {
      requestLogger.warn('Unauthorized invitation acceptance attempt');
      return NextResponse.json({ error: 'Unauthorized - Please sign in first' }, { status: 401 });
    }

    requestLogger.info('Invitation acceptance request started', { userId });

    const { token } = await req.json();

    if (!token) {
      throw new ValidationError('Invitation token is required', { field: 'token' });
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

    requestLogger.debug('Current user lookup', { userId, currentUser, currentUserError });

    if (currentUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 });
    }

    // Find the pending invitation
    const { data: invitation, error: invitationError } = (await supabaseAdmin
      .from('pending_invitations')
      .select(
        `
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
      `
      )
      .eq('invitation_token', token)
      .maybeSingle()) as { data: InvitationWithOrganization | null; error: any };

    if (invitationError) {
      throw handleSupabaseError(invitationError, 'fetch invitation');
    }

    if (!invitation) {
      throw new NotFoundError('Invitation', token);
    }

    // Check if invitation has already been accepted
    if (invitation.accepted_at) {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 400 });
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
    requestLogger.debug('Email comparison', {
      invitationEmail: invitation.email,
      clerkEmail: userEmail,
      match: invitation.email.toLowerCase() === userEmail.toLowerCase(),
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
          organizationName: invitation.organizations?.name,
          role: invitation.role,
        },
        { status: 200 }
      );
    }

    // Add user to organization
    requestLogger.info('Adding user to organization', {
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

    requestLogger.debug('Member insertion result', { newMember, memberError });

    if (memberError) {
      throw handleSupabaseError(memberError, 'add member to organization');
    }

    // Mark invitation as accepted
    const { error: updateError } = await supabaseAdmin
      .from('pending_invitations')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invitation.id);

    if (updateError) {
      requestLogger.warn('Failed to update invitation status', {
        error: updateError,
        invitationId: invitation.id,
      });
      // Don't fail the request as the user was already added
    }

    requestLogger.info('Invitation accepted successfully', {
      userId: currentUser.id,
      organizationId: invitation.organization_id,
      organizationName: invitation.organizations?.name,
      role: invitation.role,
    });

    return NextResponse.json(
      {
        message: 'Successfully joined the organization!',
        organizationName: invitation.organizations?.name,
        role: invitation.role,
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
