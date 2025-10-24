-- Security Fix: Set search_path for trigger functions
-- Addresses Supabase security warnings for mutable search_path

-- Fix update_analysis_sessions_updated_at function
ALTER FUNCTION update_analysis_sessions_updated_at()
  SECURITY DEFINER
  SET search_path = public;

-- Fix update_gras_ingredients_updated_at function
ALTER FUNCTION update_gras_ingredients_updated_at()
  SECURITY DEFINER
  SET search_path = public;

-- Fix update_updated_at_column function
ALTER FUNCTION update_updated_at_column()
  SECURITY DEFINER
  SET search_path = public;

-- Add comments for documentation
COMMENT ON FUNCTION update_analysis_sessions_updated_at() IS
  'Trigger function to update analysis_sessions.updated_at timestamp. Search path locked to public schema for security.';

COMMENT ON FUNCTION update_gras_ingredients_updated_at() IS
  'Trigger function to update gras_ingredients.updated_at timestamp. Search path locked to public schema for security.';

COMMENT ON FUNCTION update_updated_at_column() IS
  'Generic trigger function to update updated_at timestamps. Search path locked to public schema for security.';
