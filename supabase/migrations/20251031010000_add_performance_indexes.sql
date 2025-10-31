-- Add performance indexes for frequently queried columns
-- These indexes improve query performance for filtering and sorting operations

-- Index for filtering analyses by compliance status (used in history page, admin dashboard)
CREATE INDEX IF NOT EXISTS idx_analyses_compliance_status ON analyses(compliance_status);

-- Index for filtering organization members by role (used in team management, permission checks)
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);

-- Index for querying pending invitations by expiration date (used for cleanup, validation)
CREATE INDEX IF NOT EXISTS idx_pending_invitations_expires_at ON pending_invitations(expires_at);

-- Index for filtering analyses by user (frequently used in user dashboard, history)
-- This may already exist, but adding IF NOT EXISTS for safety
CREATE INDEX IF NOT EXISTS idx_analyses_user_id ON analyses(user_id);

-- Index for filtering usage tracking by month (used for billing, analytics)
CREATE INDEX IF NOT EXISTS idx_usage_tracking_month ON usage_tracking(month);

-- Composite index for organization member lookups (org + user combination is frequently queried)
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user ON organization_members(organization_id, user_id);
