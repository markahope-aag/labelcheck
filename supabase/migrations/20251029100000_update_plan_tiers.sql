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
