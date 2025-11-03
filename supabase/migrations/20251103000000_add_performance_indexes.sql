-- Performance Optimization: Add missing database indexes
-- Session 14 - Quick Win #3
-- Expected impact: 50-70% faster queries on frequently accessed columns

-- ============================================================================
-- analyses table indexes
-- ============================================================================

-- Session-based lookups (analysis iterations feature)
CREATE INDEX IF NOT EXISTS idx_analyses_session_id
  ON analyses(session_id);

-- Filter by product category (history page, analytics)
CREATE INDEX IF NOT EXISTS idx_analyses_product_category
  ON analyses(product_category);

-- Sort by creation date descending (history page default sort)
CREATE INDEX IF NOT EXISTS idx_analyses_created_at_desc
  ON analyses(created_at DESC);

-- Composite index for user's recent analyses (most common query)
CREATE INDEX IF NOT EXISTS idx_analyses_user_created
  ON analyses(user_id, created_at DESC);

-- ============================================================================
-- gras_ingredients indexes
-- ============================================================================

-- Case-insensitive ingredient name lookups (exact matching)
CREATE INDEX IF NOT EXISTS idx_gras_ingredients_name_lower
  ON gras_ingredients(LOWER(ingredient_name));

-- Composite index for active ingredient lookups (most common query)
CREATE INDEX IF NOT EXISTS idx_gras_ingredients_active_name
  ON gras_ingredients(is_active, ingredient_name)
  WHERE is_active = true;

-- ============================================================================
-- ndi_ingredients indexes
-- ============================================================================

-- Case-insensitive ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_ndi_ingredients_name_lower
  ON ndi_ingredients(LOWER(ingredient_name));

-- Note: ndi_ingredients table doesn't have is_active column
-- All NDI records are considered active by default

-- ============================================================================
-- old_dietary_ingredients indexes
-- ============================================================================

-- Case-insensitive ingredient name lookups
CREATE INDEX IF NOT EXISTS idx_odi_ingredients_name_lower
  ON old_dietary_ingredients(LOWER(ingredient_name));

-- Active ingredients only (partial index for common filter)
CREATE INDEX IF NOT EXISTS idx_odi_ingredients_active
  ON old_dietary_ingredients(is_active)
  WHERE is_active = true;

-- ============================================================================
-- allergen_database indexes (major_allergens table)
-- ============================================================================

-- Case-insensitive allergen name lookups
CREATE INDEX IF NOT EXISTS idx_allergen_database_name_lower
  ON major_allergens(LOWER(allergen_name));

-- GIN index for array-based derivative searches
CREATE INDEX IF NOT EXISTS idx_allergen_database_derivatives
  ON major_allergens USING GIN (derivatives);

-- ============================================================================
-- usage_tracking indexes
-- ============================================================================

-- Composite index for user monthly usage lookups (rate limiting)
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_month
  ON usage_tracking(user_id, month);

-- ============================================================================
-- organization_members indexes
-- ============================================================================

-- Composite index for organization member role lookups
CREATE INDEX IF NOT EXISTS idx_organization_members_org_role
  ON organization_members(organization_id, role);

-- ============================================================================
-- analysis_iterations indexes
-- ============================================================================

-- Session-based iteration lookups with temporal ordering
CREATE INDEX IF NOT EXISTS idx_analysis_iterations_session
  ON analysis_iterations(session_id, created_at DESC);

-- ============================================================================
-- Update table statistics for query planner
-- ============================================================================

-- Rebuild statistics to help PostgreSQL choose optimal query plans
ANALYZE analyses;
ANALYZE gras_ingredients;
ANALYZE ndi_ingredients;
ANALYZE old_dietary_ingredients;
ANALYZE major_allergens;
ANALYZE usage_tracking;
ANALYZE organization_members;
ANALYZE analysis_iterations;

-- ============================================================================
-- Index creation completed
-- ============================================================================

-- Helpful comment for future reference
COMMENT ON INDEX idx_analyses_user_created IS
  'Optimizes user history queries with temporal sorting (most common access pattern)';

COMMENT ON INDEX idx_gras_ingredients_name_lower IS
  'Enables fast case-insensitive ingredient matching for GRAS compliance checks';

COMMENT ON INDEX idx_usage_tracking_user_month IS
  'Optimizes rate limiting queries (user + month composite key)';
