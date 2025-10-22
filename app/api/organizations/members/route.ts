import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Resend } from 'resend';
import { generateInvitationEmail } from '@/lib/email-templates';
import crypto from 'crypto';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current user from database
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 404 }
      );
    }

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
      .select(`
        id,
        user_id,
        role,
        invited_at,
        joined_at,
        users!organization_members_user_id_fkey (email)
      `)
      .eq('organization_id', membership.organization_id);

    if (membersError) {
      console.error('Error fetching members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch members' },
        { status: 500 }
      );
    }

    console.log('Members fetched:', { count: members?.length, members });

    // Fetch pending invitations
    const { data: pendingInvitations, error: invitationsError } = await supabaseAdmin
      .from('pending_invitations')
      .select('id, email, role, invited_at, expires_at')
      .eq('organization_id', membership.organization_id)
      .is('accepted_at', null);

    if (invitationsError) {
      console.error('Error fetching pending invitations:', invitationsError);
    }

    console.log('Pending invitations fetched:', { count: pendingInvitations?.length, pendingInvitations });

    return NextResponse.json({
      members: members || [],
      pendingInvitations: pendingInvitations || [],
    }, { status: 200 });
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organizationId, email, role } = await req.json();

    if (!organizationId || !email || !role) {
      return NextResponse.json(
        { error: 'Organization ID, email, and role are required' },
        { status: 400 }
      );
    }

    // Get current user from database
    const { data: currentUser, error: currentUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('clerk_user_id', userId)
      .single();

    if (currentUserError || !currentUser) {
      return NextResponse.json(
        { error: 'Current user not found' },
        { status: 404 }
      );
    }

    // Check if current user is an owner or admin of the organization
    const { data: membership } = await supabaseAdmin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', currentUser.id)
      .single();

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only organization owners and admins can invite members' },
        { status: 403 }
      );
    }

    // Find the user to invite by email
    const { data: invitedUser, error: invitedUserError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (invitedUserError) {
      console.error('Error looking up invited user:', invitedUserError);
      return NextResponse.json(
        { error: 'Error looking up user' },
        { status: 500 }
      );
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
        console.error('Error adding member:', insertError);
        return NextResponse.json(
          { error: 'Failed to add member' },
          { status: 500 }
        );
      }

      return NextResponse.json({ ...newMember, type: 'immediate' }, { status: 201 });
    } else {
      // User doesn't exist - create pending invitation
      console.log('User not found, creating pending invitation for:', email);

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
        console.error('Error creating pending invitation:', invitationError);
        return NextResponse.json(
          { error: 'Failed to create invitation' },
          { status: 500 }
        );
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

          console.log('Invitation email sent successfully:', { to: email, result });
        } catch (emailError: any) {
          console.error('Error sending invitation email:', {
            error: emailError,
            message: emailError?.message,
            statusCode: emailError?.statusCode,
            name: emailError?.name,
          });
          // Don't fail the request if email fails
        }
      } else {
        console.warn('Resend API key not configured, skipping email');
      }

      return NextResponse.json({ ...pendingInvitation, type: 'pending' }, { status: 201 });
    }
  } catch (error) {
    console.error('Error in member invitation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
