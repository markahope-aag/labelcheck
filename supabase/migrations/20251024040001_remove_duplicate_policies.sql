-- Performance Optimization: Remove duplicate permissive policies
-- The service role automatically bypasses RLS, so "Service role" policies are redundant
-- This resolves multiple_permissive_policies warnings from Supabase linter

-- =====================================================
-- REMOVE SERVICE ROLE POLICIES
-- =====================================================
-- These policies are redundant because service role (supabaseAdmin) bypasses RLS anyway

DROP POLICY IF EXISTS "Service role can manage analyses" ON analyses;
DROP POLICY IF EXISTS "Service role can manage exports" ON analysis_exports;
DROP POLICY IF EXISTS "Service role can manage document categories" ON document_categories;
DROP POLICY IF EXISTS "Service role can manage regulatory documents" ON regulatory_documents;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Service role can manage usage tracking" ON usage_tracking;

-- Comments for documentation
COMMENT ON TABLE analyses IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE analysis_exports IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE document_categories IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE regulatory_documents IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE subscriptions IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';

COMMENT ON TABLE usage_tracking IS
  'Performance: Removed redundant service role policy. Service role bypasses RLS automatically.';
