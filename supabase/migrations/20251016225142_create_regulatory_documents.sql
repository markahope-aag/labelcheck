/*
  # Regulatory Documents Management System

  ## Overview
  This migration creates a system for managing regulatory documents, rules, and guidelines
  that are used by the AI to evaluate food labels. Documents can be updated periodically
  as regulations change.

  ## Tables Created

  ### 1. regulatory_documents
  Stores regulatory documents, rules, and guidelines for food label compliance
  - id: Unique document identifier (UUID)
  - title: Document title/name
  - description: Brief description of the document's purpose
  - content: Full text content of the regulatory document
  - document_type: Type of document (federal_law, state_regulation, guideline, standard)
  - jurisdiction: Geographic scope (US, EU, state name, etc.)
  - source: Official source/authority (FDA, USDA, etc.)
  - effective_date: Date when regulation becomes effective
  - version: Version number or identifier
  - is_active: Whether this document is currently used in analysis
  - created_at: Document upload timestamp
  - updated_at: Last update timestamp
  - created_by: User who uploaded/created the document

  ### 2. document_categories
  Categorizes regulatory documents for easier management
  - id: Unique category identifier
  - name: Category name
  - description: Category description
  - created_at: Creation timestamp

  ### 3. document_category_relations
  Many-to-many relationship between documents and categories
  - document_id: Reference to regulatory_documents
  - category_id: Reference to document_categories

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Only authenticated admin users can create/update/delete documents
  - All authenticated users can read active documents
  - Policies enforce proper authorization

  ## Important Notes
  - Documents can be versioned and archived (is_active = false)
  - Full-text search enabled on content for efficient retrieval
  - Indexes added for common query patterns
*/

-- Create document type enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_type_enum') THEN
    CREATE TYPE document_type_enum AS ENUM (
      'federal_law',
      'state_regulation', 
      'guideline',
      'standard',
      'policy',
      'other'
    );
  END IF;
END $$;

-- Create document_categories table
CREATE TABLE IF NOT EXISTS document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create regulatory_documents table
CREATE TABLE IF NOT EXISTS regulatory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  document_type document_type_enum NOT NULL DEFAULT 'guideline',
  jurisdiction TEXT NOT NULL,
  source TEXT,
  effective_date DATE,
  version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by TEXT
);

-- Create document_category_relations junction table
CREATE TABLE IF NOT EXISTS document_category_relations (
  document_id UUID REFERENCES regulatory_documents(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES document_categories(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (document_id, category_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_active ON regulatory_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_type ON regulatory_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_jurisdiction ON regulatory_documents(jurisdiction);
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_effective_date ON regulatory_documents(effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_document_categories_name ON document_categories(name);

-- Enable full-text search on document content
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_content_search 
  ON regulatory_documents USING gin(to_tsvector('english', content));

CREATE INDEX IF NOT EXISTS idx_regulatory_documents_title_search 
  ON regulatory_documents USING gin(to_tsvector('english', title));

-- Enable Row Level Security
ALTER TABLE regulatory_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_category_relations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for regulatory_documents table
-- All authenticated users can view active documents
CREATE POLICY "Authenticated users can view active documents"
  ON regulatory_documents FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Only admin users can insert documents (check for admin role in user metadata)
CREATE POLICY "Admin users can insert documents"
  ON regulatory_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  );

-- Only admin users can update documents
CREATE POLICY "Admin users can update documents"
  ON regulatory_documents FOR UPDATE
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  );

-- Only admin users can delete documents
CREATE POLICY "Admin users can delete documents"
  ON regulatory_documents FOR DELETE
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  );

-- RLS Policies for document_categories table
CREATE POLICY "Authenticated users can view categories"
  ON document_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage categories"
  ON document_categories FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  );

-- RLS Policies for document_category_relations table
CREATE POLICY "Authenticated users can view category relations"
  ON document_category_relations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can manage category relations"
  ON document_category_relations FOR ALL
  TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  )
  WITH CHECK (
    (current_setting('request.jwt.claims', true)::json->'app_metadata'->>'role') = 'admin'
  );

-- Add updated_at trigger for regulatory_documents
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_regulatory_documents_updated_at') THEN
    CREATE TRIGGER update_regulatory_documents_updated_at
      BEFORE UPDATE ON regulatory_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Insert default categories
INSERT INTO document_categories (name, description) VALUES
  ('Nutrition Labeling', 'Requirements for nutrition facts panels and labeling'),
  ('Ingredient Lists', 'Rules for ingredient declarations and ordering'),
  ('Allergen Information', 'Allergen labeling requirements and warnings'),
  ('Health Claims', 'Regulations for health and nutrient content claims'),
  ('Package Size', 'Serving size and package size requirements'),
  ('Warnings', 'Required warning statements and disclosures'),
  ('Organic Standards', 'Organic certification and labeling rules'),
  ('Country of Origin', 'Origin labeling requirements'),
  ('General Requirements', 'General food labeling regulations')
ON CONFLICT (name) DO NOTHING;

-- Insert sample regulatory documents
INSERT INTO regulatory_documents (
  title,
  description,
  content,
  document_type,
  jurisdiction,
  source,
  effective_date,
  version,
  is_active
) VALUES
(
  'FDA Nutrition Labeling Requirements',
  'Core FDA requirements for nutrition facts labels on packaged foods',
  'The nutrition facts label must include: serving size, servings per container, calories, total fat, saturated fat, trans fat, cholesterol, sodium, total carbohydrate, dietary fiber, total sugars, added sugars, protein, vitamin D, calcium, iron, and potassium. Serving sizes must be based on Reference Amounts Customarily Consumed (RACC). Calories must be displayed prominently. Percent Daily Values (%DV) must be shown for applicable nutrients based on a 2,000 calorie diet.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9',
  '2020-01-01',
  '2020',
  true
),
(
  'Allergen Labeling Requirements',
  'FDA requirements for major food allergen declarations',
  'Food labels must clearly identify the presence of any of the nine major food allergens: milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soybeans, and sesame. Allergens must be declared either in the ingredient list using their common names or in a separate "Contains" statement immediately after the ingredient list. Cross-contamination warnings (e.g., "may contain") are voluntary but recommended.',
  'federal_law',
  'United States',
  'FDA FALCPA',
  '2006-01-01',
  '2023',
  true
),
(
  'Ingredient List Requirements',
  'Rules for declaring ingredients on food labels',
  'Ingredients must be listed in descending order by weight. Each ingredient must be declared by its common or usual name. Sub-ingredients of compound ingredients must be declared in parentheses. Colors must be specifically declared (e.g., "FD&C Red No. 40"). Chemical preservatives must include their function. Standardized foods may have exemptions.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.4',
  '2018-01-01',
  '2018',
  true
)
ON CONFLICT DO NOTHING;
