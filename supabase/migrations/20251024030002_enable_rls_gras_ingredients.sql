-- Security Fix: Enable RLS on gras_ingredients table

-- =====================================================
-- STEP 3: GRAS_INGREDIENTS TABLE
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

COMMENT ON POLICY "GRAS ingredients are publicly readable" ON gras_ingredients
  IS 'GRAS database is public FDA regulatory information';
