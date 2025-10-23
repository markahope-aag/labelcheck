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
