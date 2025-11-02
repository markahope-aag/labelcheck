/**
 * Type Definitions for AI Analysis Results
 *
 * These types define the structure of analysis results returned by the AI
 * for food/supplement label compliance checking.
 *
 * Generated from: lib/prompts/analysis-prompt.ts JSON response structure
 */

import type { ProductCategory } from './database';

// ============================================================================
// Priority and Status Types
// ============================================================================

export type RecommendationPriority = 'critical' | 'high' | 'medium' | 'low';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'not_applicable';

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

// ============================================================================
// Labeling Section Types
// ============================================================================

export interface LabelingSection {
  status: ComplianceStatus;
  details: string;
  regulation_citation?: string;
}

export interface StatementOfIdentity extends LabelingSection {
  product_name?: string;
  missing_details?: string[];
}

export interface NetQuantity extends LabelingSection {
  declared_quantity?: string;
  us_customary?: string;
  metric?: string;
  issues?: string[];
}

export interface ManufacturerInfo extends LabelingSection {
  name?: string;
  address?: string;
  missing_components?: string[];
}

export interface GeneralLabeling {
  statement_of_identity: StatementOfIdentity;
  net_quantity: NetQuantity;
  manufacturer_info: ManufacturerInfo;
}

// ============================================================================
// Ingredient Labeling Types
// ============================================================================

export interface IngredientMatch {
  ingredient: string;
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

export interface IngredientLabeling extends LabelingSection {
  ingredients_list?: string[];
  order_correct?: boolean;
  issues?: string[];
  gras_compliance?: GRASCompliance;
}

// ============================================================================
// Allergen Labeling Types
// ============================================================================

export interface AllergenLabeling extends LabelingSection {
  allergens_declared?: string[];
  declaration_method?: 'parenthetical' | 'contains_statement' | 'both' | 'none';
  issues?: string[];
  allergen_database_check?: AllergenDatabase;
  risk_rating?: 'critical' | 'high' | 'medium' | 'low' | 'none';
}

// ============================================================================
// Nutrition/Supplement Facts Types
// ============================================================================

export interface NutritionLabeling extends LabelingSection {
  panel_type?: 'nutrition_facts' | 'supplement_facts' | 'none';
  required_nutrients?: string[];
  missing_nutrients?: string[];
  formatting_issues?: string[];
}

// ============================================================================
// Claims Types
// ============================================================================

export interface ClaimsAnalysis extends LabelingSection {
  structure_function_claims?: string[];
  nutrient_content_claims?: string[];
  health_claims?: string[];
  prohibited_claims?: string[];
  issues?: string[];
}

// ============================================================================
// Additional Requirements Types
// ============================================================================

export interface AdditionalRequirement {
  requirement: string;
  status: ComplianceStatus;
  details: string;
  regulation_citation?: string;
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

export interface CategoryAmbiguity {
  is_ambiguous: boolean;
  ambiguity_reason?: string;
  alternative_categories?: ProductCategory[];
  confidence_notes?: string;
}

// ============================================================================
// Main Analysis Result Type
// ============================================================================

export interface AnalysisResult {
  // Product Information
  product_name: string;
  product_type?: string;

  // Category Classification
  product_category?: ProductCategory;
  category_rationale?: string;
  category_confidence?: 'high' | 'medium' | 'low';
  category_ambiguity?: CategoryAmbiguity;

  // Labeling Sections
  general_labeling: GeneralLabeling;
  ingredient_labeling: IngredientLabeling;
  allergen_labeling: AllergenLabeling;
  nutrition_labeling: NutritionLabeling;
  claims?: ClaimsAnalysis;
  additional_requirements?: AdditionalRequirement[];

  // Overall Assessment
  overall_assessment: OverallAssessment;
  compliance_table: ComplianceTableRow[];
  recommendations: Recommendation[];

  // Optional: For text analysis comparisons
  comparison?: {
    issues_resolved?: string[];
    issues_remaining?: string[];
    new_issues?: string[];
    improvement_summary?: string;
  };

  // Optional: GRAS/NDI compliance (added post-analysis)
  gras_compliance?: GRASCompliance;
  ndi_compliance?: unknown; // TODO: Define NDI compliance type
}

// ============================================================================
// Analysis API Response Types
// ============================================================================

export interface AnalysisResponse extends AnalysisResult {
  id?: string; // Analysis ID from database
  iterationId?: string | null; // Session iteration ID
  analysisType?: 'image_analysis' | 'text_check' | 'revised_analysis';
  timestamp?: string;
}

// ============================================================================
// Error Response Type
// ============================================================================

export interface AnalysisError {
  error: string;
  details?: string;
  code?: string;
}
