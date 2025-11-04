/**
 * Backward Compatibility Helpers for Analysis Data
 *
 * These helpers safely access analysis result properties that may exist in
 * different formats between old and new data structures.
 *
 * This eliminates the need for `as any` type assertions throughout the codebase.
 */

import type {
  AnalysisResult,
  ClaimsAnalysis,
  ComplianceStatus,
  StructureFunctionClaims,
  NutrientContentClaims,
  HealthClaims,
} from '@/types/analysis';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if structure is the new object format with claims_found property
 */
function isClaimsObject<T>(
  value: unknown
): value is { claims_found: T[]; status?: ComplianceStatus } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'claims_found' in value &&
    Array.isArray((value as { claims_found: unknown }).claims_found)
  );
}

/**
 * Check if claims analysis has a top-level status (old format)
 */
function hasTopLevelStatus(
  claims: ClaimsAnalysis | (ClaimsAnalysis & { status?: ComplianceStatus })
): claims is ClaimsAnalysis & { status: ComplianceStatus } {
  return 'status' in claims && typeof claims.status === 'string';
}

// ============================================================================
// Claims Status Helpers
// ============================================================================

/**
 * Get the overall claims compliance status
 *
 * @param claims - Claims analysis object
 * @returns The most severe non-compliant status, or 'compliant' if all compliant
 */
export function getClaimsStatus(
  claims: ClaimsAnalysis | (ClaimsAnalysis & { status?: ComplianceStatus })
): ComplianceStatus {
  // Check for old format with top-level status
  if (hasTopLevelStatus(claims)) {
    return claims.status;
  }

  // New format: check prohibited claims first (highest priority)
  if (claims.prohibited_claims?.status === 'non_compliant') {
    return 'non_compliant';
  }

  // Check all claim types for non-compliance
  const statuses = [
    claims.structure_function_claims?.status,
    claims.nutrient_content_claims?.status,
    claims.health_claims?.status,
    claims.prohibited_claims?.status,
  ].filter((s): s is ComplianceStatus => s !== undefined);

  // Return most severe status
  if (statuses.includes('non_compliant')) return 'non_compliant';
  if (statuses.includes('potentially_non_compliant')) return 'potentially_non_compliant';
  if (statuses.includes('not_applicable')) return 'not_applicable';

  return 'compliant';
}

// ============================================================================
// Claims Array Helpers
// ============================================================================

/**
 * Safely extract claims array from structure/function claims
 * Handles both old format (array of strings) and new format (object with claims_found)
 */
export function getStructureFunctionClaimsArray(
  claims: StructureFunctionClaims | string[] | undefined
): Array<{ claim_text: string } | string> {
  if (!claims) return [];
  if (Array.isArray(claims)) return claims; // Old format
  if (isClaimsObject<{ claim_text: string }>(claims)) {
    return claims.claims_found;
  }
  return [];
}

/**
 * Safely extract claims array from nutrient content claims
 * Handles both old format (array) and new format (object with claims_found)
 */
export function getNutrientContentClaimsArray(
  claims: NutrientContentClaims | Array<{ claim_text: string }> | undefined
): Array<{ claim_text: string }> {
  if (!claims) return [];
  if (Array.isArray(claims)) return claims; // Old format
  if (isClaimsObject<{ claim_text: string }>(claims)) {
    return claims.claims_found;
  }
  return [];
}

/**
 * Safely extract claims array from health claims
 * Handles both old format (array) and new format (object with claims_found)
 */
export function getHealthClaimsArray(
  claims: HealthClaims | Array<{ claim_text: string }> | undefined
): Array<{ claim_text: string }> {
  if (!claims) return [];
  if (Array.isArray(claims)) return claims; // Old format
  if (isClaimsObject<{ claim_text: string }>(claims)) {
    return claims.claims_found;
  }
  return [];
}

/**
 * Safely extract claims array from prohibited claims
 * Handles both old format (array of strings) and new format (object with claims_found)
 *
 * @justification Using `any` for flexible backward compatibility with varied claim formats
 */
export function getProhibitedClaimsArray(
  claims: unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Array<any> {
  if (!claims) return [];
  if (Array.isArray(claims)) return claims; // Old format
  if (isClaimsObject(claims)) return claims.claims_found;
  return [];
}

/**
 * Check if any claims are present
 */
export function hasAnyClaims(
  claims: StructureFunctionClaims | NutrientContentClaims | HealthClaims | unknown[] | undefined
): boolean {
  if (!claims) return false;
  if (Array.isArray(claims)) return claims.length > 0; // Old format
  if (isClaimsObject(claims)) return claims.claims_found.length > 0;
  return false;
}

// ============================================================================
// Legacy Data Helpers
// ============================================================================

/**
 * Safely get summary from either new or old format
 */
export function getSummary(result: AnalysisResult | { summary?: string }): string {
  if ('overall_assessment' in result && result.overall_assessment?.summary) {
    return result.overall_assessment.summary;
  }
  // Fallback to old format
  if ('summary' in result && typeof result.summary === 'string') {
    return result.summary;
  }
  return '';
}

/**
 * Safely get ingredients list from either new or old format
 */
export function getIngredients(
  result: AnalysisResult | { ingredients?: string[] }
): string[] | undefined {
  if ('ingredient_labeling' in result && result.ingredient_labeling?.ingredients_list) {
    return result.ingredient_labeling.ingredients_list;
  }
  // Fallback to old format
  if ('ingredients' in result && Array.isArray(result.ingredients)) {
    return result.ingredients;
  }
  return undefined;
}

/**
 * Safely check if nutrition facts are present in either format
 */
export function hasNutritionFacts(result: AnalysisResult | { nutrition_facts?: unknown }): boolean {
  if ('nutrition_labeling' in result && result.nutrition_labeling) {
    return true;
  }
  // Fallback to old format
  if (
    'nutrition_facts' in result &&
    result.nutrition_facts &&
    typeof result.nutrition_facts === 'object'
  ) {
    return Object.keys(result.nutrition_facts).length > 0;
  }
  return false;
}

/**
 * Safely get nutrition facts object from old format
 * Returns null if not in old format or not present
 */
export function getNutritionFactsLegacy(
  result: AnalysisResult | { nutrition_facts?: Record<string, unknown> }
): Record<string, unknown> | null {
  // Only return if it's the old format
  if (
    'nutrition_facts' in result &&
    result.nutrition_facts &&
    typeof result.nutrition_facts === 'object' &&
    !('nutrition_labeling' in result)
  ) {
    return result.nutrition_facts as Record<string, unknown>;
  }
  return null;
}
