-- Create table for Old Dietary Ingredients (pre-October 15, 1994)
-- These are "grandfathered" ingredients under DSHEA that do NOT require NDI notifications

CREATE TABLE IF NOT EXISTS old_dietary_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ingredient_name TEXT NOT NULL UNIQUE,
  synonyms TEXT[], -- Array of alternate names
  source TEXT, -- e.g., "CRN Grandfather List 2024"
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Create indexes for fast lookups
CREATE INDEX idx_odi_ingredient_name ON old_dietary_ingredients(ingredient_name);
CREATE INDEX idx_odi_synonyms ON old_dietary_ingredients USING GIN(synonyms);
CREATE INDEX idx_odi_is_active ON old_dietary_ingredients(is_active);

-- Create updated_at trigger
CREATE TRIGGER update_old_dietary_ingredients_updated_at
  BEFORE UPDATE ON old_dietary_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE old_dietary_ingredients ENABLE ROW LEVEL SECURITY;

-- Allow public read access (authenticated users can view)
CREATE POLICY "Allow public read access to old dietary ingredients"
  ON old_dietary_ingredients
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admins can insert/update/delete
CREATE POLICY "Only admins can manage old dietary ingredients"
  ON old_dietary_ingredients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.clerk_user_id = auth.jwt()->>'sub'
      AND users.is_system_admin = true
    )
  );

-- Add helpful comment
COMMENT ON TABLE old_dietary_ingredients IS 'Dietary ingredients marketed before October 15, 1994 that are grandfathered under DSHEA and do not require NDI notifications';
