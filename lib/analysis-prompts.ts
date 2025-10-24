import { ProductCategory } from './supabase';
import { buildCategoryPrompt } from './prompt-loader';

/**
 * Category-Specific Analysis Prompts
 *
 * This module provides focused, category-specific prompts for regulatory analysis.
 * Prompts are loaded from external markdown files for easier editing.
 *
 * Performance benefit: 5-10 second savings per analysis (smaller prompts)
 * Accuracy benefit: AI focuses on relevant rules without distraction
 * Maintainability: Non-developers can edit prompts without touching code
 *
 * Prompt files are located in: prompts/categories/
 * - dietary-supplement.md
 * - conventional-food.md
 * - alcoholic-beverage.md
 * - non-alcoholic-beverage.md
 * - common-sections.md (applies to all)
 * - json-schema.md (response format)
 */

/**
 * Build category-specific analysis prompt based on detected category
 * Loads prompts from external markdown files in prompts/ directory
 */
export function getCategorySpecificAnalysisPrompt(
  category: ProductCategory,
  isPdf: boolean
): string {
  return buildCategoryPrompt(category, isPdf);
}
