import { createClient } from '@supabase/supabase-js';

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
        persistSession: false
      }
    })
  : supabase; // Fallback to regular client if service key not available

export type PlanTier = 'basic' | 'pro' | 'enterprise';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface RegulatoryDocument {
  id: string;
  title: string;
  description?: string;
  content: string;
  document_type: 'federal_law' | 'state_regulation' | 'guideline' | 'standard' | 'policy' | 'other';
  jurisdiction?: string;
  source?: string;
  effective_date?: string;
  version?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_tier: PlanTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

export interface UsageTracking {
  id: string;
  user_id: string;
  month: string;
  analyses_used: number;
  analyses_limit: number;
  created_at: string;
  updated_at: string;
}

export interface Analysis {
  id: string;
  user_id: string;
  image_url: string;
  image_name: string;
  analysis_result: any;
  compliance_status: string;
  issues_found: number;
  created_at: string;
}
