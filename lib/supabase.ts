import { createClient } from '@supabase/supabase-js';

// Import all types from centralized location
import type {
  PlanTier,
  SubscriptionStatus,
  ProductCategory,
  CategoryConfidence,
  SessionStatus,
  IterationType,
  User,
  Subscription,
  UsageTracking,
  Analysis,
  AnalysisSession,
  AnalysisIteration,
  RegulatoryDocument,
  NDIIngredient,
} from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client for regular operations (respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : supabase; // Fallback to regular client if service key not available

// Re-export types from centralized types directory for backwards compatibility
export type {
  PlanTier,
  SubscriptionStatus,
  ProductCategory,
  CategoryConfidence,
  SessionStatus,
  IterationType,
  User,
  Subscription,
  UsageTracking,
  Analysis,
  AnalysisSession,
  AnalysisIteration,
  RegulatoryDocument,
  NDIIngredient,
};
