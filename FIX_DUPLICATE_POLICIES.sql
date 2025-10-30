-- ============================================
-- Fix Duplicate Policy Warning
-- Remove overlapping policies on old_dietary_ingredients
-- ============================================

-- Drop all existing policies on old_dietary_ingredients
DROP POLICY IF EXISTS "Admins can manage old dietary ingredients" ON old_dietary_ingredients;
DROP POLICY IF EXISTS "Authenticated users can read old dietary ingredients" ON old_dietary_ingredients;
DROP POLICY IF EXISTS "Allow public read access to old dietary ingredients" ON old_dietary_ingredients;
DROP POLICY IF EXISTS "Only admins can manage old dietary ingredients" ON old_dietary_ingredients;

-- Create single, simple read policy for all authenticated users
-- (This table is regulatory data - everyone should be able to read it)
CREATE POLICY "Allow authenticated read access"
  ON old_dietary_ingredients FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check policy count (should be exactly 1)
SELECT
  'Policy Count Check' as check_type,
  COUNT(*) as policy_count,
  CASE
    WHEN COUNT(*) = 1 THEN '✅ CORRECT - Single policy'
    ELSE '❌ ISSUE - Multiple policies still exist'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'old_dietary_ingredients';

-- Show the policy
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as command,
  qual as using_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'old_dietary_ingredients';

DO $$
BEGIN
  RAISE NOTICE '✅ Duplicate policy warning fixed!';
END $$;
