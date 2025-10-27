require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const missingIngredients = [
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
  'Ethyl Cellulose'
];

async function checkIngredients() {
  console.log('Checking old_dietary_ingredients database...\n');

  // Get total count
  const { count } = await supabase
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true });

  console.log(`Total ingredients in database: ${count}\n`);

  // Check each missing ingredient
  for (const ingredient of missingIngredients) {
    const cleanIngredient = ingredient.toLowerCase();
    const normalizedIngredient = ingredient
      .replace(/\s*\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // Check for exact match
    const { data: exactMatch } = await supabase
      .from('old_dietary_ingredients')
      .select('*')
      .ilike('ingredient_name', cleanIngredient);

    // Check for normalized match
    const { data: normalizedMatch } = await supabase
      .from('old_dietary_ingredients')
      .select('*')
      .ilike('ingredient_name', normalizedIngredient);

    // Check for partial match (first word)
    const firstWord = normalizedIngredient.split(' ')[0];
    const { data: partialMatch } = await supabase
      .from('old_dietary_ingredients')
      .select('*')
      .ilike('ingredient_name', `${firstWord}%`);

    console.log(`\n${ingredient}:`);
    console.log(`  Normalized: ${normalizedIngredient}`);
    console.log(`  First word: ${firstWord}`);
    console.log(`  Exact match: ${exactMatch?.length || 0} results`);
    console.log(`  Normalized match: ${normalizedMatch?.length || 0} results`);
    console.log(`  Partial match: ${partialMatch?.length || 0} results`);

    if (partialMatch && partialMatch.length > 0) {
      console.log(`  Found:`);
      partialMatch.slice(0, 3).forEach(row => {
        console.log(`    - ${row.ingredient_name} (source: ${row.source})`);
      });
    }
  }
}

checkIngredients().catch(console.error);
