require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test the actual matching logic from ndi-helpers.ts
async function getOldDietaryIngredients() {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
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

  console.log(`Loaded ${allData.length} ingredients (${ingredientSet.size} total with synonyms)`);
  return ingredientSet;
}

async function isLikelyPre1994Ingredient(ingredient, pre1994Ingredients) {
  const cleanIngredient = ingredient.trim().toLowerCase();

  const normalizedIngredient = cleanIngredient
    .replace(/\s*\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  console.log(`\nTesting: "${ingredient}"`);
  console.log(`  Clean: "${cleanIngredient}"`);
  console.log(`  Normalized: "${normalizedIngredient}"`);

  // Check for exact match with original form
  if (pre1994Ingredients.has(cleanIngredient)) {
    console.log(`  ✓ FOUND: Exact match with original`);
    return true;
  }

  // Check for exact match with normalized form
  if (pre1994Ingredients.has(normalizedIngredient)) {
    console.log(`  ✓ FOUND: Exact match with normalized`);
    return true;
  }

  // Extract first word/two words
  const firstTwoWords = normalizedIngredient.split(' ').slice(0, 2).join(' ');
  const firstWord = normalizedIngredient.split(' ')[0];

  console.log(`  First word: "${firstWord}"`);
  console.log(`  First two words: "${firstTwoWords}"`);

  if (pre1994Ingredients.has(firstWord)) {
    console.log(`  ✓ FOUND: First word match`);
    return true;
  }

  if (firstTwoWords !== firstWord && pre1994Ingredients.has(firstTwoWords)) {
    console.log(`  ✓ FOUND: First two words match`);
    return true;
  }

  // Check for partial matches
  const ingredientsArray = Array.from(pre1994Ingredients);
  for (const knownIngredient of ingredientsArray) {
    if (
      normalizedIngredient.includes(knownIngredient) ||
      knownIngredient.includes(normalizedIngredient)
    ) {
      console.log(`  ✓ FOUND: Partial match with "${knownIngredient}"`);
      return true;
    }
  }

  console.log(`  ✗ NOT FOUND`);
  return false;
}

const testIngredients = [
  'Royal Jelly',
  'Calcium (Carbonate)',
  'Green Tea Extract (Leaf)',
  '5-HTP',
  'Noni (Root)',
  'Cellulose',
];

async function test() {
  const pre1994Set = await getOldDietaryIngredients();

  for (const ing of testIngredients) {
    await isLikelyPre1994Ingredient(ing, pre1994Set);
  }
}

test().catch(console.error);
