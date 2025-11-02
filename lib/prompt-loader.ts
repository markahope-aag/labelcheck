import { readFileSync } from 'fs';
import { join } from 'path';
import { ProductCategory } from './supabase';

/**
 * Prompt Loader Utility
 *
 * Loads prompt templates from external markdown files instead of having them
 * embedded in code. This makes prompts easier to edit and version control.
 *
 * Benefits:
 * - Non-developers can edit prompts (no TypeScript syntax)
 * - Cleaner git diffs
 * - Easier A/B testing of prompts
 * - Better separation of concerns
 */

import { logger } from './logger';

// Cache loaded prompts to avoid repeated file reads
const promptCache: Map<string, string> = new Map();

/**
 * Read a prompt file from disk with caching
 */
function readPromptFile(filename: string): string {
  // Check cache first
  if (promptCache.has(filename)) {
    return promptCache.get(filename)!;
  }

  // Read from disk
  const filePath = join(process.cwd(), 'prompts', filename);
  const content = readFileSync(filePath, 'utf-8');

  // Cache for future use
  promptCache.set(filename, content);

  return content;
}

/**
 * Get category-specific regulatory requirements
 */
function getCategoryPrompt(category: ProductCategory): string {
  const categoryFiles: Record<ProductCategory, string> = {
    DIETARY_SUPPLEMENT: 'categories/dietary-supplement.md',
    CONVENTIONAL_FOOD: 'categories/conventional-food.md',
    ALCOHOLIC_BEVERAGE: 'categories/alcoholic-beverage.md',
    NON_ALCOHOLIC_BEVERAGE: 'categories/non-alcoholic-beverage.md',
  };

  return readPromptFile(categoryFiles[category]);
}

/**
 * Get common analysis sections (apply to all categories)
 */
function getCommonSections(): string {
  return readPromptFile('common-sections.md');
}

/**
 * Get JSON schema for analysis response
 */
function getJSONSchema(): string {
  return readPromptFile('json-schema.md');
}

/**
 * Get human-readable category description
 */
function getCategoryDescription(category: ProductCategory): string {
  const descriptions: Record<ProductCategory, string> = {
    DIETARY_SUPPLEMENT: 'dietary supplement',
    CONVENTIONAL_FOOD: 'conventional food',
    ALCOHOLIC_BEVERAGE: 'alcoholic beverage',
    NON_ALCOHOLIC_BEVERAGE: 'non-alcoholic beverage',
  };
  return descriptions[category];
}

/**
 * Build complete category-specific analysis prompt
 * Composes: intro + category rules + common sections + JSON schema
 */
export function buildCategoryPrompt(category: ProductCategory, isPdf: boolean): string {
  const categoryDesc = getCategoryDescription(category);
  const fdaOrTtb = category === 'ALCOHOLIC_BEVERAGE' ? '/TTB' : '';

  const intro = `You are a labeling regulatory compliance expert. Analyze this ${category} label ${isPdf ? 'PDF document' : 'image'} and provide a comprehensive evaluation of its compliance with FDA${fdaOrTtb} labeling requirements.

**IMPORTANT:** You already know this is a **${category}**. Focus your analysis on ${categoryDesc}-specific requirements.

---
`;

  const categoryRules = getCategoryPrompt(category);
  const commonSections = getCommonSections();
  const jsonSchema = getJSONSchema();

  return `${intro}
${categoryRules}

---

${commonSections}

---

${jsonSchema}`;
}

/**
 * Clear the prompt cache (useful for development/testing)
 */
export function clearPromptCache(): void {
  promptCache.clear();
  logger.info('Prompt cache cleared');
}

/**
 * Get cache statistics for monitoring
 */
export function getPromptCacheStats(): {
  cachedFiles: number;
  files: string[];
} {
  return {
    cachedFiles: promptCache.size,
    files: Array.from(promptCache.keys()),
  };
}
