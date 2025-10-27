require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// Test both regular and admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testBothClients() {
  console.log('Testing regular client (with RLS)...');
  const { data: regularData, error: regularError } = await supabase
    .from('old_dietary_ingredients')
    .select('ingredient_name', { count: 'exact' })
    .limit(5);

  if (regularError) {
    console.log('  ❌ Error:', regularError.message);
  } else {
    console.log(`  ✓ Returned ${regularData?.length || 0} rows`);
  }

  console.log('\nTesting admin client (bypasses RLS)...');
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
      console.log('  ❌ Error on page', page, ':', error.message);
      break;
    }

    console.log(`  Page ${page}: fetched ${data?.length || 0} rows`);

    if (data && data.length > 0) {
      allData = allData.concat(data);
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\n✓ Total fetched: ${allData.length} ingredients`);

  // Build set including synonyms
  const ingredientSet = new Set();
  allData.forEach((row) => {
    ingredientSet.add(row.ingredient_name.toLowerCase());
    if (row.synonyms && Array.isArray(row.synonyms)) {
      row.synonyms.forEach((synonym) => {
        ingredientSet.add(synonym.toLowerCase());
      });
    }
  });

  console.log(`✓ Total unique names (including synonyms): ${ingredientSet.size}`);

  // Test some specific matches
  const testIngredients = ['calcium', 'royal jelly', 'coenzyme q10', 'caffeine', 'green tea extract powder'];

  console.log('\nTesting specific ingredient matches:');
  testIngredients.forEach(ing => {
    const found = ingredientSet.has(ing.toLowerCase());
    console.log(`  ${ing}: ${found ? '✓ FOUND' : '✗ NOT FOUND'}`);
  });
}

testBothClients().catch(console.error);
