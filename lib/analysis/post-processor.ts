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
    console.log(
      'Checking GRAS compliance for',
      analysisData.product_category,
      'ingredients:',
      analysisData.ingredient_labeling.ingredients_list
    );

    try {
      const grasCompliance = await checkGRASCompliance(
        analysisData.ingredient_labeling.ingredients_list
      );

      console.log('GRAS compliance check complete:', {
        total: grasCompliance.totalIngredients,
        compliant: grasCompliance.grasCompliant,
        nonGRAS: grasCompliance.nonGRASIngredients,
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
        console.log('CRITICAL: Non-GRAS ingredients detected:', grasCompliance.nonGRASIngredients);

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
        console.log('All ingredients are GRAS-compliant');

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
      console.error('Error checking GRAS compliance:', grasError);
      // Don't fail the analysis if GRAS check fails, just log the error
    }
  } else if (analysisData.product_category === 'DIETARY_SUPPLEMENT') {
    console.log(
      'Product is a dietary supplement - GRAS compliance not applicable (regulated under DSHEA, not 21 CFR 170.3)'
    );
  } else {
    console.log('No ingredients found in analysis - skipping GRAS check');
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
    console.log(
      'Checking NDI compliance for dietary supplement ingredients:',
      analysisData.ingredient_labeling.ingredients_list
    );

    try {
      const ndiCompliance = await checkNDICompliance(
        analysisData.ingredient_labeling.ingredients_list
      );

      console.log('NDI compliance check complete:', {
        total: ndiCompliance.summary.totalChecked,
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
      console.error('Error checking NDI compliance:', ndiError);
      // Don't fail the analysis if NDI check fails
    }
  } else if (
    analysisData.product_category === 'CONVENTIONAL_FOOD' ||
    analysisData.product_category === 'NON_ALCOHOLIC_BEVERAGE' ||
    analysisData.product_category === 'ALCOHOLIC_BEVERAGE'
  ) {
    console.log(
      'Product is a food/beverage - NDI compliance not applicable (only for dietary supplements)'
    );
  } else {
    console.log('No ingredients found in analysis - skipping NDI check');
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
    console.log(
      'Checking ingredients for allergens:',
      analysisData.ingredient_labeling.ingredients_list
    );

    try {
      const allergenResults = await checkIngredientsForAllergens(
        analysisData.ingredient_labeling.ingredients_list
      );

      console.log('Allergen database check complete:', {
        allergensDetected: allergenResults.allergensDetected.length,
        ingredientsWithAllergens: allergenResults.ingredientsWithAllergens.length,
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
      console.error('Error checking allergen compliance:', allergenError);
      // Don't fail the analysis if allergen check fails
    }
  } else {
    console.log('No ingredients found in analysis - skipping allergen database check');
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
      console.log(
        `Enforced non_compliant status due to ${criticalCount} critical and ${highCount} high priority issues`
      );
    } else if (mediumCount > 0) {
      // Only medium issues → Potentially non-compliant (requires verification)
      if (
        analysisData.overall_assessment.primary_compliance_status === 'compliant' ||
        analysisData.overall_assessment.primary_compliance_status === 'likely_compliant'
      ) {
        analysisData.overall_assessment.primary_compliance_status = 'potentially_non_compliant';
        console.log(
          `Enforced potentially_non_compliant status due to ${mediumCount} medium priority issues`
        );
      }
    } else if (lowCount > 0 && criticalCount + highCount + mediumCount === 0) {
      // Only low priority suggestions → Likely compliant
      if (
        analysisData.overall_assessment.primary_compliance_status === 'non_compliant' ||
        analysisData.overall_assessment.primary_compliance_status === 'potentially_non_compliant'
      ) {
        analysisData.overall_assessment.primary_compliance_status = 'likely_compliant';
        console.log(`Enforced likely_compliant status - only ${lowCount} low priority suggestions`);
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
