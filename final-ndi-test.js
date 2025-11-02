require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// All 24 ingredients from the original issue
const allIngredients = [
  'Calcium (Carbonate)',
  'Magnesium (Oxide)',
  'Zinc (Oxide)',
  'Royal Jelly',
  '5-HTP',
  'Coenzyme Q10',
  'Lutein',
  'Caffeine',
  'Eleuthero (Root)',
  'Green Tea Extract (Leaf)',
  'Korean Ginseng (Root)',
  'Astragalus (Root)',
  'Cayenne (Fruit)',
  'Guarana Extract (Seed)',
  'Kola Nut Extract',
  'Noni (Root)',
  'Schisandra (Berry)',
  'Reishi Mushroom (Whole)',
  'Cellulose',
  'Stearic Acid',
  'Silicon Dioxide',
  'Croscarmellose Sodium',
  'Magnesium Stearate',
  'Ethyl Cellulose',
];

// Simulate the matching logic from ndi-helpers.ts
async function getOldDietaryIngredients() {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('ingredient_name, synonyms')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error:', error);
      return new Set();
    }

    if (data && data.length > 0) {
      allData = allData.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  const ingredientSet = new Set();
  allData.forEach((row) => {
    ingredientSet.add(row.ingredient_name.toLowerCase());
    if (row.synonyms && Array.isArray(row.synonyms)) {
      row.synonyms.forEach((synonym) => {
        ingredientSet.add(synonym.toLowerCase());
      });
    }
  });

  return ingredientSet;
}

async function isLikelyPre1994Ingredient(ingredient, pre1994Ingredients) {
  const cleanIngredient = ingredient.trim().toLowerCase();
  const normalizedIngredient = cleanIngredient
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Exact match with original
  if (pre1994Ingredients.has(cleanIngredient)) {
    return { found: true, method: 'exact (original)' };
  }

  // Exact match with normalized
  if (pre1994Ingredients.has(normalizedIngredient)) {
    return { found: true, method: 'exact (normalized)' };
  }

  // First word/two words
  const firstTwoWords = normalizedIngredient.split(' ').slice(0, 2).join(' ');
  const firstWord = normalizedIngredient.split(' ')[0];

  if (pre1994Ingredients.has(firstWord)) {
    return { found: true, method: 'first word' };
  }

  if (firstTwoWords !== firstWord && pre1994Ingredients.has(firstTwoWords)) {
    return { found: true, method: 'first two words' };
  }

  // Partial match
  const ingredientsArray = Array.from(pre1994Ingredients);
  for (const knownIngredient of ingredientsArray) {
    if (
      normalizedIngredient.includes(knownIngredient) ||
      knownIngredient.includes(normalizedIngredient)
    ) {
      return { found: true, method: `partial match (${knownIngredient})` };
    }
  }

  return { found: false, method: null };
}

async function test() {
  console.log('Final comprehensive NDI test\n');
  console.log('Loading old dietary ingredients database...');

  const pre1994Set = await getOldDietaryIngredients();
  console.log(`✓ Loaded ${pre1994Set.size} unique ingredients (including synonyms)\n`);

  console.log('Testing all 24 ingredients:\n');

  let foundCount = 0;
  let notFoundCount = 0;

  for (const ing of allIngredients) {
    const result = await isLikelyPre1994Ingredient(ing, pre1994Set);
    if (result.found) {
      console.log(`✓ ${ing} - FOUND (${result.method})`);
      foundCount++;
    } else {
      console.log(`✗ ${ing} - NOT FOUND`);
      notFoundCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`RESULTS:`);
  console.log(`  Found: ${foundCount} / ${allIngredients.length}`);
  console.log(`  Not Found: ${notFoundCount} / ${allIngredients.length}`);
  console.log(`========================================`);

  if (notFoundCount === 0) {
    console.log('\n🎉 SUCCESS! All ingredients are now in the database!');
  } else {
    console.log('\n⚠️  Some ingredients still not found. May need additional additions.');
  }
}

test().catch(console.error);
