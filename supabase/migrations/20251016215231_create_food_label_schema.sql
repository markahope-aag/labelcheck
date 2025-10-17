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