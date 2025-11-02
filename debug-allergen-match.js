require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugAllergenMatch() {
  // Get ALL allergens first
  const { data: allAllergens, error: allError } = await supabase
    .from('major_allergens')
    .select('*')
    .eq('is_active', true);

  if (allError) {
    console.error('Error fetching all allergens:', allError);
    return;
  }

  console.log(`=== TOTAL ALLERGENS IN DATABASE: ${allAllergens?.length || 0} ===\n`);

  // Group by category
  const byCategory = {};
  allAllergens?.forEach((a) => {
    if (!byCategory[a.allergen_category]) {
      byCategory[a.allergen_category] = [];
    }
    byCategory[a.allergen_category].push(a);
  });

  Object.keys(byCategory).forEach((category) => {
    console.log(`${category}: ${byCategory[category].length} allergens`);
  });

  // Get shellfish allergens
  const { data: allergens, error } = await supabase
    .from('major_allergens')
    .select('*')
    .eq('allergen_category', 'shellfish')
    .eq('is_active', true);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n=== SHELLFISH ALLERGENS ===\n');

  allergens.forEach((allergen) => {
    console.log(`Allergen: ${allergen.allergen_name}`);
    console.log(`Derivatives (${allergen.derivatives?.length || 0}):`, allergen.derivatives);
    console.log('---');
  });

  // Test the problematic ingredients + real allergen positive cases
  const testIngredients = [
    'cordyceps extract',
    'fenugreek seed extract',
    'siberian ginseng extract',
    // Real allergens that SHOULD match:
    'shrimp extract',
    'contains shellfish extract',
    'glucosamine sulfate',
  ];

  console.log('\n=== TESTING FUZZY MATCHING ===\n');

  for (const ingredient of testIngredients) {
    const normalized = ingredient.toLowerCase().trim();
    const searchTerms = normalized.split(' ').filter((word) => word.length > 3);

    console.log(`Ingredient: ${ingredient}`);
    console.log(`Search terms: ${searchTerms.join(', ')}`);

    // NEW LOGIC: Check if ingredient CONTAINS derivative (not if derivative contains word)
    for (const allergen of allergens) {
      const fuzzyMatch = allergen.derivatives?.some((derivative) =>
        normalized.includes(derivative.toLowerCase())
      );

      if (fuzzyMatch) {
        const matchingDerivatives = allergen.derivatives.filter((d) =>
          normalized.includes(d.toLowerCase())
        );
        console.log(
          `  ❌ MATCH: "${normalized}" contains derivative from allergen "${allergen.allergen_name}"`
        );
        console.log(`     Matching derivatives: ${matchingDerivatives.join(', ')}`);
      } else {
        console.log(`  ✅ NO MATCH: "${normalized}" does not contain any shellfish derivatives`);
      }
    }
    console.log('---');
  }
}

debugAllergenMatch()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
