-- Add share_token column to analyses table for shareable links

ALTER TABLE analyses ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_analyses_share_token ON analyses(share_token) WHERE share_token IS NOT NULL;

COMMENT ON COLUMN analyses.share_token IS 'Unique token for generating shareable public links to analysis results';
