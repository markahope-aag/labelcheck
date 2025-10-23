import { supabase } from './supabase';

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
      // This could mean:
      // 1. It was marketed before Oct 15, 1994 (grandfathered) - COMPLIANT
      // 2. It's a post-1994 ingredient without NDI notification - NON-COMPLIANT
      //
      // Since we can't determine which, we flag it as "may require NDI"
      withoutNDI++;
      requiresNotification++;

      results.push({
        ingredient,
        hasNDI: false,
        ndiMatch: null,
        matchType: null,
        requiresNDI: true,
        complianceNote:
          `No NDI notification found. If this ingredient was NOT marketed before October 15, 1994, ` +
          `an NDI notification is required 75 days before marketing per DSHEA. ` +
          `Verify ingredient was on market pre-1994 or has valid NDI notification.`,
      });
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
