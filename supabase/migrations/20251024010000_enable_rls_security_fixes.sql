-- Security Fix: Enable RLS on all public tables
-- Addresses Supabase security lints for RLS disabled in public schema

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Allow users to view organizations they are members of
CREATE POLICY "Users can view organizations they are members of"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Allow organization owners to update their organizations
CREATE POLICY "Organization owners can update their organizations"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role = 'owner'
    )
  );

-- Allow authenticated users to create organizations
CREATE POLICY "Users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 2. ORGANIZATION_MEMBERS TABLE
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

-- =====================================================
-- 3. PENDING_INVITATIONS TABLE
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

-- =====================================================
-- 4. GRAS_INGREDIENTS TABLE
-- =====================================================

ALTER TABLE gras_ingredients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "GRAS ingredients are publicly readable" ON gras_ingredients;
DROP POLICY IF EXISTS "Admins can manage GRAS ingredients" ON gras_ingredients;

-- Allow all authenticated users to read GRAS ingredients (public regulatory data)
CREATE POLICY "GRAS ingredients are publicly readable"
  ON gras_ingredients
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to manage GRAS ingredients
CREATE POLICY "Admins can manage GRAS ingredients"
  ON gras_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_user_id = auth.jwt() ->> 'sub'
      AND users.role = 'admin'
    )
  );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Users can view organizations they are members of" ON organizations
  IS 'Users can only see organizations where they are members';

COMMENT ON POLICY "Users can view members of their organizations" ON organization_members
  IS 'Users can only see members of organizations they belong to';

COMMENT ON POLICY "Users can view invitations for their email" ON pending_invitations
  IS 'Users can only see invitations sent to their email address';

COMMENT ON POLICY "GRAS ingredients are publicly readable" ON gras_ingredients
  IS 'GRAS database is public FDA regulatory information';
