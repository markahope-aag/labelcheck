-- Create bundle_purchases table for one-time analysis bundle purchases
-- Bundles are purchased separately from subscriptions and roll over until used

CREATE TABLE IF NOT EXISTS bundle_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  analyses_count INTEGER NOT NULL,
  price_paid DECIMAL(10, 2) NOT NULL,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_product_id TEXT,
  analyses_remaining INTEGER NOT NULL, -- Tracks remaining unused analyses from this bundle
  purchased_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_bundle_purchases_user_id ON bundle_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_bundle_purchases_stripe_payment_intent ON bundle_purchases(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_bundle_purchases_remaining ON bundle_purchases(user_id, analyses_remaining) WHERE analyses_remaining > 0;

-- RLS Policies
ALTER TABLE bundle_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own bundle purchases
CREATE POLICY "Users can view their own bundle purchases"
  ON bundle_purchases
  FOR SELECT
  TO authenticated
  USING (
    user_id IN (
      SELECT id FROM users WHERE clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- Users cannot insert their own bundles (only via webhook)
CREATE POLICY "Only service role can insert bundle purchases"
  ON bundle_purchases
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Only service role can update bundle purchases (for usage tracking)
CREATE POLICY "Only service role can update bundle purchases"
  ON bundle_purchases
  FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE bundle_purchases IS 'Stores one-time analysis bundle purchases. Bundle analyses roll over until used.';
COMMENT ON COLUMN bundle_purchases.analyses_remaining IS 'Number of unused analyses remaining from this bundle purchase';
COMMENT ON COLUMN bundle_purchases.stripe_payment_intent_id IS 'Stripe payment intent ID for the bundle purchase';

