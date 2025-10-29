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
