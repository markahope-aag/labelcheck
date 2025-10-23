-- Create NDI (New Dietary Ingredients) table
CREATE TABLE IF NOT EXISTS ndi_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_number INTEGER UNIQUE NOT NULL,
  report_number TEXT,
  ingredient_name TEXT NOT NULL,
  firm TEXT,
  submission_date DATE,
  fda_response_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_name ON ndi_ingredients(ingredient_name);

CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_notification_number ON ndi_ingredients(notification_number);

CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_name_search ON ndi_ingredients USING gin(to_tsvector('english', ingredient_name));

-- Enable RLS
ALTER TABLE ndi_ingredients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "NDI ingredients are publicly readable" ON ndi_ingredients;
DROP POLICY IF EXISTS "Admins can manage NDI ingredients" ON ndi_ingredients;

-- Create read policy for authenticated users
CREATE POLICY "NDI ingredients are publicly readable"
  ON ndi_ingredients
  FOR SELECT
  TO authenticated
  USING (true);

-- Create admin management policy
CREATE POLICY "Admins can manage NDI ingredients"
  ON ndi_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_user_id = auth.jwt() ->> 'sub'
      AND users.role = 'admin'
    )
  );
