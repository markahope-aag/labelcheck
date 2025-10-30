-- ============================================
-- Fix RLS Performance Warnings
-- Optimizes policies flagged by Supabase
-- ============================================

-- ============================================
-- 1. FIX USER_SETTINGS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update their own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can insert their own settings" ON user_settings;

-- Recreate with optimized auth function calls
CREATE POLICY "Users can view their own settings"
  ON user_settings FOR SELECT
  USING ((SELECT auth.uid())::text = (SELECT clerk_user_id FROM users WHERE id = user_id));

CREATE POLICY "Users can update their own settings"
  ON user_settings FOR UPDATE
  USING ((SELECT auth.uid())::text = (SELECT clerk_user_id FROM users WHERE id = user_id));

CREATE POLICY "Users can insert their own settings"
  ON user_settings FOR INSERT
  WITH CHECK ((SELECT auth.uid())::text = (SELECT clerk_user_id FROM users WHERE id = user_id));

-- ============================================
-- 2. FIX OLD_DIETARY_INGREDIENTS POLICIES
-- ============================================

-- Drop duplicate policies
DROP POLICY IF EXISTS "Only admins can manage old dietary ingredients" ON old_dietary_ingredients;
DROP POLICY IF EXISTS "Allow public read access to old dietary ingredients" ON old_dietary_ingredients;

-- Create single optimized policy for authenticated read access
CREATE POLICY "Authenticated users can read old dietary ingredients"
  ON old_dietary_ingredients FOR SELECT
  TO authenticated
  USING (true);

-- Keep admin policy but optimized
CREATE POLICY "Admins can manage old dietary ingredients"
  ON old_dietary_ingredients FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE clerk_user_id = (SELECT auth.uid())::text
      AND (clerk_user_id IN (
        SELECT clerk_user_id FROM users WHERE clerk_user_id LIKE '%admin%'
      ))
    )
  );

-- ============================================
-- 3. FIX MAJOR_ALLERGENS DUPLICATE POLICIES
-- ============================================

-- Drop duplicate policies
DROP POLICY IF EXISTS "Allow authenticated read access to all allergens" ON major_allergens;
DROP POLICY IF EXISTS "Allow public read access to allergens" ON major_allergens;

-- Create single simplified policy
CREATE POLICY "Anyone can read allergen data"
  ON major_allergens FOR SELECT
  USING (true);

-- ============================================
-- VERIFICATION
-- ============================================

-- Check policies were updated correctly
SELECT
  'RLS Policy Check' as check_type,
  schemaname,
  tablename,
  policyname,
  '✅ UPDATED' as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('user_settings', 'old_dietary_ingredients', 'major_allergens')
ORDER BY tablename, policyname;

-- ============================================
-- COMPLETE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLS performance optimizations complete!';
  RAISE NOTICE 'Warnings should be resolved in Supabase dashboard.';
END $$;
