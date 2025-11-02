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
  gras_compliance?: any;
  ndi_compliance?: any;
  allergen_database_check?: any;
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
      analysisData.gras_compliance = {
        status: grasCompliance.overallCompliant ? 'compliant' : 'non_compliant',
        total_ingredients: grasCompliance.totalIngredients,
        gras_compliant_count: grasCompliance.grasCompliant,
        non_gras_ingredients: grasCompliance.nonGRASIngredients,
        gras_ingredients: grasCompliance.grasIngredients,
        detailed_results: grasCompliance.detailedResults,
      };

      // If non-GRAS ingredients found, add critical recommendations
      if (!grasCompliance.overallCompliant && grasCompliance.nonGRASIngredients.length > 0) {
        logger.warn('Non-GRAS ingredients detected', {
          nonGRASIngredients: grasCompliance.nonGRASIngredients,
          productCategory: analysisData.product_category,
        });

        // Initialize recommendations array if it doesn't exist
        if (!analysisData.recommendations) {
          analysisData.recommendations = [];
        }

        // Determine severity based on number of non-GRAS ingredients
        const nonGRASCount = grasCompliance.nonGRASIngredients.length;
        const isSingleIngredient = nonGRASCount === 1;
        const priority = isSingleIngredient ? 'high' : 'critical';
        const complianceStatus = isSingleIngredient ? 'potentially_non_compliant' : 'non_compliant';
        const statusLabel = isSingleIngredient ? 'Potentially Non-Compliant' : 'Non-Compliant';

        // Add recommendations for each non-GRAS ingredient
        grasCompliance.nonGRASIngredients.forEach((ingredient: string) => {
          analysisData.recommendations!.unshift({
            priority,
            recommendation: `${priority === 'critical' ? 'CRITICAL' : 'IMPORTANT'}: Ingredient "${ingredient}" is NOT found in the FDA GRAS (Generally Recognized as Safe) database. If this ingredient is being used, it must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or it may require FDA pre-market approval through a food additive petition. Provide documentation of GRAS self-determination or obtain proper FDA approval before marketing this product.`,
            regulation: '21 CFR 170.30(b) (GRAS self-determination)',
          });
        });

        // Update overall compliance status to reflect GRAS violations
        if (analysisData.overall_assessment) {
          analysisData.overall_assessment.primary_compliance_status = complianceStatus;

          // Update summary to reflect GRAS non-compliance
          if (isSingleIngredient) {
            analysisData.overall_assessment.summary = `The ${analysisData.product_name || 'product'} label is POTENTIALLY NON-COMPLIANT with FDA regulations due to the use of an ingredient not found in the FDA GRAS (Generally Recognized as Safe) database. This ingredient may be subject to industry self-affirmation of GRAS status. If this ingredient is being used, it must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or may require FDA pre-market approval through a food additive petition.`;
          } else {
            analysisData.overall_assessment.summary = `The ${analysisData.product_name || 'product'} label is NON-COMPLIANT with FDA regulations due to the use of multiple ingredients not found in the FDA GRAS (Generally Recognized as Safe) database. If these ingredients are being used, they must be the subject of a GRAS determination in accordance with 21 CFR 170.30(b), or may require FDA pre-market approval through a food additive petition.`;
          }

          // Add GRAS violation to key findings
          if (!analysisData.overall_assessment.key_findings) {
            analysisData.overall_assessment.key_findings = [];
          }
          analysisData.overall_assessment.key_findings.unshift(
            `${priority === 'critical' ? 'CRITICAL' : 'IMPORTANT'}: ${nonGRASCount} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}`
          );
        }

        // Add to compliance table
        if (!analysisData.compliance_table) {
          analysisData.compliance_table = [];
        }
        analysisData.compliance_table.unshift({
          element: 'GRAS Ingredient Compliance',
          status: statusLabel,
          rationale: `${nonGRASCount} ingredient(s) not in FDA GRAS database: ${grasCompliance.nonGRASIngredients.join(', ')}. ${isSingleIngredient ? 'May be subject to industry self-affirmation.' : 'Requires FDA approval or GRAS determination.'}`,
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
      analysisData.ndi_compliance = ndiCompliance;

      // Add recommendations for ingredients requiring NDI verification
      if (ndiCompliance.summary.requiresNotification > 0 && ndiCompliance.results) {
        if (!analysisData.recommendations) {
          analysisData.recommendations = [];
        }

        ndiCompliance.results
          .filter((result: any) => result.requiresNDI)
          .forEach((result: any) => {
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
      analysisData.allergen_database_check = {
        allergens_detected: allergenResults.allergensDetected,
        ingredients_with_allergens: allergenResults.ingredientsWithAllergens,
        summary: allergenResults.summary,
      };

      // Check AI analysis for allergen compliance
      const aiAllergenSection = (analysisData as any).allergen_labeling;
      const aiAllergenStatus = aiAllergenSection?.status;

      // Cross-reference database findings with AI analysis
      if (
        aiAllergenStatus === 'potentially_non_compliant' ||
        aiAllergenStatus === 'non_compliant'
      ) {
        // AI detected missing allergen declarations - validate with database
        const detectedAllergenNames = allergenResults.allergensDetected.map(
          (a: any) => a.allergen_name
        );

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
 */
export async function postProcessAnalysis(analysisData: AnalysisData): Promise<AnalysisData> {
  // Run compliance checks in sequence (they modify analysisData)
  await processGRASCompliance(analysisData);
  await processNDICompliance(analysisData);
  await processAllergenCompliance(analysisData);

  // Add monitoring recommendation
  addMonitoringRecommendation(analysisData);

  // Enforce status consistency (must be last)
  enforceStatusConsistency(analysisData);

  return analysisData;
}
