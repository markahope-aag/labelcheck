# Team Invitation System

## Overview

The LabelCheck team invitation system allows organization owners and admins to invite new members to their organization via email. The system supports both existing users (who are added immediately) and new users (who receive an email invitation).

## Features

- **Email Invitations**: Send branded email invitations to team members
- **Secure Tokens**: Uses cryptographically secure random tokens for invitation links
- **Expiration**: Invitations automatically expire after 7 days
- **Role-Based**: Assign specific roles (owner, admin, member, viewer) to invitees
- **Pending Management**: View and cancel pending invitations
- **Dual Flow**: Immediate addition for existing users, email invitation for new users

## Setup Instructions

### 1. Database Migration

Run the pending invitations migration in your Supabase dashboard:

```sql
-- Execute the contents of: supabase-migrations/add-pending-invitations.sql
```

Or use the Supabase CLI:

```bash
supabase db push
```

### 2. Environment Variables

Ensure these environment variables are set in `.env.local`:

```env
# Required for sending invitation emails
RESEND_API_KEY=your_resend_api_key

# Required for invitation links
NEXT_PUBLIC_APP_URL=https://your-domain.com  # or http://localhost:3000 for development
```

### 3. Email Configuration

The system uses Resend for sending emails. Make sure you have:
1. A verified domain in Resend
2. Updated the sender email in `lib/resend.ts` to match your domain:
   ```typescript
   from: 'LabelCheck <noreply@app.labelcheck.io>'
   ```

## How It Works

### Invitation Flow for New Users

1. **Admin sends invitation**
   - Navigate to `/team`
   - Click "Invite Member"
   - Enter email and select role
   - Click "Send Invitation"

2. **System creates invitation**
   - Checks if user exists in database
   - If not found, creates pending invitation record
   - Generates secure invitation token
   - Sends branded email with invitation link

3. **User receives email**
   - Email contains invitation details
   - Click "Accept Invitation" button
   - Redirected to `/accept-invitation?token=xxx`

4. **User accepts invitation**
   - If not signed in: prompted to sign in or create account
   - After sign-in: automatically added to organization
   - Invitation marked as accepted
   - Redirected to team page

### Invitation Flow for Existing Users

1. **Admin sends invitation**
   - Same process as above

2. **System adds user immediately**
   - Checks if user exists in database
   - If found, adds directly to organization
   - No email sent (optional: could send notification)
   - Returns immediate success

## API Endpoints

### POST `/api/organizations/members`

Invite a new member to an organization.

**Request Body:**
```json
{
  "organizationId": "uuid",
  "email": "user@example.com",
  "role": "member"
}
```

**Response (Existing User):**
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid",
  "role": "member",
  "type": "immediate"
}
```

**Response (New User):**
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "email": "user@example.com",
  "role": "member",
  "invitation_token": "hex-string",
  "type": "pending"
}
```

### POST `/api/accept-invitation`

Accept a pending invitation.

**Request Body:**
```json
{
  "token": "invitation-token-from-url"
}
```

**Response:**
```json
{
  "message": "Successfully joined the organization!",
  "organizationName": "Acme Corp",
  "role": "member"
}
```

### DELETE `/api/organizations/invitations/[id]`

Cancel a pending invitation.

**Response:**
```json
{
  "message": "Invitation cancelled successfully"
}
```

## Database Schema

### `pending_invitations` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `organization_id` | UUID | Reference to organizations table |
| `email` | TEXT | Email address of invitee |
| `role` | TEXT | Role to assign (owner/admin/member/viewer) |
| `invited_by` | UUID | User who sent the invitation |
| `invitation_token` | TEXT | Unique token for invitation URL |
| `invited_at` | TIMESTAMPTZ | When invitation was sent |
| `expires_at` | TIMESTAMPTZ | When invitation expires (default: 7 days) |
| `accepted_at` | TIMESTAMPTZ | When invitation was accepted (NULL if pending) |

## Security Features

1. **Token Security**: Uses `crypto.randomBytes(32)` for secure token generation
2. **Email Verification**: Only the email address specified in the invitation can accept it
3. **Expiration**: Invitations automatically expire after 7 days
4. **RLS Policies**: Row Level Security ensures only org admins can manage invitations
5. **Unique Tokens**: Database constraint ensures tokens are unique
6. **One-Time Use**: Invitations can only be accepted once

## Email Template

The invitation email includes:
- Organization name
- Inviter's name and email
- Role being assigned
- Accept invitation button
- Expiration warning
- LabelCheck branding

Template located in: `lib/email-templates.ts` → `generateInvitationEmail()`

## Testing Checklist

- [ ] Run database migration successfully
- [ ] Create test organization
- [ ] Invite existing user (should add immediately)
- [ ] Invite new user email (should create pending invitation)
- [ ] Check pending invitation appears on team page
- [ ] Verify invitation email is received
- [ ] Click invitation link when logged out
- [ ] Sign up with invited email
- [ ] Verify automatic organization membership
- [ ] Check invitation marked as accepted
- [ ] Test invitation expiration (manually update expires_at)
- [ ] Test cancelling pending invitation
- [ ] Verify RLS policies work correctly

## Troubleshooting

### Email not sending
- Check `RESEND_API_KEY` is set correctly
- Verify domain is verified in Resend dashboard
- Check Resend API logs for errors
- Ensure sender email matches verified domain

### Invitation link not working
- Verify `NEXT_PUBLIC_APP_URL` is set correctly
- Check invitation hasn't expired
- Ensure token is correct (check pending_invitations table)
- Verify middleware allows `/accept-invitation` as public route

### User not added to organization
- Check RLS policies on organization_members table
- Verify email matches exactly (case-insensitive check in code)
- Ensure invitation hasn't been used already
- Check Supabase logs for errors

## Future Enhancements

- [ ] Resend invitation option
- [ ] Custom expiration periods
- [ ] Batch invitations
- [ ] Invitation acceptance notifications
- [ ] Usage analytics for invitations
- [ ] Email notifications for existing users
- [ ] Customizable email templates
