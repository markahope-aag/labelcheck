-- ============================================
-- LabelCheck Production Database Setup
-- Generated: 2025-10-30T18:11:05.402Z
-- Consolidates all 24 migrations into one file
-- ============================================


-- ============================================
-- Migration: 20251016215231_create_food_label_schema.sql
-- ============================================

/*
  # Food Label Compliance Checker - Database Schema
  
  ## Overview
  Complete database schema for the Food Label Compliance SaaS application including
  user management, subscription tracking, usage limits, and analysis history.
  
  ## Tables Created
  
  ### 1. users
  Stores user account information synced with Clerk authentication
  - id: Unique user identifier (UUID)
  - clerk_user_id: Clerk's unique user ID for authentication sync
  - email: User's email address
  - stripe_customer_id: Stripe customer ID for billing
  - created_at: Account creation timestamp
  - updated_at: Last account update timestamp
  
  ### 2. subscriptions
  Tracks user subscription plans and billing status
  - id: Unique subscription identifier
  - user_id: Reference to users table
  - stripe_subscription_id: Stripe's subscription ID
  - stripe_price_id: Stripe price ID for the plan
  - plan_tier: Subscription tier (basic/pro/enterprise)
  - status: Current subscription status (active/canceled/past_due/trialing)
  - current_period_start: Billing period start date
  - current_period_end: Billing period end date
  - cancel_at_period_end: Whether subscription cancels at period end
  - created_at: Subscription creation timestamp
  - updated_at: Last subscription update timestamp
  
  ### 3. usage_tracking
  Monthly usage tracking for analyses per user
  - id: Unique usage record identifier
  - user_id: Reference to users table
  - month: Month identifier (YYYY-MM format)
  - analyses_used: Number of analyses performed this month
  - analyses_limit: Maximum analyses allowed for the plan
  - created_at: Record creation timestamp
  - updated_at: Last update timestamp
  - Unique constraint on (user_id, month) to prevent duplicates
  
  ### 4. analyses
  Stores food label analysis results and history
  - id: Unique analysis identifier
  - user_id: Reference to users table
  - image_url: Supabase Storage URL for the label image
  - image_name: Original filename
  - analysis_result: Complete AI analysis in JSON format
  - compliance_status: Overall status (compliant/minor_issues/major_violations)
  - issues_found: Count of issues detected
  - created_at: Analysis timestamp
  
  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own data
  - Policies enforce authentication and ownership
  
  ## Important Notes
  - All timestamps use timestamptz for timezone awareness
  - Foreign keys have ON DELETE CASCADE for data cleanup
  - Indexes added for frequently queried columns
  - Default values set where appropriate
*/

-- Create custom types
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier_type') THEN
    CREATE TYPE plan_tier_type AS ENUM ('basic', 'pro', 'enterprise');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status_type') THEN
    CREATE TYPE subscription_status_type AS ENUM ('active', 'canceled', 'past_due', 'trialing');
  END IF;
END $$;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  plan_tier plan_tier_type NOT NULL DEFAULT 'basic',
  status subscription_status_type NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create usage_tracking table
CREATE TABLE IF NOT EXISTS usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
  analyses_used INTEGER DEFAULT 0,
  analyses_limit INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

-- Create analyses table
CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  image_name TEXT NOT NULL,
  analysis_result JSONB NOT NULL,
  compliance_status TEXT NOT NULL,
  issues_found INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month ON usage_tracking(user_id, month);
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at ON analyses(created_at DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  TO authenticated
  USING (clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text)
  WITH CHECK (clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text);

-- RLS Policies for subscriptions table
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can update own subscription"
  ON subscriptions FOR UPDATE
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can insert own subscription"
  ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

-- RLS Policies for usage_tracking table
CREATE POLICY "Users can view own usage"
  ON usage_tracking FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can update own usage"
  ON usage_tracking FOR UPDATE
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ))
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can insert own usage"
  ON usage_tracking FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

-- RLS Policies for analyses table
CREATE POLICY "Users can view own analyses"
  ON analyses FOR SELECT
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  TO authenticated
  WITH CHECK (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

CREATE POLICY "Users can delete own analyses"
  ON analyses FOR DELETE
  TO authenticated
  USING (user_id IN (
    SELECT id FROM users WHERE clerk_user_id = (current_setting('request.jwt.claims', true)::json->>'sub')::text
  ));

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    CREATE TRIGGER update_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_subscriptions_updated_at') THEN
    CREATE TRIGGER update_subscriptions_updated_at
      BEFORE UPDATE ON subscriptions
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_usage_tracking_updated_at') THEN
    CREATE TRIGGER update_usage_tracking_updated_at
      BEFORE UPDATE ON usage_tracking
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- Migration: 20251016225142_create_regulatory_documents.sql
-- ============================================

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


-- ============================================
-- Migration: 20251017020825_frosty_breeze.sql
-- ============================================

/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_customers`: Links Supabase users to Stripe customers
      - Includes `user_id` (references `auth.users`)
      - Stores Stripe `customer_id`
      - Implements soft delete

    - `stripe_subscriptions`: Manages subscription data
      - Tracks subscription status, periods, and payment details
      - Links to `stripe_customers` via `customer_id`
      - Custom enum type for subscription status
      - Implements soft delete

    - `stripe_orders`: Stores order/purchase information
      - Records checkout sessions and payment intents
      - Tracks payment amounts and status
      - Custom enum type for order status
      - Implements soft delete

  2. Views
    - `stripe_user_subscriptions`: Secure view for user subscription data
      - Joins customers and subscriptions
      - Filtered by authenticated user

    - `stripe_user_orders`: Secure view for user order history
      - Joins customers and orders
      - Filtered by authenticated user

  3. Security
    - Enables Row Level Security (RLS) on all tables
    - Implements policies for authenticated users to view their own data
*/

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;

-- ============================================
-- Migration: 20251017020900_twilight_summit.sql
-- ============================================

/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_customers`: Links Supabase users to Stripe customers
      - Includes `user_id` (references `auth.users`)
      - Stores Stripe `customer_id`
      - Implements soft delete

    - `stripe_subscriptions`: Manages subscription data
      - Tracks subscription status, periods, and payment details
      - Links to `stripe_customers` via `customer_id`
      - Custom enum type for subscription status
      - Implements soft delete

    - `stripe_orders`: Stores order/purchase information
      - Records checkout sessions and payment intents
      - Tracks payment amounts and status
      - Custom enum type for order status
      - Implements soft delete

  2. Views
    - `stripe_user_subscriptions`: Secure view for user subscription data
      - Joins customers and subscriptions
      - Filtered by authenticated user

    - `stripe_user_orders`: Secure view for user order history
      - Joins customers and orders
      - Filtered by authenticated user

  3. Security
    - Enables Row Level Security (RLS) on all tables
    - Implements policies for authenticated users to view their own data
*/

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;

-- ============================================
-- Migration: 20251017023000_shy_bread.sql
-- ============================================

/*
  # Stripe Integration Schema

  1. New Tables
    - `stripe_customers`: Links Supabase users to Stripe customers
      - Includes `user_id` (references `auth.users`)
      - Stores Stripe `customer_id`
      - Implements soft delete

    - `stripe_subscriptions`: Manages subscription data
      - Tracks subscription status, periods, and payment details
      - Links to `stripe_customers` via `customer_id`
      - Custom enum type for subscription status
      - Implements soft delete

    - `stripe_orders`: Stores order/purchase information
      - Records checkout sessions and payment intents
      - Tracks payment amounts and status
      - Custom enum type for order status
      - Implements soft delete

  2. Views
    - `stripe_user_subscriptions`: Secure view for user subscription data
      - Joins customers and subscriptions
      - Filtered by authenticated user

    - `stripe_user_orders`: Secure view for user order history
      - Joins customers and orders
      - Filtered by authenticated user

  3. Security
    - Enables Row Level Security (RLS) on all tables
    - Implements policies for authenticated users to view their own data
*/

CREATE TABLE IF NOT EXISTS stripe_customers (
  id bigint primary key generated always as identity,
  user_id uuid references auth.users(id) not null unique,
  customer_id text not null unique,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own customer data"
    ON stripe_customers
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid() AND deleted_at IS NULL);

CREATE TYPE stripe_subscription_status AS ENUM (
    'not_started',
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id bigint primary key generated always as identity,
  customer_id text unique not null,
  subscription_id text default null,
  price_id text default null,
  current_period_start bigint default null,
  current_period_end bigint default null,
  cancel_at_period_end boolean default false,
  payment_method_brand text default null,
  payment_method_last4 text default null,
  status stripe_subscription_status not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscription data"
    ON stripe_subscriptions
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

CREATE TYPE stripe_order_status AS ENUM (
    'pending',
    'completed',
    'canceled'
);

CREATE TABLE IF NOT EXISTS stripe_orders (
    id bigint primary key generated always as identity,
    checkout_session_id text not null,
    payment_intent_id text not null,
    customer_id text not null,
    amount_subtotal bigint not null,
    amount_total bigint not null,
    currency text not null,
    payment_status text not null,
    status stripe_order_status not null default 'pending',
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone default null
);

ALTER TABLE stripe_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order data"
    ON stripe_orders
    FOR SELECT
    TO authenticated
    USING (
        customer_id IN (
            SELECT customer_id
            FROM stripe_customers
            WHERE user_id = auth.uid() AND deleted_at IS NULL
        )
        AND deleted_at IS NULL
    );

-- View for user subscriptions
CREATE VIEW stripe_user_subscriptions WITH (security_invoker = true) AS
SELECT
    c.customer_id,
    s.subscription_id,
    s.status as subscription_status,
    s.price_id,
    s.current_period_start,
    s.current_period_end,
    s.cancel_at_period_end,
    s.payment_method_brand,
    s.payment_method_last4
FROM stripe_customers c
LEFT JOIN stripe_subscriptions s ON c.customer_id = s.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND s.deleted_at IS NULL;

GRANT SELECT ON stripe_user_subscriptions TO authenticated;

-- View for user orders
CREATE VIEW stripe_user_orders WITH (security_invoker) AS
SELECT
    c.customer_id,
    o.id as order_id,
    o.checkout_session_id,
    o.payment_intent_id,
    o.amount_subtotal,
    o.amount_total,
    o.currency,
    o.payment_status,
    o.status as order_status,
    o.created_at as order_date
FROM stripe_customers c
LEFT JOIN stripe_orders o ON c.customer_id = o.customer_id
WHERE c.user_id = auth.uid()
AND c.deleted_at IS NULL
AND o.deleted_at IS NULL;

-- ============================================
-- Migration: 20251017024418_expand_regulatory_documents.sql
-- ============================================

-- Expand Regulatory Documents Database
-- 
-- This migration expands the regulatory documents database with comprehensive FDA, USDA, 
-- and international food labeling regulations. Adds detailed requirements across all 
-- major categories including nutrition, allergens, claims, organic standards, and more.

-- Insert expanded regulatory documents
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
  'Health and Nutrient Content Claims',
  'FDA regulations for health claims and nutrient content claims on food labels',
  'Nutrient content claims must meet specific criteria: "Low fat" means 3g or less per serving. "Reduced" means 25% less than reference food. "Light" means 50% less fat or 1/3 fewer calories. "Good source" means 10-19% DV per serving. "High" or "Excellent source" means 20% or more DV. Health claims linking nutrients to disease risk must be pre-approved by FDA or based on authoritative statements. Qualified health claims require specific FDA-approved wording and may include disclaimers about limited scientific evidence.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.13, 101.54, 101.56',
  '2016-07-26',
  '2016',
  true
),
(
  'Trans Fat Labeling Requirements',
  'FDA requirements for trans fat declaration on nutrition labels',
  'Trans fat must be listed on a separate line under saturated fat in the nutrition facts panel. Amount must be declared to nearest 0.5g for amounts above 0.5g per serving. If trans fat is less than 0.5g per serving, it may be listed as 0g, but a footnote stating "Not a significant source of trans fat" is encouraged. Products claiming "0g trans fat" must contain less than 0.5g per serving AND less than 0.5g saturated fat per serving. Partially hydrogenated oils (PHOs) are banned as of 2020 except for specific authorized uses.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9',
  '2020-01-01',
  '2020',
  true
),
(
  'Added Sugars Labeling',
  'FDA requirements for declaring added sugars on nutrition labels',
  'Added sugars must be listed in grams and as a percent Daily Value (%DV) based on 50g per day (10% of a 2000 calorie diet). Added sugars include sugars added during processing or packaging, plus sugars from syrups, honey, and concentrated fruit/vegetable juices. The label must state "Includes Xg Added Sugars" indented under Total Sugars. A %DV must be included. This applies to single-ingredient sugars like honey and maple syrup with labels. Products with less than 1g of total sugars and no added sugar ingredients are exempt.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9',
  '2021-01-01',
  '2021',
  true
),
(
  'Serving Size Determination',
  'FDA Reference Amounts Customarily Consumed (RACC) for determining serving sizes',
  'Serving sizes must be based on FDA Reference Amounts Customarily Consumed (RACC), not manufacturer preference. RACC reflects amounts typically eaten in one sitting based on FDA surveys. If package contains between 150% and 200% of RACC, entire package is one serving. Packages with 200-400% of RACC should declare as 2 servings. Products consumed in one eating occasion regardless of size must be labeled as one serving if package is between 1-2 servings. Dual-column labels required for certain multi-serving packages. Serving sizes must be declared in common household measures (cups, pieces) with metric equivalents.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.9, 101.12',
  '2018-07-26',
  '2018',
  true
),
(
  'USDA Organic Labeling Standards',
  'USDA National Organic Program requirements for organic product labeling',
  'Products labeled "100% Organic" must contain only organically produced ingredients (excluding water and salt). Products labeled "Organic" must contain at least 95% organically produced ingredients. Products labeled "Made with Organic [ingredients]" must contain at least 70% organic ingredients. All organic products must display the USDA Organic seal if they meet requirements. Products must be certified by USDA-accredited certifying agent. Prohibited substances cannot be used. Organic livestock must have access to outdoors and organic feed. GMOs are prohibited in organic production. Detailed production and handling records required.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 205',
  '2002-10-21',
  '2024',
  true
),
(
  'Gluten-Free Labeling Standards',
  'FDA standards for gluten-free claims on food products',
  'Foods labeled "gluten-free," "no gluten," "free of gluten," or "without gluten" must contain less than 20 parts per million (ppm) of gluten. This applies to inherently gluten-free foods and those made gluten-free. Products cannot contain wheat, rye, barley, or crossbreeds of these grains unless the ingredient has been processed to remove gluten below 20 ppm. Oats may be used if specially produced to be gluten-free. Manufacturers responsible for ensuring compliance through testing or supplier guarantees. Claims apply to both packaged foods and restaurant foods.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.91',
  '2014-08-05',
  '2014',
  true
),
(
  'Bioengineered Food Disclosure',
  'USDA requirements for GMO disclosure on food products',
  'Foods containing bioengineered ingredients (GMOs) must disclose this information. Disclosure required if food contains more than 5% bioengineered material by weight. Acceptable disclosure methods: text statement "bioengineered food" or "contains a bioengineered food ingredient," USDA bioengineered food symbol, electronic/digital link (QR code), or text message option. Small food manufacturers (less than $2.5M annual receipts) may use phone number or website. Very small packages may use abbreviated disclosure. Disclosure must be on information panel or principal display panel. Highly refined ingredients where genetic material is undetectable are exempt.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 66',
  '2022-01-01',
  '2022',
  true
),
(
  'Country of Origin Labeling (COOL)',
  'USDA requirements for country of origin declarations',
  'Country of origin required for: fresh fruits and vegetables, fish and shellfish, peanuts, pecans, macadamia nuts, and ginseng. Must state production origin: "Product of [country name]" or "Grown in [country name]." For processed foods, country of origin disclosure is voluntary but must be truthful if declared. "Made in USA" claims require final article be manufactured or significantly transformed in US, and all or virtually all ingredients/components must be US-origin. Imported products must declare country of origin conspicuously on label. Retailer responsible for maintaining country of origin information. False origin statements subject to penalties.',
  'federal_law',
  'United States',
  'USDA 7 CFR Part 60, FTC Act',
  '2009-03-16',
  '2023',
  true
),
(
  'Net Quantity of Contents',
  'FDA and FTC requirements for net quantity declarations on packages',
  'Net quantity statement required on principal display panel. Must be in US customary (ounces, pounds) and metric (grams, kilograms) units. Statement must appear in lower 30% of principal display panel. Type size requirements based on package size: 1/16 inch for panels 5 sq in or less, up to 1/2 inch for panels over 100 sq in. Quantity must include only contents, not packaging. For liquids, use fluid ounces. For solids, use weight. Count may be included for discrete units. "Net Wt" or "Net Weight" abbreviation acceptable. Bidirectional languages require special placement rules.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.105, FTC 16 CFR 500',
  '1994-01-01',
  '2020',
  true
),
(
  'Date Labeling Guidelines',
  'FDA guidance on use of date labels like Best By and Use By',
  'Date labeling not federally required except for infant formula. Manufacturers may voluntarily include dates. "Best if Used By" indicates peak quality, not safety. "Use By" indicates last recommended date for use at peak quality. "Sell By" is for retailer inventory management. Dates should not be used as safety indicator for most foods. Consumers can use food beyond these dates if no spoilage signs present. Dates must be month/day or month/year format with explanation phrase. Infant formula "Use By" date is mandatory and indicates date by which product should be consumed for safety and nutritional quality.',
  'guideline',
  'United States',
  'FDA Guidance',
  '2019-05-23',
  '2019',
  true
),
(
  'Caffeine Disclosure Requirements',
  'FDA requirements for caffeine content warnings and disclosure',
  'Caffeine must be listed in ingredient list. Products with added caffeine (beyond naturally occurring) should declare total caffeine content per serving. Energy drinks and dietary supplements with caffeine should include warning statement: "This product contains caffeine." For products marketed with caffeine claims, actual content should be declared. FDA has not set specific caffeine level limits for foods but monitors levels. Products marketed as dietary supplements must follow supplement labeling rules. Extremely high caffeine products may require special warnings. Caffeine content claims must be truthful and not misleading.',
  'guideline',
  'United States',
  'FDA 21 CFR 101.4, Guidance',
  '2015-01-01',
  '2023',
  true
),
(
  'Juice Content Declaration',
  'FDA requirements for declaring juice percentage in beverages',
  'Beverages containing juice must declare percentage of juice on information panel. Declaration must state "Contains X% [name of juice]" or "X% Juice." For 100% juice, can use "100% Juice" or "All Juice." For juice blends, must declare each juice type and percentage or total juice percentage. Juice declaration must be near most prominent juice characterization. Minimum type size 6 points. Juice from concentrate must be declared. Products with no juice may state "Contains No Juice" or "No Juice." Diluted juice products must indicate dilution. Claims about juice content (e.g., "made with real fruit juice") require minimum juice threshold.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.30',
  '1994-01-01',
  '2018',
  true
),
(
  'Whole Grain Content Claims',
  'FDA guidance on making whole grain claims on food labels',
  'Whole grain claims should identify specific grain (e.g., "whole wheat"). Products claiming "good source of whole grain" should provide at least 8g of whole grain per serving. "Excellent source" requires 16g per serving. 51% or more of grain ingredients should be whole grain to make unqualified whole grain claims. Whole grain stamp programs are voluntary industry initiatives, not FDA-regulated. "Made with whole grains" is acceptable if product contains whole grain, but percentage should be clear. "100% whole grain" means all grain ingredients are whole grain. Refined grains cannot be characterized as whole grain. Whole grain content may be declared in grams on nutrition label.',
  'guideline',
  'United States',
  'FDA Draft Guidance',
  '2006-02-01',
  '2023',
  true
),
(
  'Natural Food Labeling Policy',
  'FDA policy on use of natural claims on food products',
  'FDA has not established formal definition of "natural" but has policy that nothing artificial or synthetic (including artificial flavors, colors, or chemical preservatives) should be in product labeled "natural." Policy only addresses added ingredients, not production methods. "Natural" does not mean organic or address animal welfare, environmental or pesticide use. USDA has definition for meat and poultry: minimally processed with no artificial ingredients. "All natural" should mean product contains only natural ingredients. GMO ingredients do not automatically disqualify "natural" claim under current FDA policy. Natural claims are subject to FTC truth-in-advertising requirements.',
  'policy',
  'United States',
  'FDA Policy, USDA FSIS',
  '1991-01-01',
  '2023',
  true
),
(
  'Front-of-Package Labeling',
  'Requirements and guidance for nutrition and health information on front panels',
  'Front-of-package claims must not be false or misleading. Nutrient content claims on front must meet regulatory definitions. If front panel makes claim about one nutrient, cannot omit information about nutrients to limit (fat, sodium, cholesterol). Principal display panel must include product identity, net quantity, and any required warnings. Voluntary front-of-pack nutrition symbols must be truthful and not misleading. Claims must be substantiated and not contradict information on nutrition facts panel. Images showing serving suggestions must be clearly labeled as such. Size of claims proportional to package size. Third-party seals and certifications permitted if truthful and substantiated.',
  'guideline',
  'United States',
  'FDA 21 CFR 101, FTC Act',
  '2014-01-01',
  '2022',
  true
),
(
  'Foods Marketed to Children',
  'Special labeling considerations for foods marketed to children',
  'All standard labeling rules apply. Products using child-appealing features (cartoon characters, games, bright colors) should meet responsible nutrition standards. Marketing on packages must not be deceptive about nutritional value. Allergen warnings must be prominent as children may be at higher risk. Choking hazard warnings required for small candy, toys in food, and foods with small pieces for children under 3. Serving sizes on child-targeted foods should reflect age-appropriate portions. Juice drinks for children must declare juice percentage. Baby food and infant formula have specific composition and labeling requirements. Claims like "made for kids" should be supported by appropriate nutritional profile.',
  'guideline',
  'United States',
  'FDA Guidance, CPSC Regulations',
  '2017-01-01',
  '2023',
  true
),
(
  'Dietary Supplement Facts Panel',
  'FDA requirements for dietary supplement labeling and supplement facts',
  'Supplements must have Supplement Facts panel, not Nutrition Facts. Must declare serving size, servings per container, and amount per serving of each dietary ingredient. List ingredients present at significant levels. Use %DV when established for nutrients. Dietary ingredients without DVs listed with amount only. Must declare source organism for herbal ingredients. Proprietary blends must show total weight and list ingredients in descending order. "Other ingredients" listed below panel. Structure/function claims require disclaimer: "This statement has not been evaluated by FDA. This product is not intended to diagnose, treat, cure, or prevent any disease." Must meet cGMP requirements. Cannot claim to diagnose, treat, cure, or prevent diseases.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.36, DSHEA',
  '1999-03-23',
  '2023',
  true
),
(
  'Irradiated Food Labeling',
  'FDA requirements for labeling irradiated foods',
  'Irradiated foods must display international radura symbol (green symbol resembling flower in broken circle). Must include statement "Treated with radiation" or "Treated by irradiation." For foods where ingredient was irradiated, ingredient list must note irradiation. Symbol and statement required on front or information panel. Exceptions: irradiated ingredients in multi-ingredient foods if ingredients comprise less than 10% of food do not require labeling. Highly processed irradiated ingredients where irradiation purpose cannot be achieved (like spices at low levels) may be exempt. Retail establishments serving irradiated food must provide notice. Labeling applies to whole foods, processed foods containing irradiated ingredients, and food service.',
  'federal_law',
  'United States',
  'FDA 21 CFR 179.26',
  '1997-12-03',
  '2020',
  true
),
(
  'Religious Dietary Labeling Standards',
  'Standards and requirements for kosher and halal labeling claims',
  'Kosher and halal terms are voluntary but must be truthful if used. FDA does not verify religious dietary claims but monitors for false/misleading statements. Products claiming kosher typically certified by recognized rabbinical authority; certification symbol should be displayed. Halal claims should be verified by recognized Islamic certification body. False kosher/halal claims subject to action as misbranding. State laws may impose additional requirements. Claims must reflect actual religious standards, not merely absence of certain ingredients. Certification standards may vary by certifying organization. Products should clearly identify certifying organization. Manufacturing processes and facilities may need to meet religious standards, not just ingredients.',
  'guideline',
  'United States',
  'FDA FDCA Section 403, State Laws',
  '2000-01-01',
  '2023',
  true
),
(
  'Fat Content Nutrient Claims',
  'Definitions and requirements for fat-related nutrient content claims',
  'Fat-free: Less than 0.5g fat per serving. Low-fat: 3g or less fat per serving (for meals: 3g or less per 100g and no more than 30% calories from fat). Reduced-fat: At least 25% less fat than reference food. Light (fat): 50% less fat than reference food (or 1/3 fewer calories if less than 50% calories from fat). Lean (meat/poultry): Less than 10g fat, 4.5g saturated fat, and 95mg cholesterol per serving and per 100g. Extra lean: Less than 5g fat, 2g saturated fat, and 95mg cholesterol per serving and per 100g. Percent fat-free: May be used on low-fat or fat-free products; must accurately reflect fat content (e.g., "95% fat-free" = 5% fat by weight). All fat claims must meet definition criteria per RACC and per 50g if RACC is small.',
  'federal_law',
  'United States',
  'FDA 21 CFR 101.62',
  '1994-01-01',
  '2020',
  true
)
ON CONFLICT DO NOTHING;

-- ============================================
-- Migration: 20251017024752_add_user_settings_and_teams.sql
-- ============================================

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

-- ============================================
-- Migration: 20251021000000_add_share_token.sql
-- ============================================

-- Add share_token column to analyses table for shareable links

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_analyses_share_token ON analyses(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN analyses.share_token IS 'Unique token for generating shareable public links to analysis results';


-- ============================================
-- Migration: 20251022000000_create_analysis_sessions.sql
-- ============================================

-- Create analysis_sessions table for tracking iterative compliance improvement workflows
CREATE TABLE IF NOT EXISTS analysis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'resolved', 'archived')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create analysis_iterations table for tracking each step in the improvement process
CREATE TABLE IF NOT EXISTS analysis_iterations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES analysis_sessions(id) ON DELETE CASCADE,
    iteration_type TEXT NOT NULL CHECK (iteration_type IN ('image_analysis', 'text_check', 'chat_question', 'revised_analysis')),
    input_data JSONB NOT NULL,
    result_data JSONB,
    analysis_id UUID REFERENCES analyses(id) ON DELETE SET NULL,
    parent_iteration_id UUID REFERENCES analysis_iterations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add session_id to analyses table to link analyses to sessions
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES analysis_sessions(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user_id ON analysis_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_status ON analysis_sessions(status);
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_created_at ON analysis_sessions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analysis_iterations_session_id ON analysis_iterations(session_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_analysis_id ON analysis_iterations(analysis_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_parent_iteration_id ON analysis_iterations(parent_iteration_id);
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_created_at ON analysis_iterations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_session_id ON analyses(session_id);

-- Create updated_at trigger for analysis_sessions
CREATE OR REPLACE FUNCTION update_analysis_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_analysis_sessions_updated_at
    BEFORE UPDATE ON analysis_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_analysis_sessions_updated_at();

-- Enable Row Level Security
ALTER TABLE analysis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_iterations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for analysis_sessions
CREATE POLICY "Users can view their own sessions"
    ON analysis_sessions FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own sessions"
    ON analysis_sessions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own sessions"
    ON analysis_sessions FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own sessions"
    ON analysis_sessions FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- RLS Policies for analysis_iterations
CREATE POLICY "Users can view iterations from their sessions"
    ON analysis_iterations FOR SELECT
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert iterations to their sessions"
    ON analysis_iterations FOR INSERT
    TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update iterations in their sessions"
    ON analysis_iterations FOR UPDATE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete iterations from their sessions"
    ON analysis_iterations FOR DELETE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE analysis_sessions IS 'Tracks iterative compliance improvement workflows for label analyses';
COMMENT ON TABLE analysis_iterations IS 'Records each step in the iterative improvement process (analyses, text checks, chat questions)';
COMMENT ON COLUMN analysis_sessions.status IS 'Current status: in_progress (active work), resolved (compliant), archived (completed/dismissed)';
COMMENT ON COLUMN analysis_iterations.iteration_type IS 'Type of iteration: image_analysis, text_check, chat_question, revised_analysis';
COMMENT ON COLUMN analysis_iterations.input_data IS 'JSONB containing the input for this iteration (image reference, text content, or chat message)';
COMMENT ON COLUMN analysis_iterations.result_data IS 'JSONB containing the AI analysis result or chat response';
COMMENT ON COLUMN analysis_iterations.parent_iteration_id IS 'Links to parent iteration for threaded conversations or follow-ups';


-- ============================================
-- Migration: 20251022220000_create_gras_ingredients.sql
-- ============================================

-- Create GRAS (Generally Recognized as Safe) ingredients table
-- This table contains FDA-approved ingredients for food products

CREATE TABLE IF NOT EXISTS gras_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_name TEXT NOT NULL,
    cas_number TEXT, -- Chemical Abstracts Service registry number
    gras_notice_number TEXT, -- FDA GRAS Notice number (e.g., "GRN 000123")
    gras_status TEXT NOT NULL CHECK (gras_status IN ('affirmed', 'notice', 'scogs', 'pending')),
    source_reference TEXT, -- CFR citation or SCOGS reference
    category TEXT, -- e.g., "preservative", "flavor", "colorant", "emulsifier"
    approved_uses TEXT[], -- Array of approved food applications
    limitations TEXT, -- Usage limitations or conditions
    synonyms TEXT[], -- Alternative names for ingredient matching
    common_name TEXT, -- Common/trade name if different from ingredient_name
    technical_name TEXT, -- IUPAC or technical chemical name
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_gras_ingredient_name ON gras_ingredients (ingredient_name);
CREATE INDEX IF NOT EXISTS idx_gras_cas_number ON gras_ingredients (cas_number) WHERE cas_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_notice_number ON gras_ingredients (gras_notice_number) WHERE gras_notice_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_status ON gras_ingredients (gras_status);
CREATE INDEX IF NOT EXISTS idx_gras_category ON gras_ingredients (category) WHERE category IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gras_active ON gras_ingredients (is_active) WHERE is_active = true;

-- Index for array search on synonyms (GIN index for JSONB array searching)
CREATE INDEX IF NOT EXISTS idx_gras_synonyms ON gras_ingredients USING gin(synonyms);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_gras_ingredients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_gras_ingredients_updated_at
    BEFORE UPDATE ON gras_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_gras_ingredients_updated_at();

-- Add comments for documentation
COMMENT ON TABLE gras_ingredients IS 'FDA Generally Recognized as Safe (GRAS) ingredients database for food product compliance checking';
COMMENT ON COLUMN gras_ingredients.ingredient_name IS 'Primary name of the ingredient';
COMMENT ON COLUMN gras_ingredients.cas_number IS 'Chemical Abstracts Service registry number for unique identification';
COMMENT ON COLUMN gras_ingredients.gras_notice_number IS 'FDA GRAS Notice number (e.g., GRN 000123)';
COMMENT ON COLUMN gras_ingredients.gras_status IS 'GRAS determination type: affirmed (CFR listed), notice (FDA reviewed notification), scogs (SCOGS database), pending (under review)';
COMMENT ON COLUMN gras_ingredients.source_reference IS 'Citation to CFR regulation, SCOGS report, or GRAS notice';
COMMENT ON COLUMN gras_ingredients.category IS 'Functional category (preservative, flavor, colorant, etc.)';
COMMENT ON COLUMN gras_ingredients.approved_uses IS 'Array of approved food applications or use cases';
COMMENT ON COLUMN gras_ingredients.limitations IS 'Usage limitations, maximum levels, or specific conditions';
COMMENT ON COLUMN gras_ingredients.synonyms IS 'Alternative names for ingredient matching (e.g., "ascorbic acid" synonym for "vitamin C")';

-- Insert some common GRAS ingredients as seed data
INSERT INTO gras_ingredients (ingredient_name, gras_status, source_reference, category, synonyms) VALUES
('Water', 'affirmed', '21 CFR 184.1', 'solvent', ARRAY['H2O', 'purified water', 'distilled water']),
('Salt', 'affirmed', '21 CFR 184.1634', 'seasoning', ARRAY['sodium chloride', 'NaCl', 'table salt']),
('Sugar', 'affirmed', '21 CFR 184.1854', 'sweetener', ARRAY['sucrose', 'cane sugar', 'beet sugar']),
('Citric Acid', 'affirmed', '21 CFR 184.1033', 'acidulant', ARRAY['E330']),
('Ascorbic Acid', 'affirmed', '21 CFR 184.1073', 'antioxidant', ARRAY['vitamin C', 'E300']),
('Acetic Acid', 'affirmed', '21 CFR 184.1005', 'acidulant', ARRAY['vinegar', 'E260']),
('Lecithin', 'affirmed', '21 CFR 184.1400', 'emulsifier', ARRAY['soy lecithin', 'E322']),
('Caffeine', 'affirmed', '21 CFR 182.1180', 'stimulant', ARRAY['1,3,7-trimethylxanthine']),
('Vanilla Extract', 'affirmed', '21 CFR 169.175', 'flavor', ARRAY['vanilla', 'vanilla flavoring']),
('Potassium Sorbate', 'affirmed', '21 CFR 182.3640', 'preservative', ARRAY['E202']),
('Sodium Benzoate', 'affirmed', '21 CFR 184.1733', 'preservative', ARRAY['E211']),
('Calcium Carbonate', 'affirmed', '21 CFR 184.1191', 'nutrient', ARRAY['E170', 'limestone']),
('Gelatin', 'affirmed', '21 CFR 184.1560', 'gelling agent', ARRAY['gelatine']),
('Pectin', 'affirmed', '21 CFR 184.1588', 'gelling agent', ARRAY['E440']),
('Agar', 'affirmed', '21 CFR 184.1115', 'gelling agent', ARRAY['agar-agar', 'E406']),
('Carrageenan', 'affirmed', '21 CFR 172.620', 'thickener', ARRAY['E407']),
('Guar Gum', 'affirmed', '21 CFR 184.1339', 'thickener', ARRAY['E412']),
('Xanthan Gum', 'affirmed', '21 CFR 172.695', 'thickener', ARRAY['E415']),
('Modified Food Starch', 'affirmed', '21 CFR 172.892', 'thickener', ARRAY['modified starch']),
('Corn Starch', 'affirmed', '21 CFR 184.1655', 'thickener', ARRAY['maize starch', 'cornstarch']);

-- Grant appropriate permissions (adjust role name as needed)
-- ALTER TABLE gras_ingredients ENABLE ROW LEVEL SECURITY;
-- Note: GRAS data is public information, so we allow read access to all authenticated users
-- Only admins should be able to modify this data


-- ============================================
-- Migration: 20251023000000_add_product_category.sql
-- ============================================

-- Add product_category and category_rationale columns to analyses table
-- This enables category-specific regulatory compliance checking

-- Add product_category column with constraint to ensure valid values
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS product_category TEXT
  CHECK (product_category IN (
    'CONVENTIONAL_FOOD',
    'DIETARY_SUPPLEMENT',
    'ALCOHOLIC_BEVERAGE',
    'NON_ALCOHOLIC_BEVERAGE'
  ));

-- Add category_rationale column to explain classification
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS category_rationale TEXT;

-- Create index for faster filtering by product category
CREATE INDEX IF NOT EXISTS idx_analyses_product_category
  ON analyses(product_category)
  WHERE product_category IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN analyses.product_category IS
  'Regulatory product category: CONVENTIONAL_FOOD | DIETARY_SUPPLEMENT | ALCOHOLIC_BEVERAGE | NON_ALCOHOLIC_BEVERAGE. Determines which regulatory framework applies to the label analysis.';

COMMENT ON COLUMN analyses.category_rationale IS
  'Explanation of why the product was classified into its product_category, citing specific label elements observed.';


-- ============================================
-- Migration: 20251023130000_add_category_guidance.sql
-- ============================================

-- Add category guidance fields to analyses table
-- This enables ambiguity detection and user category selection

-- Add category_confidence column
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS category_confidence TEXT
  CHECK (category_confidence IN ('high', 'medium', 'low'));

-- Add ambiguity flag
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS is_category_ambiguous BOOLEAN DEFAULT false;

-- Add alternative categories array
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS alternative_categories TEXT[];

-- Add user-selected category (may differ from AI detected)
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS user_selected_category TEXT
  CHECK (user_selected_category IN (
    'CONVENTIONAL_FOOD',
    'DIETARY_SUPPLEMENT',
    'ALCOHOLIC_BEVERAGE',
    'NON_ALCOHOLIC_BEVERAGE'
  ));

-- Add reason for user's category selection
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS category_selection_reason TEXT;

-- Add flag if user requested category comparison
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS compared_categories BOOLEAN DEFAULT false;

-- Create index for filtering by ambiguous products
CREATE INDEX IF NOT EXISTS idx_analyses_ambiguous
  ON analyses(is_category_ambiguous)
  WHERE is_category_ambiguous = true;

-- Create index for user-selected categories
CREATE INDEX IF NOT EXISTS idx_analyses_user_category
  ON analyses(user_selected_category)
  WHERE user_selected_category IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN analyses.category_confidence IS
  'AI confidence in classification: high (90%+), medium (60-89%), low (<60%)';

COMMENT ON COLUMN analyses.is_category_ambiguous IS
  'Whether product could reasonably fit multiple categories (triggers category selector UI)';

COMMENT ON COLUMN analyses.alternative_categories IS
  'Other categories this product could potentially be classified as (e.g., ["DIETARY_SUPPLEMENT", "CONVENTIONAL_FOOD"])';

COMMENT ON COLUMN analyses.user_selected_category IS
  'Category explicitly chosen by user (may differ from AI product_category). NULL if user accepted AI classification.';

COMMENT ON COLUMN analyses.category_selection_reason IS
  'User-provided reason for selecting different category than AI suggestion (e.g., "I want to make health claims")';

COMMENT ON COLUMN analyses.compared_categories IS
  'Whether user requested side-by-side comparison of multiple categories before selecting';


-- ============================================
-- Migration: 20251024000000_add_ndi_ingredients.sql
-- ============================================

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


-- ============================================
-- Migration: 20251024010000_enable_rls_security_fixes.sql
-- ============================================

-- Security Fix: Enable RLS on all public tables
-- Addresses Supabase security lints for RLS disabled in public schema

-- =====================================================
-- 1. ORGANIZATIONS TABLE
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view organizations they are members of" ON organizations;
DROP POLICY IF EXISTS "Organization owners can update their organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

-- Allow users to view organizations they are members of
CREATE POLICY "Users can view organizations they are members of"
  ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Allow organization owners to update their organizations
CREATE POLICY "Organization owners can update their organizations"
  ON organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role = 'owner'
    )
  );

-- Allow authenticated users to create organizations
CREATE POLICY "Users can create organizations"
  ON organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =====================================================
-- 2. ORGANIZATION_MEMBERS TABLE
-- =====================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;

-- Allow users to view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Allow owners and admins to manage organization members
CREATE POLICY "Organization owners and admins can manage members"
  ON organization_members
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  );

-- Allow users to insert themselves as members (for accepting invitations)
CREATE POLICY "Users can insert themselves as members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- =====================================================
-- 3. PENDING_INVITATIONS TABLE
-- =====================================================

ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view invitations for their email" ON pending_invitations;
DROP POLICY IF EXISTS "Organization owners and admins can manage invitations" ON pending_invitations;

-- Allow users to view invitations sent to their email
CREATE POLICY "Users can view invitations for their email"
  ON pending_invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_email IN (
      SELECT email FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Allow organization owners and admins to create and manage invitations
CREATE POLICY "Organization owners and admins can manage invitations"
  ON pending_invitations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  );

-- =====================================================
-- 4. GRAS_INGREDIENTS TABLE
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

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON POLICY "Users can view organizations they are members of" ON organizations
  IS 'Users can only see organizations where they are members';

COMMENT ON POLICY "Users can view members of their organizations" ON organization_members
  IS 'Users can only see members of organizations they belong to';

COMMENT ON POLICY "Users can view invitations for their email" ON pending_invitations
  IS 'Users can only see invitations sent to their email address';

COMMENT ON POLICY "GRAS ingredients are publicly readable" ON gras_ingredients
  IS 'GRAS database is public FDA regulatory information';


-- ============================================
-- Migration: 20251024020000_fix_function_search_path.sql
-- ============================================

-- Security Fix: Set search_path for trigger functions
-- Addresses Supabase security warnings for mutable search_path

-- Fix update_analysis_sessions_updated_at function
ALTER FUNCTION update_analysis_sessions_updated_at()
  SECURITY DEFINER
  SET search_path = public;

-- Fix update_gras_ingredients_updated_at function
ALTER FUNCTION update_gras_ingredients_updated_at()
  SECURITY DEFINER
  SET search_path = public;

-- Fix update_updated_at_column function
ALTER FUNCTION update_updated_at_column()
  SECURITY DEFINER
  SET search_path = public;

-- Add comments for documentation
COMMENT ON FUNCTION update_analysis_sessions_updated_at() IS
  'Trigger function to update analysis_sessions.updated_at timestamp. Search path locked to public schema for security.';

COMMENT ON FUNCTION update_gras_ingredients_updated_at() IS
  'Trigger function to update gras_ingredients.updated_at timestamp. Search path locked to public schema for security.';

COMMENT ON FUNCTION update_updated_at_column() IS
  'Generic trigger function to update updated_at timestamps. Search path locked to public schema for security.';


-- ============================================
-- Migration: 20251024030000_enable_rls_remaining_tables.sql
-- ============================================

-- Security Fix: Enable RLS on remaining public tables
-- This migration addresses the remaining 3 tables that still need RLS enabled

-- =====================================================
-- STEP 1: ORGANIZATION_MEMBERS TABLE
-- =====================================================

ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view members of their organizations" ON organization_members;
DROP POLICY IF EXISTS "Organization owners and admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Users can insert themselves as members" ON organization_members;

-- Allow users to view members of organizations they belong to
CREATE POLICY "Users can view members of their organizations"
  ON organization_members
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
    )
  );

-- Allow owners and admins to manage organization members
CREATE POLICY "Organization owners and admins can manage members"
  ON organization_members
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  );

-- Allow users to insert themselves as members (for accepting invitations)
CREATE POLICY "Users can insert themselves as members"
  ON organization_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

COMMENT ON POLICY "Users can view members of their organizations" ON organization_members
  IS 'Users can only see members of organizations they belong to';


-- ============================================
-- Migration: 20251024030001_enable_rls_pending_invitations.sql
-- ============================================

-- Security Fix: Enable RLS on pending_invitations table

-- =====================================================
-- STEP 2: PENDING_INVITATIONS TABLE
-- =====================================================

ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view invitations for their email" ON pending_invitations;
DROP POLICY IF EXISTS "Organization owners and admins can manage invitations" ON pending_invitations;

-- Allow users to view invitations sent to their email
CREATE POLICY "Users can view invitations for their email"
  ON pending_invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_email IN (
      SELECT email FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Allow organization owners and admins to create and manage invitations
CREATE POLICY "Organization owners and admins can manage invitations"
  ON pending_invitations
  FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id IN (
        SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
      )
      AND role IN ('owner', 'admin')
    )
  );

COMMENT ON POLICY "Users can view invitations for their email" ON pending_invitations
  IS 'Users can only see invitations sent to their email address';


-- ============================================
-- Migration: 20251024030002_enable_rls_gras_ingredients.sql
-- ============================================

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


-- ============================================
-- Migration: 20251024040000_optimize_rls_performance.sql
-- ============================================

-- Performance Optimization: Fix auth.uid() re-evaluation in RLS policies
-- Wraps auth.uid() with (select auth.uid()) to prevent re-evaluation for each row

-- =====================================================
-- ANALYSIS_SESSIONS POLICIES
-- =====================================================

-- Drop and recreate policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can insert their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can update their own sessions" ON analysis_sessions;
DROP POLICY IF EXISTS "Users can delete their own sessions" ON analysis_sessions;

CREATE POLICY "Users can view their own sessions"
    ON analysis_sessions FOR SELECT
    TO authenticated
    USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert their own sessions"
    ON analysis_sessions FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update their own sessions"
    ON analysis_sessions FOR UPDATE
    TO authenticated
    USING (user_id = (select auth.uid()))
    WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own sessions"
    ON analysis_sessions FOR DELETE
    TO authenticated
    USING (user_id = (select auth.uid()));

-- =====================================================
-- ANALYSIS_ITERATIONS POLICIES
-- =====================================================

-- Drop and recreate policies with optimized auth.uid() calls
DROP POLICY IF EXISTS "Users can view iterations from their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can insert iterations to their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can update iterations in their sessions" ON analysis_iterations;
DROP POLICY IF EXISTS "Users can delete iterations from their sessions" ON analysis_iterations;

CREATE POLICY "Users can view iterations from their sessions"
    ON analysis_iterations FOR SELECT
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can insert iterations to their sessions"
    ON analysis_iterations FOR INSERT
    TO authenticated
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can update iterations in their sessions"
    ON analysis_iterations FOR UPDATE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

CREATE POLICY "Users can delete iterations from their sessions"
    ON analysis_iterations FOR DELETE
    TO authenticated
    USING (
        session_id IN (
            SELECT id FROM analysis_sessions WHERE user_id = (select auth.uid())
        )
    );

-- Comments for documentation
COMMENT ON POLICY "Users can view their own sessions" ON analysis_sessions
  IS 'Optimized: auth.uid() wrapped in select to prevent row-by-row re-evaluation';

COMMENT ON POLICY "Users can view iterations from their sessions" ON analysis_iterations
  IS 'Optimized: auth.uid() wrapped in select to prevent row-by-row re-evaluation';


-- ============================================
-- Migration: 20251024040001_remove_duplicate_policies.sql
-- ============================================

-- Performance Optimization: Remove duplicate permissive policies
-- The service role automatically bypasses RLS, so "Service role" policies are redundant
-- This resolves multiple_permissive_policies warnings from Supabase linter

-- =====================================================
-- REMOVE SERVICE ROLE POLICIES
-- =====================================================
-- These policies are redundant because service role (supabaseAdmin) bypasses RLS anyway

DROP POLICY IF EXISTS "Service role can manage analyses" ON analyses;
DROP POLICY IF EXISTS "Service role can manage exports" ON analysis_exports;
DROP POLICY IF EXISTS "Service role can manage document categories" ON document_categories;
DROP POLICY IF EXISTS "Service role can manage regulatory documents" ON regulatory_documents;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage usage tracking" ON usage_tracking;

-- Comments for documentation
COMMENT ON TABLE analyses IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE analysis_exports IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE document_categories IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE regulatory_documents IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE subscriptions IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE usage_tracking IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';


-- ============================================
-- Migration: 20251024050000_create_old_dietary_ingredients.sql
-- ============================================

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


-- ============================================
-- Migration: 20251024100000_create_allergen_database.sql
-- ============================================

-- Create major allergens database table
-- Stores the 9 FDA-recognized major food allergens (FALCPA/FASTER Act) with comprehensive synonyms and derivatives

CREATE TABLE IF NOT EXISTS major_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allergen_name TEXT NOT NULL UNIQUE,
  allergen_category TEXT NOT NULL, -- 'milk', 'egg', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'sesame'
  common_name TEXT,
  derivatives TEXT[] NOT NULL DEFAULT '{}', -- Array of known derivatives and synonyms
  scientific_names TEXT[] DEFAULT '{}', -- Scientific/chemical names
  cross_reactive_allergens TEXT[] DEFAULT '{}', -- Related allergens that may cause cross-reactions
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  regulation_citation TEXT DEFAULT 'FALCPA Section 403(w), FASTER Act',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_allergens_category ON major_allergens(allergen_category);
CREATE INDEX IF NOT EXISTS idx_allergens_active ON major_allergens(is_active);
CREATE INDEX IF NOT EXISTS idx_allergens_name ON major_allergens(allergen_name);

-- Enable Row Level Security
ALTER TABLE major_allergens ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (anyone can check allergens)
CREATE POLICY "Allow public read access to allergens"
  ON major_allergens
  FOR SELECT
  TO public
  USING (is_active = true);

-- Create policy for authenticated users to read all allergens
CREATE POLICY "Allow authenticated read access to all allergens"
  ON major_allergens
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert the 9 major food allergens with comprehensive derivatives

-- 1. MILK
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Milk',
  'milk',
  'Dairy',
  ARRAY[
    'casein', 'caseinate', 'whey', 'lactalbumin', 'lactoglobulin', 'lactose',
    'butter', 'cream', 'cheese', 'ghee', 'yogurt', 'curds', 'milk powder',
    'artificial butter flavor', 'caramel color', 'milk solids', 'nonfat milk',
    'skim milk', 'whole milk', 'evaporated milk', 'condensed milk', 'buttermilk',
    'half and half', 'sour cream', 'milk protein', 'milk fat', 'sodium caseinate',
    'calcium caseinate', 'potassium caseinate', 'hydrolyzed casein', 'rennet casein',
    'whey protein', 'whey protein concentrate', 'whey protein isolate', 'lactulose',
    'tagatose', 'recaldent', 'simplesse', 'lactitol', 'lactyc esters of fatty acids'
  ],
  ARRAY['Lactose', 'Casein', 'Whey protein', 'Alpha-lactalbumin', 'Beta-lactoglobulin'],
  'Most common food allergen. Derivatives can be hidden in many processed foods.'
);

-- 2. EGGS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Eggs',
  'egg',
  'Eggs',
  ARRAY[
    'albumin', 'ovalbumin', 'globulin', 'lecithin', 'livetin', 'lysozyme',
    'ovoglobulin', 'ovomucoid', 'ovomucin', 'ovovitellin', 'egg white', 'egg yolk',
    'dried egg solids', 'mayonnaise', 'meringue', 'egg powder', 'egg substitute',
    'egg protein', 'whole egg', 'egg albumin', 'egg lecithin', 'dried egg',
    'powdered egg', 'eggnog', 'surimi', 'simplesse', 'ovoglycoprotein',
    'livetins', 'vitellin', 'apovitellin', 'phosvitin', 'silici albuminate'
  ],
  ARRAY['Ovalbumin', 'Ovomucoid', 'Ovotransferrin', 'Lysozyme', 'Ovomucin'],
  'Eggs are used as binders, leavening agents, and emulsifiers in many foods.'
);

-- 3. FISH
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Fish',
  'fish',
  'Finned Fish',
  ARRAY[
    'anchovy', 'bass', 'catfish', 'cod', 'flounder', 'haddock', 'hake', 'perch',
    'pike', 'pollock', 'salmon', 'sole', 'snapper', 'tilapia', 'tuna', 'trout',
    'fish gelatin', 'fish oil', 'surimi', 'isinglass', 'fish sauce', 'fish stock',
    'fish flavoring', 'worcestershire sauce', 'caesar dressing', 'anchovies',
    'bouillabaisse', 'caponata', 'caviar', 'roe', 'fish protein', 'dashi',
    'halibut', 'herring', 'mackerel', 'mahi mahi', 'marlin', 'orange roughy',
    'swordfish', 'shark', 'grouper', 'monkfish', 'sea bass'
  ],
  ARRAY['Parvalbumin', 'Fish collagen', 'Fish gelatin'],
  'Includes all finned fish species. Cross-contamination is common in seafood facilities.'
);

-- 4. CRUSTACEAN SHELLFISH
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Crustacean Shellfish',
  'shellfish',
  'Shellfish',
  ARRAY[
    'crab', 'lobster', 'shrimp', 'prawn', 'crayfish', 'krill', 'langoustine',
    'shellfish extract', 'shellfish flavoring', 'chitosan', 'glucosamine',
    'crawfish', 'crawdad', 'ecrevisse', 'scampi', 'tomalley', 'crab paste',
    'shrimp paste', 'barnacle', 'langouste', 'langostino', 'moreton bay bugs',
    'scampi', 'yabbies', 'shrimp powder', 'crab oil', 'lobster oil',
    'shellfish stock', 'crab stock', 'shrimp stock'
  ],
  ARRAY['Tropomyosin', 'Arginine kinase', 'Myosin light chain'],
  'Does not include mollusks (clams, oysters, scallops) which are not major allergens under FALCPA.'
);

-- 5. TREE NUTS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Tree Nuts',
  'tree_nuts',
  'Tree Nuts',
  ARRAY[
    'almond', 'brazil nut', 'cashew', 'chestnut', 'filbert', 'hazelnut',
    'hickory nut', 'macadamia nut', 'pecan', 'pine nut', 'pignolia', 'pistachio',
    'walnut', 'nut butters', 'nut oils', 'praline', 'marzipan', 'nougat',
    'gianduja', 'nut paste', 'nut flour', 'nut meal', 'nut milk', 'almond milk',
    'cashew milk', 'beechnut', 'butternut', 'chinquapin', 'coconut', 'ginkgo nut',
    'shea nut', 'litchi', 'lychee', 'mandelonas', 'natural nut extract',
    'nut flavoring', 'queensland nut', 'amaretto', 'frangelico', 'nocello',
    'nutella', 'nut oil', 'almond extract', 'almond oil', 'walnut oil',
    'hazelnut oil', 'macadamia oil', 'pistachio oil'
  ],
  ARRAY['Ara h 1', 'Ara h 2', 'Ara h 3', 'Cor a 1', 'Jug r 1'],
  'Each tree nut type is considered a separate allergen, but FDA requires declaration of specific nut type.'
);

-- 6. PEANUTS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Peanuts',
  'peanuts',
  'Groundnuts',
  ARRAY[
    'groundnuts', 'peanut flour', 'peanut oil', 'peanut butter', 'arachis oil',
    'hydrolyzed plant protein', 'artificial nuts', 'peanut meal', 'peanut protein isolate',
    'peanut protein', 'beer nuts', 'goober peas', 'ground nuts', 'mandelonas',
    'monkey nuts', 'nut meat', 'nu-nuts', 'peanut paste', 'peanut sauce',
    'peanut syrup', 'cold pressed peanut oil', 'extruded peanut oil',
    'goobers', 'arachis hypogaea', 'peanut extract', 'peanut flavoring',
    'mixed nuts', 'trail mix', 'satay sauce', 'pad thai', 'mole sauce'
  ],
  ARRAY['Ara h 1', 'Ara h 2', 'Ara h 3', 'Ara h 6', 'Arachis hypogaea'],
  'Peanuts are legumes, not true nuts. Highly refined peanut oil is generally exempt from labeling.'
);

-- 7. WHEAT
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Wheat',
  'wheat',
  'Wheat',
  ARRAY[
    'bran', 'bread crumbs', 'bulgur', 'couscous', 'durum', 'einkorn', 'emmer',
    'farina', 'farro', 'flour', 'gluten', 'hydrolyzed wheat protein', 'kamut',
    'malt', 'semolina', 'seitan', 'spelt', 'vital wheat gluten', 'wheat germ',
    'modified food starch', 'wheat protein', 'wheat starch', 'wheat flour',
    'all purpose flour', 'enriched flour', 'graham flour', 'whole wheat',
    'wheat berries', 'wheat grass', 'wheat grass juice', 'triticale', 'fu',
    'matzo', 'matzah', 'matzoh', 'panko', 'wheat bran', 'wheat gluten',
    'wheat malt', 'wheat protein isolate', 'bromated flour', 'club wheat',
    'common wheat', 'sprouted wheat', 'wheat triticum', 'wheat albumin',
    'wheat gliadin', 'wheat globulin', 'wheat starch', 'udon'
  ],
  ARRAY['Gliadin', 'Glutenin', 'Wheat albumin', 'Triticum aestivum'],
  'Gluten-free does not mean wheat-free. Different from celiac disease (gluten intolerance).'
);

-- 8. SOYBEANS
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Soybeans',
  'soybeans',
  'Soy',
  ARRAY[
    'edamame', 'miso', 'natto', 'shoyu', 'soy flour', 'soy protein concentrate',
    'soy protein isolate', 'soy lecithin', 'soy oil', 'soy milk', 'tempeh',
    'textured vegetable protein', 'tofu', 'hydrolyzed soy protein', 'msg',
    'soy sauce', 'soy protein', 'soy albumin', 'soy fiber', 'soy grits',
    'soy nuts', 'soybean oil', 'soybean paste', 'tamari', 'teriyaki sauce',
    'hydrolyzed vegetable protein', 'TVP', 'textured soy protein', 'soya',
    'soya flour', 'bean curd', 'kinako', 'kyodofu', 'yuba', 'okara',
    'soy isoflavones', 'soy mono and diglycerides', 'soy sprouts', 'yaki-dofu',
    'glycine max', 'monosodium glutamate', 'vegetable gum', 'vegetable starch'
  ],
  ARRAY['Glycinin', 'Beta-conglycinin', 'Glycine max', 'Soy albumin'],
  'Highly refined soy oil and soy lecithin are generally exempt. MSG may be soy-derived.'
);

-- 9. SESAME
INSERT INTO major_allergens (allergen_name, allergen_category, common_name, derivatives, scientific_names, notes)
VALUES (
  'Sesame',
  'sesame',
  'Sesame Seeds',
  ARRAY[
    'sesame seeds', 'sesame oil', 'tahini', 'gingelly oil', 'benne', 'benne seed',
    'til', 'sesame flour', 'sesame protein isolate', 'sesame paste', 'sesame salt',
    'sesamol', 'sesamum indicum', 'sesamolina', 'sim sim', 'gomasio', 'gomashio',
    'halvah', 'halva', 'halawa', 'hummus', 'baba ghanoush', 'sesame butter',
    'sesame sticks', 'sesame crackers', 'sesame seed oil', 'toasted sesame oil',
    'black sesame', 'white sesame', 'hulled sesame', 'unhulled sesame'
  ],
  ARRAY['Sesamum indicum', 'Ses i 1', 'Ses i 2', 'Ses i 3'],
  'Added as 9th major allergen by FASTER Act, effective January 1, 2023. Previously voluntary.'
);

-- Add comments to table
COMMENT ON TABLE major_allergens IS 'FDA-recognized major food allergens per FALCPA/FASTER Act with comprehensive derivatives and synonyms';
COMMENT ON COLUMN major_allergens.allergen_name IS 'Official FDA allergen name';
COMMENT ON COLUMN major_allergens.allergen_category IS 'Normalized category slug for grouping';
COMMENT ON COLUMN major_allergens.derivatives IS 'Array of known derivatives, synonyms, and ingredient names containing this allergen';
COMMENT ON COLUMN major_allergens.scientific_names IS 'Scientific/chemical names and protein markers';
COMMENT ON COLUMN major_allergens.regulation_citation IS 'Regulatory reference (FALCPA/FASTER Act)';


-- ============================================
-- Migration: 20251029000000_add_label_name.sql
-- ============================================

/*
  Add label_name field to analyses table

  This migration adds a user-editable label_name field to allow users to
  name/organize their analyses independently of AI-extracted product names.

  - label_name: User-provided name for the label/product (nullable, TEXT)
  - Updated index to support searching by label_name
*/

-- Add label_name column to analyses table
ALTER TABLE analyses
ADD COLUMN IF NOT EXISTS label_name TEXT;

-- Add comment to describe the field
COMMENT ON COLUMN analyses.label_name IS
  'User-provided name for the label/product. Allows users to organize and search their analyses independently of AI-extracted product names.';

-- Create index for searching by label_name
CREATE INDEX IF NOT EXISTS idx_analyses_label_name ON analyses(label_name);

-- Create a GIN index for full-text search on label_name (optional but helpful for search)
CREATE INDEX IF NOT EXISTS idx_analyses_label_name_gin
  ON analyses USING gin(to_tsvector('english', COALESCE(label_name, '')));


-- ============================================
-- Migration: 20251029100000_update_plan_tiers.sql
-- ============================================

/*
  Update Plan Tier Names

  Changes plan tier enum from (basic, pro, enterprise) to (starter, professional, business)

  New pricing structure:
  - Starter: $49/mo, 10 analyses
  - Professional: $149/mo, 50 analyses (target tier)
  - Business: $399/mo, 200 analyses
*/

-- Add new enum values to plan_tier_type
ALTER TYPE plan_tier_type ADD VALUE IF NOT EXISTS 'starter';
ALTER TYPE plan_tier_type ADD VALUE IF NOT EXISTS 'professional';
ALTER TYPE plan_tier_type ADD VALUE IF NOT EXISTS 'business';

-- Update existing subscription records (if any exist)
-- Map: basic → starter, pro → professional, enterprise → business
UPDATE subscriptions
SET plan_tier = 'starter'
WHERE plan_tier = 'basic';

UPDATE subscriptions
SET plan_tier = 'professional'
WHERE plan_tier = 'pro';

UPDATE subscriptions
SET plan_tier = 'business'
WHERE plan_tier = 'enterprise';

-- Update organization plan tiers (if any exist)
UPDATE organizations
SET plan_tier = 'starter'
WHERE plan_tier = 'basic';

UPDATE organizations
SET plan_tier = 'professional'
WHERE plan_tier = 'pro';

UPDATE organizations
SET plan_tier = 'business'
WHERE plan_tier = 'enterprise';

-- Note: We cannot remove old enum values ('basic', 'pro', 'enterprise')
-- without recreating the type, which would require dropping dependent columns.
-- The old values remain in the enum but are no longer used.
-- Future migrations can clean this up if needed by:
--   1. Creating new enum type with only new values
--   2. Altering columns to use new type
--   3. Dropping old type

-- Update default value for new subscriptions
ALTER TABLE subscriptions
ALTER COLUMN plan_tier SET DEFAULT 'starter';

-- Update default value for new organizations
ALTER TABLE organizations
ALTER COLUMN plan_tier SET DEFAULT 'starter';

-- Add comment explaining the plan structure
COMMENT ON COLUMN subscriptions.plan_tier IS
  'Subscription plan tier: starter ($49/mo, 10 analyses), professional ($149/mo, 50 analyses), business ($399/mo, 200 analyses)';

COMMENT ON COLUMN organizations.plan_tier IS
  'Organization plan tier: starter ($49/mo, 10 analyses), professional ($149/mo, 50 analyses), business ($399/mo, 200 analyses)';

