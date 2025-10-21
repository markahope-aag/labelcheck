-- Add missing fields to regulatory_documents table
-- Run this in your Supabase SQL Editor

ALTER TABLE regulatory_documents
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'guideline',
  ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR(255),
  ADD COLUMN IF NOT EXISTS source VARCHAR(255),
  ADD COLUMN IF NOT EXISTS effective_date DATE,
  ADD COLUMN IF NOT EXISTS version VARCHAR(50);

-- Add a check constraint for document_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'regulatory_documents_document_type_check'
  ) THEN
    ALTER TABLE regulatory_documents
      ADD CONSTRAINT regulatory_documents_document_type_check
      CHECK (document_type IN ('federal_law', 'state_regulation', 'guideline', 'standard', 'policy', 'other'));
  END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_regulatory_documents_document_type
  ON regulatory_documents(document_type);

CREATE INDEX IF NOT EXISTS idx_regulatory_documents_jurisdiction
  ON regulatory_documents(jurisdiction);

CREATE INDEX IF NOT EXISTS idx_regulatory_documents_effective_date
  ON regulatory_documents(effective_date);

-- Add comment to table
COMMENT ON COLUMN regulatory_documents.description IS 'Brief description of the regulatory document';
COMMENT ON COLUMN regulatory_documents.document_type IS 'Type of regulation: federal_law, state_regulation, guideline, standard, policy, or other';
COMMENT ON COLUMN regulatory_documents.jurisdiction IS 'Geographic area where regulation applies (e.g., United States, California, etc.)';
COMMENT ON COLUMN regulatory_documents.source IS 'Citation or reference (e.g., FDA 21 CFR 101.9)';
COMMENT ON COLUMN regulatory_documents.effective_date IS 'Date when the regulation became effective';
COMMENT ON COLUMN regulatory_documents.version IS 'Version number or identifier';
