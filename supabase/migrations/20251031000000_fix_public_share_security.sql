-- Security Fix: Add RLS policy for public share links
-- Addresses critical bug where /share/[token] fails for unauthenticated users

-- =====================================================
-- ANALYSES TABLE - PUBLIC SHARE ACCESS
-- =====================================================

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Public can view shared analyses" ON analyses;

-- Allow BOTH authenticated AND anonymous users to view analyses with share tokens
-- This enables the /share/[token] page to work for unauthenticated users
CREATE POLICY "Public can view shared analyses"
  ON analyses
  FOR SELECT
  TO anon, authenticated
  USING (share_token IS NOT NULL);

-- Add comment for documentation
COMMENT ON POLICY "Public can view shared analyses" ON analyses
  IS 'Allows public access to analyses that have been shared via share_token. Required for /share/[token] page to work for unauthenticated users.';

-- =====================================================
-- VERIFICATION QUERY (for testing)
-- =====================================================
-- Run this to verify the policy works:
--
-- SELECT EXISTS (
--   SELECT 1 FROM pg_policies
--   WHERE tablename = 'analyses'
--   AND policyname = 'Public can view shared analyses'
-- ) AS policy_exists;
