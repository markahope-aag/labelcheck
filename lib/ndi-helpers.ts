import { supabase } from './supabase';

/**
 * Cache for old dietary ingredients from database
 * This avoids hitting the database on every ingredient check
 */
let oldDietaryIngredientsCache: Set<string> | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * Fetch old dietary ingredients from database
 * Results are cached for 1 hour to improve performance
 */
async function getOldDietaryIngredients(): Promise<Set<string>> {
  const now = Date.now();

  // Return cached data if still fresh
  if (oldDietaryIngredientsCache && (now - cacheTimestamp) < CACHE_DURATION) {
    return oldDietaryIngredientsCache;
  }

  try {
    // Fetch from database
    const { data, error } = await supabase
      .from('old_dietary_ingredients')
      .select('ingredient_name, synonyms')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching old dietary ingredients:', error);
      // Return fallback list on error
      return getFallbackPre1994Ingredients();
    }

    // Build set with ingredient names and synonyms
    const ingredientSet = new Set<string>();

    data?.forEach((row) => {
      // Add main ingredient name
      ingredientSet.add(row.ingredient_name.toLowerCase());

      // Add synonyms if present
      if (row.synonyms && Array.isArray(row.synonyms)) {
        row.synonyms.forEach((synonym: string) => {
          ingredientSet.add(synonym.toLowerCase());
        });
      }
    });

    // Update cache
    oldDietaryIngredientsCache = ingredientSet;
    cacheTimestamp = now;

    return ingredientSet;
  } catch (error) {
    console.error('Error in getOldDietaryIngredients:', error);
    return getFallbackPre1994Ingredients();
  }
}

/**
 * Fallback list of common pre-1994 ingredients
 * Used when database is unavailable
 */
function getFallbackPre1994Ingredients(): Set<string> {
  return new Set([
    // Vitamins
    'vitamin a', 'retinol', 'beta-carotene', 'beta carotene',
    'vitamin b1', 'thiamin', 'thiamine', 'thiamine mononitrate', 'thiamine hydrochloride',
    'vitamin b2', 'riboflavin',
    'vitamin b3', 'niacin', 'nicotinic acid', 'nicotinamide', 'niacinamide',
    'vitamin b5', 'pantothenic acid', 'calcium pantothenate', 'calcium d-pantothenate',
    'vitamin b6', 'pyridoxine', 'pyridoxine hydrochloride', 'pyridoxal',
    'vitamin b7', 'biotin',
    'vitamin b9', 'folic acid', 'folate', 'methylfolate',
    'vitamin b12', 'cobalamin', 'cyanocobalamin', 'methylcobalamin', 'adenosylcobalamin',
    'vitamin c', 'ascorbic acid', 'sodium ascorbate', 'calcium ascorbate',
    'vitamin d', 'vitamin d2', 'vitamin d3', 'ergocalciferol', 'cholecalciferol',
    'vitamin e', 'tocopherol', 'alpha-tocopherol', 'd-alpha-tocopherol',
    'vitamin k', 'vitamin k1', 'vitamin k2', 'phylloquinone', 'menaquinone',

    // Minerals
    'calcium', 'calcium carbonate', 'calcium citrate', 'calcium phosphate',
    'iron', 'ferrous sulfate', 'ferrous fumarate', 'ferric', 'iron chelate',
    'magnesium', 'magnesium oxide', 'magnesium citrate', 'magnesium glycinate',
    'zinc', 'zinc oxide', 'zinc gluconate', 'zinc citrate', 'zinc picolinate',
    'iodine', 'potassium iodide', 'sodium iodide', 'kelp',
    'selenium', 'sodium selenite', 'sodium selenate', 'selenomethionine',
    'copper', 'copper gluconate', 'copper sulfate',
    'manganese', 'manganese gluconate', 'manganese sulfate',
    'chromium', 'chromium picolinate', 'chromium polynicotinate',
    'molybdenum', 'sodium molybdate',
    'potassium', 'potassium chloride', 'potassium citrate',
    'phosphorus', 'phosphate',
    'sodium', 'sodium chloride', 'salt',

    // Common herbs and botanicals
    'ginseng', 'panax ginseng',
    'ginkgo', 'ginkgo biloba',
    'echinacea',
    'garlic', 'allium sativum',
    'ginger', 'zingiber officinale',
    'green tea', 'camellia sinensis', 'green tea extract', 'green tea leaf extract',
    'chamomile',
    'valerian', 'valerian root',
    'st. john\'s wort', 'st john\'s wort', 'st johns wort',
    'saw palmetto',
    'milk thistle', 'silymarin',
    'black cohosh',

    // Amino Acids
    'l-lysine', 'lysine',
    'l-arginine', 'arginine',
    'l-glutamine', 'glutamine',
    'l-carnitine', 'carnitine',
    'l-tryptophan', 'tryptophan',
    'l-tyrosine', 'tyrosine',

    // Other common ingredients
    'protein', 'whey protein', 'soy protein', 'casein',
    'fiber', 'psyllium', 'inulin',
    'lecithin', 'soy lecithin',
    'omega-3', 'fish oil', 'dha', 'epa',
    'coenzyme q10', 'coq10', 'ubiquinone',
    'glucosamine', 'glucosamine sulfate', 'glucosamine hydrochloride',
    'chondroitin', 'chondroitin sulfate',
    'msm', 'methylsulfonylmethane',

    // Food-based ingredients
    'coffee', 'caffeine', 'arabica', 'robusta',
    'tea', 'black tea', 'oolong tea',
    'cocoa', 'cacao',
    'spirulina', 'chlorella',
  ]);
}

/**
 * Check if an ingredient is likely a pre-1994 dietary ingredient
 * Uses database-backed list with fallback to hardcoded list
 */
async function isLikelyPre1994Ingredient(ingredient: string): Promise<boolean> {
  const cleanIngredient = ingredient.trim().toLowerCase();

  // Get ingredients list (from cache or database)
  const pre1994Ingredients = await getOldDietaryIngredients();

  // Check for exact match
  if (pre1994Ingredients.has(cleanIngredient)) {
    return true;
  }

  // Check for partial matches (e.g., "calcium d-pantothenate 1%" matches "calcium d-pantothenate")
  const ingredientsArray = Array.from(pre1994Ingredients);
  for (const knownIngredient of ingredientsArray) {
    if (cleanIngredient.includes(knownIngredient) || knownIngredient.includes(cleanIngredient)) {
      return true;
    }
  }

  return false;
}

export interface NDIIngredient {
  id: string;
  notification_number: number;
  report_number: string | null;
  ingredient_name: string;
  firm: string | null;
  submission_date: string | null;
  fda_response_date: string | null;
}

export interface NDICheckResult {
  ingredient: string;
  hasNDI: boolean;
  ndiMatch: NDIIngredient | null;
  matchType: 'exact' | 'partial' | null;
  requiresNDI: boolean;
  complianceNote: string;
}

/**
 * Check if an ingredient has an NDI (New Dietary Ingredient) notification
 *
 * Per DSHEA 1994:
 * - Ingredients marketed BEFORE Oct 15, 1994 are "grandfathered" (no NDI required)
 * - Ingredients marketed AFTER Oct 15, 1994 require NDI notification 75 days before marketing
 *
 * This function checks if an ingredient has an NDI notification on file.
 */
export async function checkNDICompliance(
  ingredients: string[]
): Promise<{
  results: NDICheckResult[];
  summary: {
    totalChecked: number;
    withNDI: number;
    withoutNDI: number;
    requiresNotification: number;
  };
}> {
  if (!ingredients || ingredients.length === 0) {
    return {
      results: [],
      summary: {
        totalChecked: 0,
        withNDI: 0,
        withoutNDI: 0,
        requiresNotification: 0,
      },
    };
  }

  // Fetch all NDI ingredients for matching
  const { data: ndiIngredients, error } = await supabase
    .from('ndi_ingredients')
    .select('*')
    .order('ingredient_name');

  if (error) {
    console.error('Error fetching NDI ingredients:', error);
    return {
      results: ingredients.map(ing => ({
        ingredient: ing,
        hasNDI: false,
        ndiMatch: null,
        matchType: null,
        requiresNDI: false,
        complianceNote: 'Unable to check NDI database',
      })),
      summary: {
        totalChecked: ingredients.length,
        withNDI: 0,
        withoutNDI: 0,
        requiresNotification: 0,
      },
    };
  }

  const results: NDICheckResult[] = [];
  let withNDI = 0;
  let withoutNDI = 0;
  let requiresNotification = 0;

  for (const ingredient of ingredients) {
    const cleanIngredient = ingredient.trim().toLowerCase();

    // Try exact match first
    let match = ndiIngredients?.find(
      (ndi) => ndi.ingredient_name.toLowerCase() === cleanIngredient
    );

    let matchType: 'exact' | 'partial' | null = null;

    if (match) {
      matchType = 'exact';
    } else {
      // Try partial match (ingredient name contains the search term or vice versa)
      match = ndiIngredients?.find((ndi) => {
        const ndiName = ndi.ingredient_name.toLowerCase();
        return ndiName.includes(cleanIngredient) || cleanIngredient.includes(ndiName);
      });

      if (match) {
        matchType = 'partial';
      }
    }

    if (match) {
      // Ingredient HAS an NDI notification - this is GOOD for compliance
      withNDI++;
      results.push({
        ingredient,
        hasNDI: true,
        ndiMatch: match,
        matchType,
        requiresNDI: false,
        complianceNote: `NDI notification #${match.notification_number} on file with FDA (submitted ${match.submission_date || 'unknown date'})`,
      });
    } else {
      // Ingredient does NOT have an NDI notification
      // Check if it's a known pre-1994 ingredient
      const isPre1994 = await isLikelyPre1994Ingredient(ingredient);

      withoutNDI++;

      if (isPre1994) {
        // Known pre-1994 ingredient - NO NDI notification needed
        results.push({
          ingredient,
          hasNDI: false,
          ndiMatch: null,
          matchType: null,
          requiresNDI: false,
          complianceNote:
            `Common dietary ingredient marketed before October 15, 1994. ` +
            `No NDI notification required (grandfathered under DSHEA).`,
        });
      } else {
        // Unknown ingredient - may require NDI notification
        requiresNotification++;

        results.push({
          ingredient,
          hasNDI: false,
          ndiMatch: null,
          matchType: null,
          requiresNDI: true,
          complianceNote:
            `No NDI notification found and ingredient not recognized as common pre-1994 dietary ingredient. ` +
            `If this ingredient was NOT marketed before October 15, 1994, an NDI notification is required ` +
            `75 days before marketing per DSHEA. Verify ingredient was on market pre-1994 or has valid NDI notification.`,
        });
      }
    }
  }

  return {
    results,
    summary: {
      totalChecked: ingredients.length,
      withNDI,
      withoutNDI,
      requiresNotification,
    },
  };
}

/**
 * Get detailed NDI information for display
 */
export function formatNDIInfo(ndiIngredient: NDIIngredient): string {
  const parts = [
    `NDI Notification #${ndiIngredient.notification_number}`,
    ndiIngredient.report_number ? `(${ndiIngredient.report_number})` : '',
    ndiIngredient.firm ? `- Firm: ${ndiIngredient.firm}` : '',
    ndiIngredient.submission_date ? `- Submitted: ${new Date(ndiIngredient.submission_date).toLocaleDateString()}` : '',
    ndiIngredient.fda_response_date ? `- FDA Response: ${new Date(ndiIngredient.fda_response_date).toLocaleDateString()}` : '',
  ].filter(Boolean);

  return parts.join(' ');
}
