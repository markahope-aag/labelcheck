require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkIngredients() {
  const ingredientsToCheck = [
    'Citric Acid',
    'Salt',
    'Sodium Chloride',
    'Dipotassium Phosphate',
    'Trehalose',
    'Stevia',
    'Luo Han Guo',
    'Monk Fruit',
    'Natural Citrus Flavor',
    'Citrus Flavor'
  ];

  console.log('Checking old_dietary_ingredients database for these ingredients:\n');

  for (const ingredient of ingredientsToCheck) {
    const { data, error } = await supabase
      .from('old_dietary_ingredients')
      .select('ingredient_name, source')
      .ilike('ingredient_name', `%${ingredient}%`)
      .limit(5);

    if (error) {
      console.error(`Error checking ${ingredient}:`, error.message);
      continue;
    }

    if (data && data.length > 0) {
      console.log(`✅ Found matches for "${ingredient}":`);
      data.forEach(item => {
        console.log(`   - ${item.ingredient_name} (${item.source || 'N/A'})`);
      });
    } else {
      console.log(`❌ No matches found for "${ingredient}"`);
    }
  }

  console.log('\n=== Database Stats ===');
  const { count, error: countError } = await supabase
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true });

  if (!countError) {
    console.log(`Total ingredients in database: ${count}`);
  }
}

checkIngredients().then(() => {
  console.log('\nCheck complete!');
  process.exit(0);
}).catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
