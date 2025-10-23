-- Add product_category and category_rationale columns to analyses table
-- This enables category-specific regulatory compliance checking

-- Add product_category column with constraint to ensure valid values
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS product_category TEXT
  CHECK (product_category IN (
    'CONVENTIONAL_FOOD',
    'DIETARY_SUPPLEMENT',
    'ALCOHOLIC_BEVERAGE',
    'NON_ALCOHOLIC_BEVERAGE'
  ));

-- Add category_rationale column to explain classification
ALTER TABLE analyses ADD COLUMN IF NOT EXISTS category_rationale TEXT;

-- Create index for faster filtering by product category
CREATE INDEX IF NOT EXISTS idx_analyses_product_category
  ON analyses(product_category)
  WHERE product_category IS NOT NULL;

-- Add column comments for documentation
COMMENT ON COLUMN analyses.product_category IS
  'Regulatory product category: CONVENTIONAL_FOOD | DIETARY_SUPPLEMENT | ALCOHOLIC_BEVERAGE | NON_ALCOHOLIC_BEVERAGE. Determines which regulatory framework applies to the label analysis.';

COMMENT ON COLUMN analyses.category_rationale IS
  'Explanation of why the product was classified into its product_category, citing specific label elements observed.';
