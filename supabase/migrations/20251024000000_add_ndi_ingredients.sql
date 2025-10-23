-- Create NDI (New Dietary Ingredients) database table
-- This tracks all New Dietary Ingredients that have been reported to the FDA
-- Any dietary ingredient not marketed before October 15, 1994 requires an NDI notification

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

-- Create index for fast ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_name ON ndi_ingredients(ingredient_name);
CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_notification_number ON ndi_ingredients(notification_number);

-- Add full-text search capability for ingredient names
CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_name_search ON ndi_ingredients
USING gin(to_tsvector('english', ingredient_name));

-- Enable Row Level Security
ALTER TABLE ndi_ingredients ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all users to read NDI data (public regulatory information)
CREATE POLICY "NDI ingredients are publicly readable"
  ON ndi_ingredients
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for admins to manage NDI data
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

COMMENT ON TABLE ndi_ingredients IS 'FDA New Dietary Ingredients Database - ingredients requiring NDI notification per DSHEA 1994';
COMMENT ON COLUMN ndi_ingredients.notification_number IS 'FDA-assigned NDI notification number';
COMMENT ON COLUMN ndi_ingredients.ingredient_name IS 'Name of the new dietary ingredient as reported to FDA';
COMMENT ON COLUMN ndi_ingredients.submission_date IS 'Date the NDI notification was submitted to FDA';
COMMENT ON COLUMN ndi_ingredients.fda_response_date IS 'Date FDA responded to the notification';
