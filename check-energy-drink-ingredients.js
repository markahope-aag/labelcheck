require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchIngredient(term) {
  const { data } = await supabase
    .from('gras_ingredients')
    .select('ingredient_name')
    .ilike('ingredient_name', `%${term}%`)
    .limit(5);

  return data || [];
}

async function checkMissing() {
  const missing = ['water', 'erythritol', 'carnitine', 'taurine', 'caffeine', 'ginseng', 'guarana'];

  for (const term of missing) {
    const results = await searchIngredient(term);
    console.log(`\nSearching for '${term}':`);
    if (results.length > 0) {
      results.forEach(r => console.log(`  - ${r.ingredient_name}`));
    } else {
      console.log(`  (none found)`);
    }
  }
}

checkMissing();
