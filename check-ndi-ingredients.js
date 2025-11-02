require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkIngredients() {
  const testIngredients = [
    'Cordyceps Extract',
    'Fenugreek Seed Extract',
    'Siberian Ginseng Extract',
    'Guarana Extract',
    'Maca Extract',
  ];

  console.log('=== CHECKING OLD DIETARY INGREDIENTS DATABASE ===\n');

  for (const ingredient of testIngredients) {
    console.log(`\nSearching for: ${ingredient}`);

    // Check old dietary ingredients
    const { data: oldDI, error: oldError } = await supabase
      .from('old_dietary_ingredients')
      .select('ingredient_name, source')
      .or(
        `ingredient_name.ilike.%${ingredient}%,ingredient_name.ilike.%${ingredient.replace(' Extract', '')}%`
      )
      .limit(5);

    if (oldError) {
      console.error('Error:', oldError);
    } else if (oldDI && oldDI.length > 0) {
      console.log(`✅ FOUND in old_dietary_ingredients:`);
      oldDI.forEach((item) => {
        console.log(`   - ${item.ingredient_name} (${item.source})`);
      });
    } else {
      console.log(`❌ NOT FOUND in old_dietary_ingredients`);
    }

    // Check NDI ingredients
    const { data: ndiData, error: ndiError } = await supabase
      .from('ndi_ingredients')
      .select('ingredient_name, ndi_number')
      .or(
        `ingredient_name.ilike.%${ingredient}%,ingredient_name.ilike.%${ingredient.replace(' Extract', '')}%`
      )
      .limit(5);

    if (ndiError) {
      console.error('Error:', ndiError);
    } else if (ndiData && ndiData.length > 0) {
      console.log(`✅ FOUND in ndi_ingredients:`);
      ndiData.forEach((item) => {
        console.log(`   - ${item.ingredient_name} (NDI #${item.ndi_number})`);
      });
    } else {
      console.log(`❌ NOT FOUND in ndi_ingredients`);
    }
  }

  // Count total records
  const { count: oldCount } = await supabase
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true });

  const { count: ndiCount } = await supabase
    .from('ndi_ingredients')
    .select('*', { count: 'exact', head: true });

  console.log(`\n\n=== DATABASE TOTALS ===`);
  console.log(`Old Dietary Ingredients: ${oldCount}`);
  console.log(`NDI Ingredients: ${ndiCount}`);
}

checkIngredients()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
