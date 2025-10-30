-- ============================================
-- LabelCheck Differential Migration - PART 2
-- Run this AFTER PART 1 completes successfully
-- ============================================

-- ============================================
-- UPDATE PLAN TIERS FROM OLD TO NEW NAMING
-- ============================================

-- Update existing subscription records
-- This can now safely use the new enum values that were committed in Part 1
UPDATE subscriptions
SET plan_tier = 'starter'
WHERE plan_tier = 'basic';

UPDATE subscriptions
SET plan_tier = 'professional'
WHERE plan_tier = 'pro';

UPDATE subscriptions
SET plan_tier = 'business'
WHERE plan_tier = 'enterprise';

-- Update organization plan tiers
UPDATE organizations
SET plan_tier = 'starter'
WHERE plan_tier = 'basic';

UPDATE organizations
SET plan_tier = 'professional'
WHERE plan_tier = 'pro';

UPDATE organizations
SET plan_tier = 'business'
WHERE plan_tier = 'enterprise';

-- Update defaults for new records
ALTER TABLE subscriptions
ALTER COLUMN plan_tier SET DEFAULT 'starter';

ALTER TABLE organizations
ALTER COLUMN plan_tier SET DEFAULT 'starter';

-- ============================================
-- VERIFY MIGRATION SUCCESS
-- ============================================

DO $$
DECLARE
  missing_columns TEXT := '';
  subscription_count INTEGER;
  org_count INTEGER;
BEGIN
  -- Check for label_name
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyses' AND column_name = 'label_name'
  ) THEN
    missing_columns := missing_columns || 'analyses.label_name, ';
  END IF;

  -- Check for product_category
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyses' AND column_name = 'product_category'
  ) THEN
    missing_columns := missing_columns || 'analyses.product_category, ';
  END IF;

  -- Check for share_token
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'analyses' AND column_name = 'share_token'
  ) THEN
    missing_columns := missing_columns || 'analyses.share_token, ';
  END IF;

  -- Check how many subscriptions were updated
  SELECT COUNT(*) INTO subscription_count
  FROM subscriptions
  WHERE plan_tier IN ('starter', 'professional', 'business');

  -- Check how many organizations were updated
  SELECT COUNT(*) INTO org_count
  FROM organizations
  WHERE plan_tier IN ('starter', 'professional', 'business');

  IF missing_columns != '' THEN
    RAISE NOTICE 'WARNING: Missing columns: %', missing_columns;
  ELSE
    RAISE NOTICE '✅ SUCCESS: All critical columns present';
  END IF;

  RAISE NOTICE '✅ Subscriptions with new plan tiers: %', subscription_count;
  RAISE NOTICE '✅ Organizations with new plan tiers: %', org_count;
  RAISE NOTICE '✅ Migration complete!';
END $$;
