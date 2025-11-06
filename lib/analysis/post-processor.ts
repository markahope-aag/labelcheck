/**
 * Analysis Post-Processor
 *
 * Handles post-processing of AI analysis results including:
 * - GRAS compliance checking (for foods/beverages)
 * - NDI compliance checking (for dietary supplements)
 * - Allergen compliance checking (all products)
 * - Status enforcement based on recommendation priorities
 */

import { checkGRASCompliance } from '@/lib/gras-helpers';
import { checkNDICompliance } from '@/lib/ndi-helpers';
import { checkIngredientsForAllergens } from '@/lib/allergen-helpers';
import { logger } from '@/lib/logger';
import type { GRASCompliance, AllergenDatabase, CategoryAmbiguity } from '@/types';

export interface AnalysisData {
  product_name?: string;
  product_category?: string;
  ingredient_labeling?: {
    ingredients_list?: string[];
  };
  recommendations?: Array<{
    priority: string;
    recommendation: string;
    regulation: string;
  }>;
  overall_assessment?: {
    primary_compliance_status?: string;
    summary?: string;
    key_findings?: string[];
  };
  compliance_table?: Array<{
    element?: string;
    section?: string;
    status: string;
    rationale?: string;
    details?: string;
    regulation?: string;
  }>;
  gras_compliance?: GRASCompliance;
  ndi_compliance?: {
    summary: {
      totalIngredients: number;
      withNDI: number;
      withoutNDI: number;
      requiresNotification: number;
    };
    results?: Array<{
      ingredient: string;
      requiresNDI: boolean;
      complianceNote: string;
    }>;
  };
  allergen_database_check?: AllergenDatabase;
  allergen_labeling?: {
    status?: string;
    // Allow any additional properties from the AI response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  additional_requirements?: {
    fortification?: {
      status?: string;
      details?: string;
      regulation_citation?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
  category_ambiguity?: CategoryAmbiguity;
}

/**
 * Process GRAS compliance for food/beverage products
 */
export async function processGRASCompliance(analysisData: AnalysisData): Promise<void> {
  // Only check for CONVENTIONAL_FOOD, NON_ALCOHOLIC_BEVERAGE, and ALCOHOLIC_BEVERAGE
  if (
    (analysisData.product_category === 'CONVENTIONAL_FOOD' ||
      analysisData.product_category === 'NON_ALCOHOLIC_BEVERAGE' ||
      analysisData.product_category === 'ALCOHOLIC_BEVERAGE') &&
    analysisData.ingredient_labeling?.ingredients_list &&
    Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
    analysisData.ingredient_labeling.ingredients_list.length > 0
  ) {
    logger.debug('Checking GRAS compliance', {
      productCategory: analysisData.product_category,
      ingredientCount: analysisData.ingredient_labeling.ingredients_list.length,
    });

    try {
      const grasCompliance = await checkGRASCompliance(
        analysisData.ingredient_labeling.ingredients_list
      );

      logger.info('GRAS compliance check completed', {
        totalIngredients: grasCompliance.totalIngredients,
        compliantCount: grasCompliance.grasCompliant,
        nonGRASCount: grasCompliance.nonGRASIngredients.length,
        nonGRASIngredients: grasCompliance.nonGRASIngredients,
      });

      // Add GRAS compliance info to analysis data
      // Transform GRASComplianceReport to GRASCompliance type
      analysisData.gras_compliance = {
        total_ingredients: grasCompliance.totalIngredients,
        gras_compliant_count: grasCompliance.grasCompliant,
        non_gras_ingredients: grasCompliance.nonGRASIngredients,
        gras_ingredients: grasCompliance.detailedResults
          .filter((r) => r.isGRAS && r.matchedEntry)
          .map((r) => ({
            ingredient: r.ingredient,
            ingredient_name: r.matchedEntry?.ingredient_name,
            match_type: r.matchType || 'none',
            matched_name: r.matchedEntry?.ingredient_name,
            gras_notice_number: r.matchedEntry?.gras_notice_number || undefined,
            is_gras: r.isGRAS,
          })),
        overall_compliant: grasCompliance.overallCompliant,
        critical_issues: grasCompliance.criticalIssues,
      };

      // If non-GRAS ingredients found, flag for verification (not automatic violation)
      if (!grasCompliance.overallCompliant && grasCompliance.nonGRASIngredients.length > 0) {
        logger.info('Ingredients not in GRAS database - require verification', {
          nonGRASIngredients: grasCompliance.nonGRASIngredients,
          productCategory: analysisData.product_category,
        });

        // Initialize recommendations array if it doesn't exist
        if (!analysisData.recommendations) {
          analysisData.recommendations = [];
        }

        const nonGRASCount = grasCompliance.nonGRASIngredients.length;

        // Add verification recommendations for each ingredient not in database
        grasCompliance.nonGRASIngredients.forEach((ingredient: string) => {
          analysisData.recommendations!.push({
            priority: 'medium',
            recommendation: `Ingredient "${ingredient}" is not found in the FDA GRAS (Generally Recognized as Safe) database. This does not necessarily indicate a violation. The ingredient may be: (1) self-affirmed GRAS by the manufacturer through independent expert panel review per 21 CFR 170.30, (2) a food additive approved through separate FDA petition, or (3) exempt from GRAS requirements. Manufacturer should maintain documentation supporting the ingredient's regulatory status. Note: FDA notification of self-affirmed GRAS status is voluntary but recommended for transparency.`,
            regulation: '21 CFR 170.30 (GRAS self-determination)',
          });
        });

        // Add to compliance table as "Requires Verification" not "Non-Compliant"
        if (!analysisData.compliance_table) {
          analysisData.compliance_table = [];
        }
        analysisData.compliance_table.push({
          element: 'GRAS Ingredient Verification',
          status: 'Requires Verification',
          rationale: `${nonGRASCount} ingredient(s) not found in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}. These ingredients may be self-affirmed GRAS or approved through other regulatory pathways. Manufacturer should maintain supporting documentation.`,
        });
      } else {
        // All ingredients are GRAS-compliant
        logger.debug('All ingredients are GRAS-compliant', {
          totalIngredients: grasCompliance.totalIngredients,
        });

        if (!analysisData.compliance_table) {
          analysisData.compliance_table = [];
        }
        analysisData.compliance_table.push({
          element: 'GRAS Ingredient Compliance',
          status: 'Compliant',
          rationale: `All ${grasCompliance.totalIngredients} ingredients found in FDA GRAS database`,
        });
      }
    } catch (grasError) {
      logger.error('GRAS compliance check failed', { error: grasError });
      // Don't fail the analysis if GRAS check fails, just log the error
    }
  } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
    logger.debug(
      'Skipping GRAS check - dietary supplement (regulated under DSHEA, not 21 CFR 170.3)'
    );
  } else {
    logger.debug('Skipping GRAS check - not applicable or no ingredients', {
      productCategory: analysisData.product_category,
      hasIngredients:
        analysisData.ingredient_labeling?.ingredients_list &&
        Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
        analysisData.ingredient_labeling.ingredients_list.length > 0,
    });
  }
}

/**
 * Process NDI compliance for dietary supplement products
 */
export async function processNDICompliance(analysisData: AnalysisData): Promise<void> {
  // Only check for dietary supplements
  if (
    analysisData.product_category === 'DIETARY_SUPPLEMENT' &&
    analysisData.ingredient_labeling?.ingredients_list &&
    Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
    analysisData.ingredient_labeling.ingredients_list.length > 0
  ) {
    logger.debug('Checking NDI compliance', {
      productCategory: analysisData.product_category,
      ingredientCount: analysisData.ingredient_labeling.ingredients_list.length,
    });

    try {
      const ndiCompliance = await checkNDICompliance(
        analysisData.ingredient_labeling.ingredients_list
      );

      logger.info('NDI compliance check completed', {
        totalChecked: ndiCompliance.summary.totalChecked,
        withNDI: ndiCompliance.summary.withNDI,
        withoutNDI: ndiCompliance.summary.withoutNDI,
        requiresNotification: ndiCompliance.summary.requiresNotification,
      });

      // Add NDI compliance info to analysis data
      // Transform NDI check result to match expected structure
      analysisData.ndi_compliance = {
        summary: {
          totalIngredients: ndiCompliance.summary.totalChecked,
          withNDI: ndiCompliance.summary.withNDI,
          withoutNDI: ndiCompliance.summary.withoutNDI,
          requiresNotification: ndiCompliance.summary.requiresNotification,
        },
        results: ndiCompliance.results.map((r) => ({
          ingredient: r.ingredient,
          requiresNDI: r.requiresNDI,
          complianceNote: r.complianceNote,
        })),
      };

      // Add recommendations for ingredients requiring NDI verification
      if (ndiCompliance.summary.requiresNotification > 0 && ndiCompliance.results) {
        if (!analysisData.recommendations) {
          analysisData.recommendations = [];
        }

        ndiCompliance.results
          .filter((result) => result.requiresNDI)
          .forEach((result) => {
            analysisData.recommendations!.push({
              priority: 'medium',
              recommendation: `Verify NDI compliance for ingredient "${result.ingredient}". ${result.complianceNote}`,
              regulation: 'DSHEA Section 413 (New Dietary Ingredient Notification)',
            });
          });
      }
    } catch (ndiError) {
      logger.error('NDI compliance check failed', { error: ndiError });
      // Don't fail the analysis if NDI check fails
    }
  } else if (
    analysisData.product_category === 'CONVENTIONAL_FOOD' ||
    analysisData.product_category === 'NON_ALCOHOLIC_BEVERAGE' ||
    analysisData.product_category === 'ALCOHOLIC_BEVERAGE'
  ) {
    logger.debug('Skipping NDI check - food/beverage (NDI only applies to dietary supplements)');
  } else {
    logger.debug('Skipping NDI check - no ingredients found', {
      productCategory: analysisData.product_category,
    });
  }
}

/**
 * Process allergen compliance for all products
 */
export async function processAllergenCompliance(analysisData: AnalysisData): Promise<void> {
  if (
    analysisData.ingredient_labeling?.ingredients_list &&
    Array.isArray(analysisData.ingredient_labeling.ingredients_list) &&
    analysisData.ingredient_labeling.ingredients_list.length > 0
  ) {
    logger.debug('Checking allergen database', {
      ingredientCount: analysisData.ingredient_labeling.ingredients_list.length,
    });

    try {
      const allergenResults = await checkIngredientsForAllergens(
        analysisData.ingredient_labeling.ingredients_list
      );

      logger.info('Allergen database check completed', {
        allergensDetectedCount: allergenResults.allergensDetected.length,
        ingredientsWithAllergensCount: allergenResults.ingredientsWithAllergens.length,
      });

      // Add allergen database check results
      // Transform to AllergenDatabase type structure
      analysisData.allergen_database_check = {
        allergens_detected: allergenResults.allergensDetected.map((a) => a.allergen_name),
        ingredients_with_allergens: allergenResults.ingredientsWithAllergens.map((item) => ({
          ingredient: item.ingredient,
          allergens: item.allergens.filter((a) => a.allergen).map((a) => a.allergen!.allergen_name),
          match_type: item.allergens[0]?.matchType || 'exact',
        })),
        has_contains_statement: false, // Not tracked in current implementation
        is_compliant: allergenResults.allergensDetected.length === 0, // Simplified for now
      };

      // Check AI analysis for allergen compliance
      const aiAllergenSection = analysisData.allergen_labeling;
      const aiAllergenStatus = aiAllergenSection?.status;

      // Cross-reference database findings with AI analysis
      if (
        aiAllergenStatus === 'potentially_non_compliant' ||
        aiAllergenStatus === 'non_compliant'
      ) {
        // AI detected missing allergen declarations - validate with database
        const detectedAllergenNames = allergenResults.allergensDetected.map((a) => a.allergen_name);

        if (!analysisData.recommendations) {
          analysisData.recommendations = [];
        }

        analysisData.recommendations.push({
          priority: 'critical',
          recommendation: `CRITICAL ALLERGEN VIOLATION: Allergen database check detected the following major food allergens in ingredients: ${detectedAllergenNames.join(', ')}. Federal law (FALCPA Section 403(w) and FASTER Act) requires these allergens to be declared either parenthetically after each ingredient or in a "Contains:" statement. Missing allergen declarations can result in FDA enforcement action and mandatory recalls. Add proper allergen declarations immediately.`,
          regulation: 'FALCPA Section 403(w), FASTER Act',
        });

        // Add to compliance table
        if (!analysisData.compliance_table) {
          analysisData.compliance_table = [];
        }
        analysisData.compliance_table.push({
          section: 'Food Allergen Labeling',
          status: 'Non-Compliant',
          details: `Allergens detected (${detectedAllergenNames.join(', ')}) but declaration may be missing or incomplete per FALCPA/FASTER Act`,
          regulation: 'FALCPA Section 403(w), FASTER Act',
        });
      }
    } catch (allergenError) {
      logger.error('Allergen compliance check failed', { error: allergenError });
      // Don't fail the analysis if allergen check fails
    }
  } else {
    logger.debug('Skipping allergen database check - no ingredients found');
  }
}

/**
 * Enforce consistent compliance status based on recommendation priorities
 */
export function enforceStatusConsistency(analysisData: AnalysisData): void {
  if (
    analysisData.recommendations &&
    analysisData.recommendations.length > 0 &&
    analysisData.overall_assessment
  ) {
    const criticalCount = analysisData.recommendations.filter(
      (r) => r.priority === 'critical'
    ).length;
    const highCount = analysisData.recommendations.filter((r) => r.priority === 'high').length;
    const mediumCount = analysisData.recommendations.filter((r) => r.priority === 'medium').length;
    const lowCount = analysisData.recommendations.filter((r) => r.priority === 'low').length;

    // Override primary_compliance_status to ensure consistency
    if (criticalCount > 0 || highCount > 0) {
      // Blocking issues present → Must be non-compliant
      analysisData.overall_assessment.primary_compliance_status = 'non_compliant';
      logger.debug('Enforced non_compliant status due to critical/high priority issues', {
        criticalCount,
        highCount,
      });
    } else if (mediumCount > 0) {
      // Only medium issues → Potentially non-compliant (requires verification)
      if (
        analysisData.overall_assessment.primary_compliance_status === 'compliant' ||
        analysisData.overall_assessment.primary_compliance_status === 'likely_compliant'
      ) {
        analysisData.overall_assessment.primary_compliance_status = 'potentially_non_compliant';
        logger.debug('Enforced potentially_non_compliant status due to medium priority issues', {
          mediumCount,
        });
      }
    } else if (lowCount > 0 && criticalCount + highCount + mediumCount === 0) {
      // Only low priority suggestions → Likely compliant
      if (
        analysisData.overall_assessment.primary_compliance_status === 'non_compliant' ||
        analysisData.overall_assessment.primary_compliance_status === 'potentially_non_compliant'
      ) {
        analysisData.overall_assessment.primary_compliance_status = 'likely_compliant';
        logger.debug('Enforced likely_compliant status - only low priority suggestions', {
          lowCount,
        });
      }
    }
  }
}

/**
 * Add general compliance monitoring recommendation
 */
export function addMonitoringRecommendation(analysisData: AnalysisData): void {
  if (!analysisData.recommendations) {
    analysisData.recommendations = [];
  }

  analysisData.recommendations.push({
    priority: 'low',
    recommendation:
      'Continue monitoring for compliance with any new regulations or labeling requirements. FDA regulations and guidance documents are updated periodically, and maintaining ongoing awareness of regulatory changes is essential for continued compliance.',
    regulation: 'General FDA guidelines for product labeling',
  });
}

/**
 * Run all post-processing steps
 * Uses parallel execution for compliance checks to improve performance
 */
export async function postProcessAnalysis(analysisData: AnalysisData): Promise<AnalysisData> {
  logger.info('Starting post-processing', {
    productType: analysisData.product_category,
    ingredientCount: analysisData.ingredient_labeling?.ingredients_list?.length || 0,
  });

  const startTime = performance.now();

  // Run compliance checks in parallel for better performance
  // Using Promise.allSettled to ensure all checks complete even if one fails
  const [grasResult, ndiResult, allergenResult] = await Promise.allSettled([
    processGRASCompliance(analysisData),
    processNDICompliance(analysisData),
    processAllergenCompliance(analysisData),
  ]);

  // Log any failures (checks already modify analysisData on success)
  if (grasResult.status === 'rejected') {
    logger.error('GRAS compliance check failed', { error: grasResult.reason });
  }
  if (ndiResult.status === 'rejected') {
    logger.error('NDI compliance check failed', { error: ndiResult.reason });
  }
  if (allergenResult.status === 'rejected') {
    logger.error('Allergen compliance check failed', { error: allergenResult.reason });
  }

  const complianceTime = performance.now() - startTime;
  logger.info('Compliance checks completed', {
    durationMs: Math.round(complianceTime),
    grasStatus: grasResult.status,
    ndiStatus: ndiResult.status,
    allergenStatus: allergenResult.status,
  });

  // Add monitoring recommendation
  addMonitoringRecommendation(analysisData);

  // Enforce status consistency (must be last)
  enforceStatusConsistency(analysisData);

  const totalTime = performance.now() - startTime;
  logger.info('Post-processing completed', {
    totalDurationMs: Math.round(totalTime),
  });

  return analysisData;
}
