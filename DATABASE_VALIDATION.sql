-- ============================================
-- LabelCheck Database Validation Script
-- Run this in Supabase SQL Editor to verify everything is correct
-- ============================================

-- ============================================
-- 1. CHECK ALL REQUIRED TABLES EXIST
-- ============================================
SELECT
  'All Required Tables' as check_type,
  CASE
    WHEN COUNT(*) >= 17 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing tables'
  END as status,
  COUNT(*) || ' tables found (expected: 17+)' as details
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE';

-- List all tables
SELECT
  '  - ' || table_name as table_list
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================
-- 2. CHECK ANALYSES TABLE HAS CRITICAL COLUMNS
-- ============================================
SELECT
  'Analyses Table - Critical Columns' as check_type,
  CASE
    WHEN COUNT(*) >= 4 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing columns'
  END as status,
  COUNT(*) || ' critical columns found (expected: 4)' as details
FROM information_schema.columns
WHERE table_name = 'analyses'
  AND column_name IN ('label_name', 'product_category', 'share_token', 'category_rationale');

-- List what we found
SELECT
  '  - ' || column_name as found_columns
FROM information_schema.columns
WHERE table_name = 'analyses'
  AND column_name IN ('label_name', 'product_category', 'share_token', 'category_rationale', 'is_category_ambiguous', 'alternative_categories')
ORDER BY column_name;

-- ============================================
-- 3. CHECK PLAN TIER ENUM VALUES
-- ============================================
SELECT
  'Plan Tier Enum Values' as check_type,
  CASE
    WHEN COUNT(*) >= 6 THEN '✅ PASS'
    ELSE '❌ FAIL - Missing enum values'
  END as status,
  COUNT(*) || ' enum values found (expected: 6)' as details
FROM pg_enum
WHERE enumtypid = 'plan_tier_type'::regtype;

-- List enum values
SELECT
  '  - ' || enumlabel as enum_values
FROM pg_enum
WHERE enumtypid = 'plan_tier_type'::regtype
ORDER BY enumlabel;

-- ============================================
-- 4. CHECK SUBSCRIPTIONS TABLE STRUCTURE
-- ============================================
SELECT
  'Subscriptions Table' as check_type,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'subscriptions' AND column_name = 'plan_tier')
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as status,
  'plan_tier column exists' as details;

-- Check current plan tier values in subscriptions (if any data exists)
SELECT
  'Subscription Plan Distribution' as check_type,
  COALESCE(plan_tier::text, 'NULL') as plan_tier,
  COUNT(*) as count
FROM subscriptions
GROUP BY plan_tier
UNION ALL
SELECT
  'Total Subscriptions' as check_type,
  'ALL' as plan_tier,
  COUNT(*) as count
FROM subscriptions;

-- ============================================
-- 5. CHECK REGULATORY DATA TABLES
-- ============================================
SELECT
  'Regulatory Data Tables' as check_type,
  table_name,
  (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_name = tables.table_name) as exists_count,
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.tables t WHERE t.table_name = tables.table_name) > 0
    THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
FROM (
  VALUES
    ('gras_ingredients'),
    ('ndi_ingredients'),
    ('old_dietary_ingredients'),
    ('allergen_database'),
    ('major_allergens')
) as tables(table_name);

-- Check if regulatory data has been imported
SELECT
  'GRAS Ingredients' as data_table,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ EMPTY (data import needed)'
  END as status
FROM gras_ingredients
UNION ALL
SELECT
  'NDI Ingredients' as data_table,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ EMPTY (data import needed)'
  END as status
FROM ndi_ingredients
UNION ALL
SELECT
  'Old Dietary Ingredients' as data_table,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ EMPTY (data import needed)'
  END as status
FROM old_dietary_ingredients
UNION ALL
SELECT
  'Allergen Database' as data_table,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ EMPTY (data import needed)'
  END as status
FROM allergen_database
UNION ALL
SELECT
  'Major Allergens (old table)' as data_table,
  COUNT(*) as row_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS DATA'
    ELSE '⚠️ EMPTY'
  END as status
FROM major_allergens;

-- ============================================
-- 6. CHECK ROW LEVEL SECURITY (RLS)
-- ============================================
SELECT
  'RLS Enabled Tables' as check_type,
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'users', 'subscriptions', 'analyses', 'usage_tracking',
    'organizations', 'organization_members', 'pending_invitations',
    'gras_ingredients', 'ndi_ingredients', 'old_dietary_ingredients',
    'user_settings', 'allergen_database'
  )
ORDER BY tablename;

-- ============================================
-- 7. CHECK INDEXES
-- ============================================
SELECT
  'Critical Indexes' as check_type,
  schemaname,
  tablename,
  indexname,
  '✅ EXISTS' as status
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_analyses_%'
    OR indexname LIKE 'idx_gras_%'
    OR indexname LIKE 'idx_allergen_%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 8. CHECK USER DATA (if any exists)
-- ============================================
SELECT
  'User Data' as check_type,
  COUNT(*) as user_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS USERS'
    ELSE '⚠️ NO USERS YET'
  END as status
FROM users;

-- ============================================
-- 9. CHECK ANALYSES DATA (if any exists)
-- ============================================
SELECT
  'Analysis Data' as check_type,
  COUNT(*) as analysis_count,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ HAS ANALYSES'
    ELSE '⚠️ NO ANALYSES YET'
  END as status
FROM analyses;

-- If analyses exist, check product category distribution
SELECT
  'Product Category Distribution' as check_type,
  COALESCE(product_category::text, 'NULL/Not Set') as category,
  COUNT(*) as count
FROM analyses
GROUP BY product_category
ORDER BY count DESC;

-- ============================================
-- SUMMARY
-- ============================================
SELECT
  '========================================' as summary;
SELECT
  'DATABASE VALIDATION COMPLETE' as summary;
SELECT
  '========================================' as summary;

-- Quick health check
SELECT
  CASE
    WHEN (
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') >= 17
      AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'analyses' AND column_name IN ('label_name', 'product_category', 'share_token')) >= 3
      AND (SELECT COUNT(*) FROM pg_enum WHERE enumtypid = 'plan_tier_type'::regtype) >= 6
    ) THEN '✅ DATABASE IS PRODUCTION READY'
    ELSE '⚠️ DATABASE NEEDS ATTENTION - Check details above'
  END as overall_status;
