/**
 * Type Definitions for Database Tables
 *
 * These types mirror the Supabase database schema.
 * Extracted from lib/supabase.ts for better organization.
 */

import type { AnalysisResult } from './analysis';

// ============================================================================
// Enum Types
// ============================================================================

export type PlanTier = 'starter' | 'professional' | 'business';

export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export type ProductCategory =
  | 'CONVENTIONAL_FOOD'
  | 'DIETARY_SUPPLEMENT'
  | 'ALCOHOLIC_BEVERAGE'
  | 'NON_ALCOHOLIC_BEVERAGE';

export type CategoryConfidence = 'high' | 'medium' | 'low';

export type SessionStatus = 'in_progress' | 'resolved' | 'archived';

export type IterationType = 'image_analysis' | 'text_check' | 'chat_question' | 'revised_analysis';

export type DocumentType =
  | 'federal_law'
  | 'state_regulation'
  | 'guideline'
  | 'standard'
  | 'policy'
  | 'other';

export type GRASStatus = 'affirmed' | 'notice' | 'scogs' | 'pending';

// ============================================================================
// User & Authentication Types
// ============================================================================

export interface User {
  id: string;
  clerk_user_id: string;
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Subscription & Usage Types
// ============================================================================

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
  month: string; // Format: 'YYYY-MM'
  analyses_used: number;
  analyses_limit: number; // -1 = unlimited
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Analysis Types
// ============================================================================

export interface Analysis {
  id: string;
  user_id: string;
  image_url: string;
  image_name: string;
  label_name: string | null;
  analysis_result: AnalysisResult; // Now properly typed!
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
  share_token: string | null;
  created_at: string;
}

// ============================================================================
// Analysis Session Types
// ============================================================================

export interface AnalysisSession {
  id: string;
  user_id: string;
  title: string | null;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface AnalysisIterationInputData {
  // For image_analysis
  fileName?: string;
  fileType?: string;
  fileSize?: number;

  // For text_check
  inputType?: 'text' | 'pdf';
  textContent?: string;
  pdfFileName?: string;
  pdfSize?: number;

  // For chat_question
  question?: string;
  chatHistory?: Array<{ role: string; content: string }>;

  // Common
  timestamp?: string;
  [key: string]: unknown; // Allow additional properties
}

export interface AnalysisIteration {
  id: string;
  session_id: string;
  iteration_type: IterationType;
  input_data: AnalysisIterationInputData;
  result_data: AnalysisResult | { response: string } | null; // Chat has different structure
  analysis_id: string | null;
  parent_iteration_id: string | null;
  created_at: string;
}

// ============================================================================
// Regulatory Documents Types
// ============================================================================

export interface RegulatoryDocument {
  id: string;
  title: string;
  description: string | null;
  content: string;
  document_type: DocumentType;
  jurisdiction: string | null;
  source: string | null;
  source_url: string | null;
  effective_date: string | null;
  version: string | null;
  category_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DocumentCategory {
  id: string;
  name: string;
  description: string | null;
  parent_category_id: string | null;
  product_categories: ProductCategory[] | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// GRAS/NDI Ingredient Types
// ============================================================================

export interface GRASIngredient {
  id: string;
  ingredient_name: string;
  cas_number: string | null;
  gras_notice_number: string | null;
  gras_status: GRASStatus;
  source_reference: string | null;
  category: string | null;
  approved_uses: string[] | null;
  limitations: string | null;
  synonyms: string[] | null;
  common_name: string | null;
  technical_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface NDIIngredient {
  id: string;
  notification_number: number;
  report_number: string | null;
  ingredient_name: string;
  firm: string | null;
  submission_date: string | null;
  fda_response_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OldDietaryIngredient {
  id: string;
  ingredient_name: string;
  source_organization: 'AHPA' | 'CRN' | 'NPA' | 'UNPA';
  ingredient_type: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Allergen Types
// ============================================================================

export interface AllergenIngredient {
  id: string;
  allergen_name: string; // e.g., 'Milk', 'Eggs', 'Fish'
  ingredient_name: string; // e.g., 'whey', 'albumin', 'anchovy'
  is_primary_name: boolean; // True for main allergen names
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Organization & Team Types
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: PlanTier;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PendingInvitation {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  invitation_token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

// ============================================================================
// User Settings Types
// ============================================================================

export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  email_on_analysis_complete: boolean;
  theme: 'light' | 'dark' | 'system';
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Export History Types
// ============================================================================

export type ExportFormat = 'pdf' | 'csv' | 'json';

export interface AnalysisExport {
  id: string;
  user_id: string;
  analysis_id: string;
  export_format: ExportFormat;
  file_size: number | null;
  created_at: string;
}
