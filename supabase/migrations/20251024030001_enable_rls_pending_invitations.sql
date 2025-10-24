-- Security Fix: Enable RLS on pending_invitations table

-- =====================================================
-- STEP 2: PENDING_INVITATIONS TABLE
-- =====================================================

ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view invitations for their email" ON pending_invitations;
DROP POLICY IF EXISTS "Organization owners and admins can manage invitations" ON pending_invitations;

-- Allow users to view invitations sent to their email
CREATE POLICY "Users can view invitations for their email"
  ON pending_invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_email IN (
      SELECT email FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Allow organization owners and admins to create and manage invitations
CREATE POLICY "Organization owners and admins can manage invitations"
  ON pending_invitations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  );

COMMENT ON POLICY "Users can view invitations for their email" ON pending_invitations
  IS 'Users can only see invitations sent to their email address';
