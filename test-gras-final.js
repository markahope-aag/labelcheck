require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizeIngredientName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/[,;].*$/, '')
    .replace(/\b(d|l|dl)-/gi, '')
    .replace(/\s+\d+%\s*$/, '')
    .trim();
}

async function checkSingleIngredient(ingredientName) {
  const normalized = normalizeIngredientName(ingredientName);

  const { data: exactMatch } = await supabaseAdmin
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

  const GENERIC_TERMS = ['extract', 'powder', 'concentrate', 'isolate', 'blend', 'complex', 'root', 'seed', 'leaf', 'fruit', 'berry'];
  const searchTerms = normalized
    .split(' ')
    .filter(word => word.length > 3 && !GENERIC_TERMS.includes(word));

  if (searchTerms.length > 0) {
    const sortedTerms = [...searchTerms].sort((a, b) => b.length - a.length);

    for (const term of sortedTerms) {
      const { data: fuzzyMatches } = await supabaseAdmin
        .from('gras_ingredients')
        .select('*')
        .eq('is_active', true)
        .ilike('ingredient_name', `%${term}%`)
        .limit(5);

      if (fuzzyMatches && fuzzyMatches.length > 0) {
        const bestMatch = fuzzyMatches.reduce((best, current) => {
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

  return {
    ingredient: ingredientName,
    isGRAS: false,
  };
}

async function test() {
  const energyDrinkIngredients = [
    'Carbonated Water',
    'Citric Acid',
    'Erythritol',
    'Sucralose',
    'Sodium Benzoate',
    'Potassium Sorbate',
    'L-Carnitine Tartrate',
    'Taurine',
    'Caffeine',
    'Panax Ginseng Root Extract',
    'Guarana Seed Extract'
  ];

  console.log('Testing GRAS matching with FINAL logic...\n');

  let grasCount = 0;
  let nonGrasCount = 0;

  for (const ing of energyDrinkIngredients) {
    const result = await checkSingleIngredient(ing);
    if (result.isGRAS) {
      console.log(`✓ ${ing}`);
      console.log(`  Match: ${result.matchedEntry.ingredient_name} (${result.matchType})`);
      grasCount++;
    } else {
      console.log(`✗ ${ing} - NOT GRAS`);
      nonGrasCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`GRAS: ${grasCount} | Non-GRAS: ${nonGrasCount}`);
  console.log(`========================================`);
}

test();
