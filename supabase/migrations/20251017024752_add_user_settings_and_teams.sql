-- Add User Settings, Organizations, and Team Features
-- 
-- This migration adds comprehensive user settings, organization/team management,
-- and analysis export capabilities to support team collaboration and personalization.
--
-- Tables Created:
--
-- 1. user_settings - User preferences and notification settings
--    - notification_email_enabled: Email notifications for analysis results
--    - notification_analysis_complete: Notify on analysis completion
--    - notification_team_activity: Notify on team member activity
--    - notification_weekly_summary: Weekly usage summary emails
--    - default_export_format: Preferred export format (pdf, csv, json)
--    - theme_preference: UI theme (light, dark, system)
--    - timezone: User timezone for date displays
--
-- 2. organizations - Company/organization accounts
--    - name: Organization name
--    - slug: URL-friendly identifier
--    - billing_email: Primary billing contact
--    - plan_tier: Organization subscription level
--    - max_members: Maximum team members allowed
--    - created_by: Organization creator user_id
--
-- 3. organization_members - User membership in organizations
--    - organization_id: Reference to organizations
--    - user_id: Reference to users
--    - role: Member role (owner, admin, member, viewer)
--    - invited_by: User who sent invitation
--    - invited_at: Invitation timestamp
--    - joined_at: When user accepted invitation
--
-- 4. analysis_exports - Track export history
--    - analysis_id: Reference to analyses
--    - user_id: User who exported
--    - export_format: Format used (pdf, csv, json)
--    - file_url: Storage URL for export file
--    - exported_at: Export timestamp
--
-- Security:
-- - RLS enabled on all tables
-- - Users control their own settings
-- - Organization owners/admins manage teams
-- - Members can only view their organization data

-- Create role enum for organization members
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'organization_role_enum') THEN
    CREATE TYPE organization_role_enum AS ENUM ('owner', 'admin', 'member', 'viewer');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'export_format_enum') THEN
    CREATE TYPE export_format_enum AS ENUM ('pdf', 'csv', 'json');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'theme_preference_enum') THEN
    CREATE TYPE theme_preference_enum AS ENUM ('light', 'dark', 'system');
  END IF;
END $$;

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  notification_email_enabled BOOLEAN DEFAULT true,
  notification_analysis_complete BOOLEAN DEFAULT true,
  notification_team_activity BOOLEAN DEFAULT true,
  notification_weekly_summary BOOLEAN DEFAULT false,
  default_export_format export_format_enum DEFAULT 'pdf',
  theme_preference theme_preference_enum DEFAULT 'system',
  timezone TEXT DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  billing_email TEXT NOT NULL,
  plan_tier plan_tier_type DEFAULT 'basic',
  max_members INTEGER DEFAULT 5,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create organization_members table
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  role organization_role_enum DEFAULT 'member' NOT NULL,
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
);

-- Create analysis_exports table
CREATE TABLE IF NOT EXISTS analysis_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  export_format export_format_enum NOT NULL,
  file_url TEXT,
  file_size_bytes INTEGER,
  exported_at TIMESTAMPTZ DEFAULT now()
);

-- Add organization_id to analyses table for team sharing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyses' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE analyses ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_analysis_exports_analysis_id ON analysis_exports(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_exports_user_id ON analysis_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_exports_org_id ON analysis_exports(organization_id);
CREATE INDEX IF NOT EXISTS idx_analyses_organization_id ON analyses(organization_id);

-- Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_exports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_settings
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

-- RLS Policies for organizations
CREATE POLICY "Organization members can view their organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
    )
  );

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (created_by IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Organization owners and admins can update"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Only owners can delete organizations"
  ON organizations FOR DELETE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role = 'owner'
    )
  );

-- RLS Policies for organization_members
CREATE POLICY "Members can view their organization memberships"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
    )
  );

CREATE POLICY "Owners and admins can add members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update members"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can remove members"
  ON organization_members FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for analysis_exports
CREATE POLICY "Users can view their own exports"
  ON analysis_exports FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
    )
    OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
    )
  );

CREATE POLICY "Users can create exports"
  ON analysis_exports FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

-- Update analyses RLS to support organization access
DROP POLICY IF EXISTS "Users can view own analyses" ON analyses;

CREATE POLICY "Users can view own and organization analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
    )
    OR
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
      )
    )
  );

-- Add updated_at triggers
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_settings_updated_at') THEN
    CREATE TRIGGER update_user_settings_updated_at
      BEFORE UPDATE ON user_settings
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organizations_updated_at') THEN
    CREATE TRIGGER update_organizations_updated_at
      BEFORE UPDATE ON organizations
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_organization_members_updated_at') THEN
    CREATE TRIGGER update_organization_members_updated_at
      BEFORE UPDATE ON organization_members
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;