import { supabase } from './supabase';

export interface GRASIngredient {
  id: string;
  ingredient_name: string;
  cas_number: string | null;
  gras_notice_number: string | null;
  gras_status: 'affirmed' | 'notice' | 'scogs' | 'pending';
  source_reference: string | null;
  category: string | null;
  approved_uses: string[] | null;
  limitations: string | null;
  synonyms: string[] | null;
  common_name: string | null;
  technical_name: string | null;
  is_active: boolean;
}

export interface GRASCheckResult {
  ingredient: string;
  isGRAS: boolean;
  matchedEntry?: GRASIngredient;
  matchType?: 'exact' | 'synonym' | 'fuzzy';
}

export interface GRASComplianceReport {
  totalIngredients: number;
  grasCompliant: number;
  nonGRASIngredients: string[];
  grasIngredients: string[];
  detailedResults: GRASCheckResult[];
  overallCompliant: boolean;
  criticalIssues: string[];
}

/**
 * Normalize ingredient name for matching
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove common parenthetical notes
 * - Remove chemical prefixes (D-, L-, DL-, d-, l-, dl-)
 * - Remove percentage indicators
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '') // Remove (parenthetical notes)
    .replace(/[,;].*$/, '') // Remove anything after comma/semicolon
    .replace(/\b(d|l|dl)-/gi, '') // Remove stereoisomer prefixes (D-, L-, DL-)
    .replace(/\s+\d+%\s*$/, '') // Remove trailing percentages like "1%"
    .trim();
}

/**
 * Check if an ingredient is in the GRAS database
 * Tries multiple matching strategies:
 * 1. Exact match on ingredient_name
 * 2. Match on synonyms
 * 3. Fuzzy match using full-text search
 */
async function checkSingleIngredient(ingredientName: string): Promise<GRASCheckResult> {
  const normalized = normalizeIngredientName(ingredientName);

  // Strategy 1: Exact match (case-insensitive)
  const { data: exactMatch } = await supabase
    .from('gras_ingredients')
    .select('*')
    .eq('is_active', true)
    .ilike('ingredient_name', normalized)
    .maybeSingle();

  if (exactMatch) {
    return {
      ingredient: ingredientName,
      isGRAS: true,
      matchedEntry: exactMatch,
      matchType: 'exact',
    };
  }

  // Strategy 2: Check synonyms array
  // Fetch all active ingredients and check synonyms in JavaScript
  // (PostgreSQL TEXT[] array matching is complex with Supabase client)
  // IMPORTANT: Supabase has a hard 1000-row server limit, so we need pagination
  let allIngredients: GRASIngredient[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('gras_ingredients')
      .select('*')
      .eq('is_active', true)
      .not('synonyms', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pageData && pageData.length > 0) {
      allIngredients = [...allIngredients, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  if (allIngredients) {
    for (const ing of allIngredients) {
      if (ing.synonyms && ing.synonyms.some((syn: string) =>
        syn.toLowerCase() === normalized
      )) {
        return {
          ingredient: ingredientName,
          isGRAS: true,
          matchedEntry: ing,
          matchType: 'synonym',
        };
      }
    }
  }

  // Strategy 3: Improved fuzzy match
  // Prioritize matching the LAST significant word (usually the core ingredient)
  // e.g., "CALCIUM D-PANTOTHENATE" → try "pantothenate" first, then "calcium"
  // e.g., "GROUND ROASTED COFFEE" → try "coffee" first, then "roasted", then "ground"
  const searchTerms = normalized.split(' ').filter(word => word.length > 3);
  if (searchTerms.length > 0) {
    // Try terms in reverse order (last word is usually the core ingredient)
    const reversedTerms = [...searchTerms].reverse();

    for (const term of reversedTerms) {
      const { data: fuzzyMatches } = await supabase
        .from('gras_ingredients')
        .select('*')
        .eq('is_active', true)
        .ilike('ingredient_name', `%${term}%`)
        .limit(5); // Get multiple matches to find best one

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        // Prefer shorter matches (more specific)
        // e.g., prefer "Coffee" over "Coffee fruit extract"
        const bestMatch = fuzzyMatches.reduce((best, current) => {
          // Prioritize exact word matches
          const currentWords = current.ingredient_name.toLowerCase().split(/\s+/);
          const bestWords = best.ingredient_name.toLowerCase().split(/\s+/);

          if (currentWords.includes(term) && !bestWords.includes(term)) {
            return current;
          }
          if (!currentWords.includes(term) && bestWords.includes(term)) {
            return best;
          }

          // If both have exact word match or neither does, prefer shorter name
          return current.ingredient_name.length < best.ingredient_name.length ? current : best;
        });

        return {
          ingredient: ingredientName,
          isGRAS: true,
          matchedEntry: bestMatch,
          matchType: 'fuzzy',
        };
      }
    }
  }

  // Not found in GRAS database
  return {
    ingredient: ingredientName,
    isGRAS: false,
  };
}

/**
 * Check multiple ingredients against GRAS database
 * Returns comprehensive compliance report
 */
export async function checkGRASCompliance(
  ingredients: string[]
): Promise<GRASComplianceReport> {
  if (!ingredients || ingredients.length === 0) {
    return {
      totalIngredients: 0,
      grasCompliant: 0,
      nonGRASIngredients: [],
      grasIngredients: [],
      detailedResults: [],
      overallCompliant: true,
      criticalIssues: [],
    };
  }

  // Check each ingredient
  const results = await Promise.all(
    ingredients.map(ing => checkSingleIngredient(ing))
  );

  const grasIngredients = results.filter(r => r.isGRAS).map(r => r.ingredient);
  const nonGRASIngredients = results.filter(r => !r.isGRAS).map(r => r.ingredient);

  const criticalIssues = nonGRASIngredients.map(
    ing => `Ingredient "${ing}" is NOT in the FDA GRAS database and may require special approval or be prohibited for use in food products.`
  );

  return {
    totalIngredients: ingredients.length,
    grasCompliant: grasIngredients.length,
    nonGRASIngredients,
    grasIngredients,
    detailedResults: results,
    overallCompliant: nonGRASIngredients.length === 0,
    criticalIssues,
  };
}

/**
 * Get GRAS ingredient details by name
 */
export async function getGRASIngredient(name: string): Promise<GRASIngredient | null> {
  const { data } = await supabase
    .from('gras_ingredients')
    .select('*')
    .eq('is_active', true)
    .ilike('ingredient_name', normalizeIngredientName(name))
    .maybeSingle();

  return data;
}

/**
 * Search GRAS database
 */
export async function searchGRASIngredients(
  query: string,
  limit: number = 50
): Promise<GRASIngredient[]> {
  const { data, error } = await supabase
    .from('gras_ingredients')
    .select('*')
    .eq('is_active', true)
    .or(`ingredient_name.ilike.%${query}%,common_name.ilike.%${query}%`)
    .order('ingredient_name')
    .limit(limit);

  if (error) {
    console.error('Error searching GRAS ingredients:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all GRAS ingredients by category
 */
export async function getGRASIngredientsByCategory(
  category: string
): Promise<GRASIngredient[]> {
  const { data, error } = await supabase
    .from('gras_ingredients')
    .select('*')
    .eq('is_active', true)
    .eq('category', category)
    .order('ingredient_name');

  if (error) {
    console.error('Error fetching GRAS ingredients by category:', error);
    return [];
  }

  return data || [];
}

/**
 * Build context message for AI about GRAS compliance
 */
export function buildGRASContext(complianceReport: GRASComplianceReport): string {
  if (complianceReport.overallCompliant) {
    return `
## GRAS Compliance Status: ✅ COMPLIANT

All ${complianceReport.totalIngredients} ingredients are found in the FDA GRAS (Generally Recognized as Safe) database.
This is a positive compliance indicator.
`;
  }

  const nonGRASList = complianceReport.nonGRASIngredients
    .map((ing, idx) => `${idx + 1}. ${ing}`)
    .join('\n');

  return `
## ⚠️ CRITICAL: GRAS Compliance Issue Detected

The following ${complianceReport.nonGRASIngredients.length} ingredient(s) are NOT found in the FDA GRAS database:

${nonGRASList}

IMPORTANT: Ingredients not in the GRAS database may:
- Require FDA pre-market approval (food additive petition)
- Be prohibited substances
- Require special GRAS determination
- Need specific usage limitations or conditions

This is a CRITICAL COMPLIANCE ISSUE and should be flagged as a major violation.

Instructions for AI:
1. Mark this as a CRITICAL PRIORITY recommendation
2. Advise removal of non-GRAS ingredients OR obtaining proper FDA approval
3. Include specific ingredient names in your recommendations
4. Cite 21 CFR 170.3 (definitions) and 21 CFR 170.30 (GRAS determination)
`;
}
