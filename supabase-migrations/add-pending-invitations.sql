-- Create pending_invitations table for team invitation workflow
CREATE TABLE IF NOT EXISTS pending_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitation_token TEXT NOT NULL UNIQUE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pending_invitations_token ON pending_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_email ON pending_invitations(email);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_org ON pending_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_pending_invitations_accepted ON pending_invitations(accepted_at) WHERE accepted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pending_invitations
-- Organization owners and admins can view all invitations for their org
CREATE POLICY "Organization admins can view pending invitations"
  ON pending_invitations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_invitations.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Organization owners and admins can create invitations
CREATE POLICY "Organization admins can create invitations"
  ON pending_invitations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_invitations.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Organization owners and admins can update invitations (e.g., mark as accepted)
CREATE POLICY "Organization admins can update invitations"
  ON pending_invitations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_invitations.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Organization owners and admins can delete invitations
CREATE POLICY "Organization admins can delete invitations"
  ON pending_invitations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members
      WHERE organization_members.organization_id = pending_invitations.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.role IN ('owner', 'admin')
    )
  );

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pending_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on changes
CREATE TRIGGER update_pending_invitations_timestamp
  BEFORE UPDATE ON pending_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_pending_invitations_updated_at();

-- Add comment to table
COMMENT ON TABLE pending_invitations IS 'Stores pending organization invitations for users who have not yet signed up';
COMMENT ON COLUMN pending_invitations.invitation_token IS 'Unique token used in invitation URL';
COMMENT ON COLUMN pending_invitations.expires_at IS 'Invitation expiry date (default 7 days from creation)';
COMMENT ON COLUMN pending_invitations.accepted_at IS 'Timestamp when invitation was accepted (NULL if pending)';
