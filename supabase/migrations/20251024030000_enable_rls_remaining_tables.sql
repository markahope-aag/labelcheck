-- Security Fix: Enable RLS on remaining public tables
-- This migration addresses the remaining 3 tables that still need RLS enabled

-- =====================================================
-- STEP 1: ORGANIZATION_MEMBERS TABLE
-- =====================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;

-- Allow users to view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Allow owners and admins to manage organization members
CREATE POLICY "Organization owners and admins can manage members"
  ON organization_members
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
  );

-- Allow users to insert themselves as members (for accepting invitations)
CREATE POLICY "Users can insert themselves as members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

COMMENT ON POLICY "Users can view members of their organizations" ON organization_members
  IS 'Users can only see members of organizations they belong to';
