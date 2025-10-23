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
export type ProductCategory = 'CONVENTIONAL_FOOD' | 'DIETARY_SUPPLEMENT' | 'ALCOHOLIC_BEVERAGE' | 'NON_ALCOHOLIC_BEVERAGE';

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
  source_url?: string | null;
  effective_date?: string;
  version?: string;
  category_id?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export type CategoryConfidence = 'high' | 'medium' | 'low';

export interface Analysis {
  id: string;
  user_id: string;
  image_url: string;
  image_name: string;
  analysis_result: any;
  compliance_status: string;
  issues_found: number;
  session_id: string | null;
  product_category: ProductCategory | null;
  category_rationale: string | null;
  category_confidence: CategoryConfidence | null;
  is_category_ambiguous: boolean;
  alternative_categories: ProductCategory[] | null;
  user_selected_category: ProductCategory | null;
  category_selection_reason: string | null;
  compared_categories: boolean;
  created_at: string;
}

export type SessionStatus = 'in_progress' | 'resolved' | 'archived';
export type IterationType = 'image_analysis' | 'text_check' | 'chat_question' | 'revised_analysis';

export interface AnalysisSession {
  id: string;
  user_id: string;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface AnalysisIteration {
  id: string;
  session_id: string;
  iteration_type: IterationType;
  input_data: any; // JSONB - flexible structure based on iteration_type
  result_data: any | null; // JSONB - AI response or analysis result
  analysis_id: string | null; // Links to analyses table for image analyses
  parent_iteration_id: string | null; // For threading conversations
  created_at: string;
}
