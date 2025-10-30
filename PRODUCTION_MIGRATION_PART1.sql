-- ============================================
-- LabelCheck Differential Migration - PART 1
-- Run this FIRST, then run PART 2
-- ============================================

-- ============================================
-- 1. ADD MISSING COLUMNS TO ANALYSES TABLE
-- ============================================

-- Add share_token column (for public sharing)
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_analyses_share_token
ON analyses(share_token) WHERE share_token IS NOT NULL;

-- Add product category enum type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_category_enum') THEN
    CREATE TYPE product_category_enum AS ENUM (
      'CONVENTIONAL_FOOD',
      'DIETARY_SUPPLEMENT',
      'ALCOHOLIC_BEVERAGE',
      'NON_ALCOHOLIC_BEVERAGE'
    );
  END IF;
END $$;

-- Add product category columns
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS product_category product_category_enum;

ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS category_rationale TEXT;

ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS is_category_ambiguous BOOLEAN DEFAULT false;

ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS alternative_categories TEXT[];

CREATE INDEX IF NOT EXISTS idx_analyses_product_category
ON analyses(product_category) WHERE product_category IS NOT NULL;

-- Add label_name column (user-editable product name)
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS label_name TEXT;

CREATE INDEX IF NOT EXISTS idx_analyses_label_name
ON analyses(label_name) WHERE label_name IS NOT NULL;

-- Add GIN index for full-text search on label_name
CREATE INDEX IF NOT EXISTS idx_analyses_label_name_gin
ON analyses USING gin(to_tsvector('english', COALESCE(label_name, '')));

-- ============================================
-- 2. ADD NEW PLAN TIER ENUM VALUES
-- ============================================

-- Add new enum values to plan_tier_type
DO $$
BEGIN
  -- Check if enum type exists, create if not
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier_type') THEN
    CREATE TYPE plan_tier_type AS ENUM ('basic', 'pro', 'enterprise');
  END IF;

  -- Add new values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'starter' AND enumtypid = 'plan_tier_type'::regtype) THEN
    ALTER TYPE plan_tier_type ADD VALUE 'starter';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'professional' AND enumtypid = 'plan_tier_type'::regtype) THEN
    ALTER TYPE plan_tier_type ADD VALUE 'professional';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'business' AND enumtypid = 'plan_tier_type'::regtype) THEN
    ALTER TYPE plan_tier_type ADD VALUE 'business';
  END IF;
END $$;

-- ============================================
-- 3. CREATE MISSING TABLES
-- ============================================

-- Create document_category_relations junction table
CREATE TABLE IF NOT EXISTS document_category_relations (
  document_id UUID REFERENCES regulatory_documents(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES document_categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (document_id, category_id)
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT true,
  theme TEXT DEFAULT 'light',
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- Create allergen_database table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS allergen_database (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allergen_name TEXT NOT NULL,
  derivative_name TEXT NOT NULL,
  alternative_names TEXT[],
  scientific_name TEXT,
  regulatory_source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(allergen_name, derivative_name)
);

CREATE INDEX IF NOT EXISTS idx_allergen_database_allergen
ON allergen_database(allergen_name);

CREATE INDEX IF NOT EXISTS idx_allergen_database_derivative
ON allergen_database(derivative_name);

CREATE INDEX IF NOT EXISTS idx_allergen_database_alt_names
ON allergen_database USING gin(alternative_names);

-- ============================================
-- 4. ADD MISSING COLUMNS TO OTHER TABLES
-- ============================================

-- Ensure regulatory_documents has all required columns
ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS document_type TEXT;

ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES document_categories(id);

ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS source_url TEXT;

ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS effective_date DATE;

ALTER TABLE regulatory_documents
ADD COLUMN IF NOT EXISTS version TEXT;

-- Ensure organizations has max_members column
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS max_members INTEGER DEFAULT 5;

-- ============================================
-- 5. UPDATE TRIGGER FUNCTIONS (SECURITY FIX)
-- ============================================

-- Update updated_at trigger function with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Apply trigger to tables that need it
DROP TRIGGER IF EXISTS update_analyses_updated_at ON analyses;
CREATE TRIGGER update_analyses_updated_at
  BEFORE UPDATE ON analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_regulatory_documents_updated_at ON regulatory_documents;
CREATE TRIGGER update_regulatory_documents_updated_at
  BEFORE UPDATE ON regulatory_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. ENABLE RLS ON NEW TABLES (IF NOT ENABLED)
-- ============================================

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_category_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE allergen_database ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_settings'
    AND policyname = 'Users can view their own settings'
  ) THEN
    CREATE POLICY "Users can view their own settings"
      ON user_settings FOR SELECT
      USING (auth.uid()::text = (SELECT clerk_user_id FROM users WHERE id = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_settings'
    AND policyname = 'Users can update their own settings'
  ) THEN
    CREATE POLICY "Users can update their own settings"
      ON user_settings FOR UPDATE
      USING (auth.uid()::text = (SELECT clerk_user_id FROM users WHERE id = user_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'user_settings'
    AND policyname = 'Users can insert their own settings'
  ) THEN
    CREATE POLICY "Users can insert their own settings"
      ON user_settings FOR INSERT
      WITH CHECK (auth.uid()::text = (SELECT clerk_user_id FROM users WHERE id = user_id));
  END IF;
END $$;

-- Create RLS policy for allergen_database (read-only for all authenticated users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'allergen_database'
    AND policyname = 'Authenticated users can read allergen database'
  ) THEN
    CREATE POLICY "Authenticated users can read allergen database"
      ON allergen_database FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

-- ============================================
-- PART 1 COMPLETE
-- ============================================

RAISE NOTICE 'Part 1 complete! New enum values added. Now run PART 2 to update existing records.';
