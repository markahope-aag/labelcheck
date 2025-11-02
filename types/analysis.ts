/**
 * Type Definitions for Analysis Results
 *
 * These types define the structure of AI-generated compliance analysis results.
 * Based on the JSON structure defined in lib/prompts/analysis-prompt.ts (lines 937-1133)
 *
 * IMPORTANT: These types MUST match the exact structure returned by the AI.
 * Any changes to the AI prompt JSON structure should be reflected here.
 */

import type { ProductCategory } from './database';

// ============================================================================
// Enum Types
// ============================================================================

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type ComplianceStatus =
  | 'compliant'
  | 'non_compliant'
  | 'not_applicable'
  | 'potentially_non_compliant';

export type OverallComplianceStatus =
  | 'compliant'
  | 'likely_compliant'
  | 'potentially_non_compliant'
  | 'non_compliant';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ComplianceTableStatus =
  | 'Compliant'
  | 'Potentially Non-compliant'
  | 'Non-compliant'
  | 'Not Applicable';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'none';

// ============================================================================
// Shared Section Type
// ============================================================================

export interface LabelingSection {
  status: ComplianceStatus;
  details: string;
  regulation_citation: string;
}

// ============================================================================
// General Labeling Types
// ============================================================================

export interface StatementOfIdentity extends LabelingSection {}

export interface NetQuantity extends LabelingSection {
  value_found?: string; // e.g., "2 oz (56g)"
}

export interface ManufacturerAddress extends LabelingSection {
  address_found?: string; // Complete address as it appears on label
}

export interface GeneralLabeling {
  statement_of_identity: StatementOfIdentity;
  net_quantity: NetQuantity;
  manufacturer_address: ManufacturerAddress;
}

// ============================================================================
// Ingredient Labeling Types
// ============================================================================

export interface IngredientMatch {
  ingredient: string; // Actual ingredient name from label
  ingredient_name?: string; // Alias for ingredient
  match_type: 'exact' | 'synonym' | 'fuzzy' | 'none';
  matched_name?: string;
  gras_notice_number?: string;
  is_gras: boolean;
}

export interface GRASCompliance {
  total_ingredients: number;
  gras_compliant_count: number;
  non_gras_ingredients: string[];
  gras_ingredients: IngredientMatch[];
  overall_compliant: boolean;
  critical_issues: string[];
}

export interface IngredientLabeling extends LabelingSection {
  ingredients_list?: string[];
  gras_compliance?: GRASCompliance;
}

// ============================================================================
// Allergen Labeling Types
// ============================================================================

export interface AllergenDatabase {
  allergens_detected: string[];
  ingredients_with_allergens: Array<{
    ingredient: string;
    allergens: string[];
    match_type: 'exact' | 'derivative' | 'fuzzy';
  }>;
  has_contains_statement: boolean;
  is_compliant: boolean;
  missing_allergen_declarations?: string[];
}

export interface AllergenLabeling extends LabelingSection {
  potential_allergens?: string[]; // List of ingredients that may contain MFAs
  allergens_declared?: string[]; // Allergens explicitly declared on label
  has_contains_statement?: boolean;
  risk_level?: RiskLevel;
  allergen_database_check?: AllergenDatabase;
}

// ============================================================================
// Nutrition/Supplement Facts Types
// ============================================================================

export interface RoundingError {
  nutrient: string;
  declared_value: string;
  required_value: string;
  rule_violated: string;
}

export interface RoundingValidation {
  has_errors: boolean;
  errors_found: RoundingError[];
}

export interface PanelCompliance {
  serving_size_clear?: boolean;
  amount_per_serving_listed?: boolean;
  daily_values_shown?: boolean;
  format_compliant?: boolean;
  issues?: string[];
}

export interface NutritionLabeling extends LabelingSection {
  panel_present?: boolean;
  panel_type_correct?: boolean;
  wrong_panel_issue?: string;
  inappropriate_fortification_issue?: string;
  exemption_applicable?: boolean;
  exemption_reason?: string;
  rounding_validation?: RoundingValidation;
}

export interface SupplementFactsPanel extends LabelingSection {
  panel_present?: boolean;
  panel_type_correct?: boolean;
  wrong_panel_issue?: string;
  wrong_panel_type?: string; // Alias for wrong_panel_issue
  panel_compliance?: PanelCompliance;
}

// ============================================================================
// Claims Types
// ============================================================================

export interface StructureFunctionClaim {
  claim_text: string;
  compliance_issue?: string;
  disclaimer_required?: boolean;
  disclaimer_present?: boolean;
  regulation_citation: string;
}

export interface StructureFunctionClaims {
  claims_present: boolean;
  claims_found: StructureFunctionClaim[];
  status: ComplianceStatus;
  regulation_citation: string;
}

export interface NutrientContentClaim {
  claim_type: string; // e.g., 'high', 'good source', 'fortified'
  claim_text: string;
  nutrient: string;
  nutrient_level: string; // % DV or amount per serving
  required_level: string; // Regulatory threshold
  meets_definition: boolean;
  issue?: string;
  regulation_citation: string;
}

export interface NutrientContentClaims {
  claims_present: boolean;
  claims_found: NutrientContentClaim[];
  status: ComplianceStatus;
  regulation_citation: string;
}

export interface HealthClaim {
  claim_text: string;
  claim_type: string; // e.g., 'authorized health claim', 'qualified health claim'
  authorized: boolean;
  issue?: string;
  regulation_citation: string;
}

export interface HealthClaims {
  claims_present: boolean;
  claims_found: HealthClaim[];
  status: ComplianceStatus;
  regulation_citation: string;
}

export interface ProhibitedClaim {
  claim_text: string;
  violation_type: string; // e.g., 'disease treatment claim', 'drug claim'
  issue: string;
  regulation_citation: string;
}

export interface ProhibitedClaims {
  claims_present: boolean;
  claims_found: ProhibitedClaim[];
  status: ComplianceStatus;
  regulation_citation: string;
}

export interface ClaimsAnalysis {
  structure_function_claims: StructureFunctionClaims;
  nutrient_content_claims: NutrientContentClaims;
  health_claims: HealthClaims;
  prohibited_claims: ProhibitedClaims;
  details: string;
  regulation_citation: string;
}

// ============================================================================
// Disclaimer Types
// ============================================================================

export interface DisclaimerRequirements extends LabelingSection {
  disclaimer_required: boolean;
  disclaimer_present: boolean;
  disclaimer_text_found: string | null;
  disclaimer_wording_correct: boolean;
  disclaimer_prominent: boolean;
  recommendations?: string[];
}

// ============================================================================
// Additional Requirements Types
// ============================================================================

export interface FortificationPolicyViolation {
  present: boolean;
  severity: RiskLevel;
  issue: string;
  reasoning: string;
}

export interface Fortification extends LabelingSection {
  is_fortified: boolean;
  nutrients_added?: string[];
  fortification_claims?: string[];
  vehicle_appropriate?: boolean | null;
  product_type?: string;
  policy_violation?: FortificationPolicyViolation;
}

export interface OtherRequirement {
  requirement: string; // e.g., 'Caffeine Disclosure', 'cGMP for supplements'
  status: ComplianceStatus;
  details: string;
  regulation_citation: string;
}

export interface AdditionalRequirements {
  fortification?: Fortification;
  other_requirements?: OtherRequirement[];
}

// ============================================================================
// Overall Assessment Types
// ============================================================================

export interface OverallAssessment {
  primary_compliance_status: OverallComplianceStatus;
  confidence_level: ConfidenceLevel;
  summary: string;
  key_findings: string[];
  category_violation_present?: boolean;
  category_violation_explanation?: string;
}

// ============================================================================
// Compliance Table Types
// ============================================================================

export interface ComplianceTableRow {
  element: string;
  status: ComplianceTableStatus;
  rationale: string;
}

// ============================================================================
// Recommendations Types
// ============================================================================

export interface Recommendation {
  priority: RecommendationPriority;
  recommendation: string;
  regulation: string;
  ingredient?: string; // For ingredient-specific recommendations
}

// ============================================================================
// Category Ambiguity Types
// ============================================================================

export interface CategoryOption {
  category_name: ProductCategory;
  current_violations: string[];
  required_changes: string[];
  allowed_claims: string[];
  prohibited_claims: string[];
  regulatory_requirements: string[];
  pros: string[];
  cons: string[];
}

export interface CategoryRecommendation {
  suggested_category: ProductCategory;
  confidence: ConfidenceLevel;
  reasoning: string;
  key_decision_factors: string[];
}

export interface CategoryAmbiguity {
  is_ambiguous: boolean;
  ambiguity_reason: string;
  alternative_categories?: ProductCategory[]; // Alternative categories to consider
  label_conflicts?: string[];
  category_options?: Record<string, CategoryOption>;
  recommendation?: CategoryRecommendation;
}

// ============================================================================
// Main Analysis Result Type
// ============================================================================

/**
 * AnalysisResult - Complete AI analysis response structure
 *
 * This is the exact structure returned by the AI analysis endpoint.
 * Fields are based on lib/prompts/analysis-prompt.ts JSON structure.
 */
export interface AnalysisResult {
  // Product Information
  product_name: string;
  product_type?: string;

  // Category Classification
  product_category: ProductCategory;
  category_rationale: string;
  category_confidence: ConfidenceLevel;
  category_ambiguity?: CategoryAmbiguity;

  // Labeling Sections
  general_labeling: GeneralLabeling;
  ingredient_labeling: IngredientLabeling;
  allergen_labeling: AllergenLabeling;

  // Nutrition/Supplement Facts (conditional based on category)
  nutrition_labeling?: NutritionLabeling; // For CONVENTIONAL_FOOD, NON_ALCOHOLIC_BEVERAGE, ALCOHOLIC_BEVERAGE
  supplement_facts_panel?: SupplementFactsPanel; // For DIETARY_SUPPLEMENT only

  // Claims and Requirements
  claims: ClaimsAnalysis;
  disclaimer_requirements?: DisclaimerRequirements;
  additional_requirements?: AdditionalRequirements;

  // Overall Assessment
  overall_assessment: OverallAssessment;
  compliance_table: ComplianceTableRow[];
  recommendations: Recommendation[];

  // Optional: Text analysis comparison (only for text checker iterations)
  comparison?: {
    resolved_issues: number;
    remaining_issues: number;
    new_issues: number;
  };

  // Optional: GRAS/NDI compliance (added by post-processing, not from AI)
  gras_compliance?: GRASCompliance;
}

// ============================================================================
// API Response Types
// ============================================================================

/**
 * AnalysisResponse - Complete API response from /api/analyze
 *
 * Extends AnalysisResult with database fields and metadata
 */
export interface AnalysisResponse extends AnalysisResult {
  // Database fields
  id: string;
  image_name: string;
  compliance_status: string;
  issues_found: number;
  created_at: string;

  // UI control fields
  show_category_selector?: boolean;

  // Usage tracking
  usage?: {
    used: number;
    limit: number;
  };

  // Session information
  session?: {
    id: string;
    title: string | null;
  } | null;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AnalysisError {
  error: string;
  details?: string;
}
