import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { Resend } from 'resend';
import { generateInvitationEmail } from '@/lib/email-templates';
import crypto from 'crypto';
import { logger, createRequestLogger } from '@/lib/logger';
import {
  handleApiError,
  ValidationError,
  AuthorizationError,
  handleSupabaseError,
} from '@/lib/error-handler';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/organizations/members' });

  try {
    // Get authenticated user (throws if not authenticated or not found)
    const { userInternalId } = await getAuthenticatedUser();
    requestLogger.info('Organization members fetch started', { userId: userInternalId });

    const currentUser = { id: userInternalId };

    // Get user's organization membership
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('organization_id, role')
      .eq('user_id', currentUser.id)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ members: [], pendingInvitations: [] }, { status: 200 });
    }

    // Fetch all members for the organization
    const { data: members, error: membersError } = await supabaseAdmin
      .from('organization_members')
      .select(
        `
        id,
        user_id,
        role,
        invited_at,
        joined_at,
        users!organization_members_user_id_fkey (email)
      `
      )
      .eq('organization_id', membership.organization_id);

    if (membersError) {
      throw handleSupabaseError(membersError, 'fetch organization members');
    }

    requestLogger.debug('Members fetched', {
      count: members?.length,
      organizationId: membership.organization_id,
    });

    // Fetch pending invitations
    const { data: pendingInvitations, error: invitationsError } = await supabaseAdmin
      .from('pending_invitations')
      .select('id, email, role, invited_at, expires_at')
      .eq('organization_id', membership.organization_id)
      .is('accepted_at', null);

    if (invitationsError) {
      requestLogger.warn('Failed to fetch pending invitations', {
        error: invitationsError,
        organizationId: membership.organization_id,
      });
    }

    requestLogger.debug('Pending invitations fetched', {
      count: pendingInvitations?.length,
      organizationId: membership.organization_id,
    });

    return NextResponse.json(
      {
        members: members || [],
        pendingInvitations: pendingInvitations || [],
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  const requestLogger = createRequestLogger({ endpoint: '/api/organizations/members' });

  try {
    // Get authenticated user (throws if not authenticated or not found)
    const { userInternalId } = await getAuthenticatedUser();
    requestLogger.info('Organization member invitation started', { userId: userInternalId });

    const currentUser = { id: userInternalId };

    const { organizationId, email, role } = await req.json();

    if (!email) {
      throw new ValidationError('Email is required', { field: 'email' });
    }

    // Check if current user is an owner or admin of the organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', currentUser.id)
      .single();

    const userRole = membership?.role;
    if (!membership || !['owner', 'admin'].includes(userRole)) {
      throw new AuthorizationError('Only owners and admins can manage members');
    }

    // Find the user to invite by email
    const { data: invitedUser, error: invitedUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (invitedUserError) {
      throw handleSupabaseError(invitedUserError, 'lookup invited user');
    }

    // Get organization details for email
    const { data: organization } = await supabaseAdmin
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    const { data: inviterDetails } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', currentUser.id)
      .single();

    if (invitedUser) {
      // User exists - add them directly as a member
      const { data: existingMember } = await supabaseAdmin
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', invitedUser.id)
        .maybeSingle();

      if (existingMember) {
        return NextResponse.json(
          { error: 'User is already a member of this organization' },
          { status: 400 }
        );
      }

      const { data: newMember, error: insertError } = await supabaseAdmin
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: invitedUser.id,
          role,
          invited_by: currentUser.id,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw handleSupabaseError(insertError, 'add member to organization');
      }

      requestLogger.info('Member added immediately to organization', {
        userId: invitedUser.id,
        organizationId,
        role,
      });

      return NextResponse.json({ ...newMember, type: 'immediate' }, { status: 201 });
    } else {
      // User doesn't exist - create pending invitation
      requestLogger.info('User not found, creating pending invitation', { email, organizationId });

      // Check if there's already a pending invitation
      const { data: existingInvitation } = await supabaseAdmin
        .from('pending_invitations')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('email', email)
        .maybeSingle();

      if (existingInvitation) {
        return NextResponse.json(
          { error: 'An invitation has already been sent to this email address' },
          { status: 400 }
        );
      }

      // Generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invitationUrl = `${appUrl}/accept-invitation?token=${invitationToken}`;

      // Create pending invitation
      const { data: pendingInvitation, error: invitationError } = await supabaseAdmin
        .from('pending_invitations')
        .insert({
          organization_id: organizationId,
          email,
          role,
          invited_by: currentUser.id,
          invitation_token: invitationToken,
        })
        .select()
        .single();

      if (invitationError) {
        throw handleSupabaseError(invitationError, 'create pending invitation');
      }

      // Send invitation email
      if (resend) {
        try {
          const emailHtml = generateInvitationEmail({
            organizationName: organization?.name || 'the organization',
            inviterName: inviterDetails?.email?.split('@')[0] || 'A team member',
            inviterEmail: inviterDetails?.email || '',
            role: role.charAt(0).toUpperCase() + role.slice(1),
            invitationUrl,
          });

          const result = await resend.emails.send({
            from: 'LabelCheck <noreply@app.labelcheck.io>',
            to: email,
            subject: `You've been invited to join ${organization?.name || 'an organization'} on LabelCheck`,
            html: emailHtml,
          });

          requestLogger.info('Invitation email sent successfully', {
            to: email,
            organizationId,
            invitationId: pendingInvitation.id,
          });
        } catch (err: unknown) {
          const emailError = err instanceof Error ? err : new Error(String(err));
          requestLogger.error('Failed to send invitation email', {
            error: emailError,
            message: emailError.message,
            email,
            organizationId,
          });
          // Don't fail the request if email fails
        }
      } else {
        requestLogger.warn('Resend API key not configured, skipping invitation email', { email });
      }

      requestLogger.info('Pending invitation created', {
        invitationId: pendingInvitation.id,
        email,
        organizationId,
      });

      return NextResponse.json({ ...pendingInvitation, type: 'pending' }, { status: 201 });
    }
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
