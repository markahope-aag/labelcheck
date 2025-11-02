import { supabase } from './supabase';

/**
 * Major Allergen Interface
 * Represents one of the 9 FDA-recognized major food allergens
 */
export interface MajorAllergen {
  id: string;
  allergen_name: string;
  allergen_category: string;
  common_name: string | null;
  derivatives: string[];
  scientific_names: string[];
  cross_reactive_allergens: string[];
  is_active: boolean;
  notes: string | null;
  regulation_citation: string;
  created_at: string;
  updated_at: string;
}

/**
 * Allergen Check Result
 * Result of checking an ingredient against the allergen database
 */
export interface AllergenCheckResult {
  ingredient: string;
  containsAllergen: boolean;
  allergen?: MajorAllergen;
  matchType?: 'exact' | 'derivative' | 'fuzzy';
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Normalize ingredient name for allergen matching
 * Similar to GRAS normalization but allergen-specific
 */
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '') // Remove parenthetical notes
    .replace(/[,;].*$/, '') // Remove anything after comma/semicolon
    .replace(/\b(d|l|dl)-/gi, '') // Remove stereoisomer prefixes
    .replace(/\s+\d+%\s*$/, '') // Remove trailing percentages
    .replace(/\b(from|derived from|contains)\b/gi, '') // Remove source indicators
    .trim();
}

/**
 * Check a single ingredient against the major allergen database
 * Uses exact matching and derivative matching
 */
export async function checkIngredientForAllergens(
  ingredientName: string
): Promise<AllergenCheckResult[]> {
  const normalized = normalizeIngredientName(ingredientName);
  const results: AllergenCheckResult[] = [];

  // Known false positives - ingredients that are NOT allergens but might fuzzy-match
  const FALSE_POSITIVES = [
    'royal jelly', // Bee product, not a tree nut despite containing "jelly"
    'royal gel',
    'bee jelly',
  ];

  if (FALSE_POSITIVES.includes(normalized)) {
    // This ingredient is a known non-allergen, return empty results
    return results;
  }

  // Fetch all active allergens with pagination (handle 1000-row limit)
  let allAllergens: MajorAllergen[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('major_allergens')
      .select('*')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pageData && pageData.length > 0) {
      allAllergens = [...allAllergens, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Strategy 1: Check exact allergen name match
  const exactMatch = allAllergens.find(
    (allergen) => allergen.allergen_name.toLowerCase() === normalized
  );

  if (exactMatch) {
    results.push({
      ingredient: ingredientName,
      containsAllergen: true,
      allergen: exactMatch,
      matchType: 'exact',
      confidence: 'high',
    });
  }

  // Strategy 2: Check derivatives array for matches
  for (const allergen of allAllergens) {
    if (allergen.derivatives && allergen.derivatives.length > 0) {
      const derivativeMatch = allergen.derivatives.some(
        (derivative) => derivative.toLowerCase() === normalized
      );

      if (derivativeMatch) {
        // Avoid duplicate if already matched exactly
        if (!results.find((r) => r.allergen?.id === allergen.id)) {
          results.push({
            ingredient: ingredientName,
            containsAllergen: true,
            allergen: allergen,
            matchType: 'derivative',
            confidence: 'high',
          });
        }
      }
    }
  }

  // Strategy 3: Partial matching (fuzzy) for compound ingredients
  // Only if no exact or derivative matches found
  // Check if the ingredient name CONTAINS any allergen derivative (not the reverse!)
  if (results.length === 0) {
    for (const allergen of allAllergens) {
      if (allergen.derivatives && allergen.derivatives.length > 0) {
        // Check if the ingredient contains any of the allergen's derivatives
        // Use word boundary matching to avoid false positives (e.g., "royal jelly" vs "jelly")
        const fuzzyMatch = allergen.derivatives.some((derivative) => {
          const derivativeLower = derivative.toLowerCase();
          // Skip very short derivatives (< 4 chars) for fuzzy matching to avoid false positives
          if (derivativeLower.length < 4) {
            return false;
          }
          // Use word boundary regex for more accurate matching
          const wordBoundaryRegex = new RegExp(
            `\\b${derivativeLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
          );
          return wordBoundaryRegex.test(normalized);
        });

        if (fuzzyMatch) {
          results.push({
            ingredient: ingredientName,
            containsAllergen: true,
            allergen: allergen,
            matchType: 'fuzzy',
            confidence: 'medium',
          });
          break; // Only add once per allergen
        }
      }
    }
  }

  return results;
}

/**
 * Check multiple ingredients for allergens
 * Returns a summary of all detected allergens
 */
export async function checkIngredientsForAllergens(ingredients: string[]): Promise<{
  allergensDetected: MajorAllergen[];
  ingredientsWithAllergens: {
    ingredient: string;
    allergens: AllergenCheckResult[];
  }[];
  summary: {
    totalIngredients: number;
    ingredientsWithAllergens: number;
    uniqueAllergensDetected: number;
    highConfidenceMatches: number;
    mediumConfidenceMatches: number;
  };
}> {
  const ingredientsWithAllergens: {
    ingredient: string;
    allergens: AllergenCheckResult[];
  }[] = [];

  const allergensDetectedMap = new Map<string, MajorAllergen>();
  let highConfidenceMatches = 0;
  let mediumConfidenceMatches = 0;

  for (const ingredient of ingredients) {
    const results = await checkIngredientForAllergens(ingredient);

    if (results.length > 0) {
      ingredientsWithAllergens.push({
        ingredient,
        allergens: results,
      });

      // Track unique allergens
      for (const result of results) {
        if (result.allergen) {
          allergensDetectedMap.set(result.allergen.id, result.allergen);

          if (result.confidence === 'high') {
            highConfidenceMatches++;
          } else if (result.confidence === 'medium') {
            mediumConfidenceMatches++;
          }
        }
      }
    }
  }

  return {
    allergensDetected: Array.from(allergensDetectedMap.values()),
    ingredientsWithAllergens,
    summary: {
      totalIngredients: ingredients.length,
      ingredientsWithAllergens: ingredientsWithAllergens.length,
      uniqueAllergensDetected: allergensDetectedMap.size,
      highConfidenceMatches,
      mediumConfidenceMatches,
    },
  };
}

/**
 * Get all major allergens from the database
 */
export async function getAllMajorAllergens(): Promise<MajorAllergen[]> {
  let allAllergens: MajorAllergen[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('major_allergens')
      .select('*')
      .eq('is_active', true)
      .order('allergen_name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pageData && pageData.length > 0) {
      allAllergens = [...allAllergens, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  return allAllergens;
}

/**
 * Format allergen results for display
 */
export function formatAllergenResults(results: AllergenCheckResult[]): string {
  if (results.length === 0) {
    return 'No allergens detected';
  }

  return results
    .map((result) => {
      const confidence = result.confidence === 'high' ? '✓' : '?';
      const allergenName = result.allergen?.allergen_name || 'Unknown';
      const matchInfo =
        result.matchType === 'exact'
          ? 'exact match'
          : result.matchType === 'derivative'
            ? 'derivative'
            : 'fuzzy match';

      return `${confidence} ${allergenName} (${matchInfo})`;
    })
    .join(', ');
}
