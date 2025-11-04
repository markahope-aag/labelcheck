-- Add trial_start_date column to users table
-- This tracks when a user's free trial started (14-day limit)
-- Only set for users without active subscriptions

ALTER TABLE users
ADD COLUMN IF NOT EXISTS trial_start_date TIMESTAMPTZ;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_trial_start_date ON users(trial_start_date) WHERE trial_start_date IS NOT NULL;

-- Set trial_start_date for existing users without subscriptions
-- Use their created_at date as the trial start
UPDATE users
SET trial_start_date = created_at
WHERE trial_start_date IS NULL
  AND id NOT IN (
    SELECT DISTINCT user_id 
    FROM subscriptions 
    WHERE status = 'active'
  );

COMMENT ON COLUMN users.trial_start_date IS 'Start date of the free trial. Trial expires 14 days after this date. Only set for users without active subscriptions.';

