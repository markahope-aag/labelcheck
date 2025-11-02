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

async function testGRASPagination() {
  console.log('Testing GRAS ingredient pagination...\n');

  // Fetch all GRAS ingredients with pagination (same logic as gras-helpers.ts)
  let allIngredients = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`Fetching page ${page + 1}...`);

    const { data: pageData, error } = await supabaseAdmin
      .from('gras_ingredients')
      .select('*')
      .eq('is_active', true)
      .not('synonyms', 'is', null)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    if (pageData && pageData.length > 0) {
      console.log(`  → Got ${pageData.length} ingredients`);
      allIngredients = [...allIngredients, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  console.log(`\n========================================`);
  console.log(`Total GRAS ingredients loaded: ${allIngredients.length}`);
  console.log(`========================================\n`);

  // Count ingredients with synonyms
  const withSynonyms = allIngredients.filter((ing) => ing.synonyms && ing.synonyms.length > 0);
  console.log(`Ingredients with synonyms: ${withSynonyms.length}`);

  // Calculate total entries (including synonyms)
  let totalEntries = allIngredients.length;
  allIngredients.forEach((ing) => {
    if (ing.synonyms && Array.isArray(ing.synonyms)) {
      totalEntries += ing.synonyms.length;
    }
  });
  console.log(`Total searchable entries (including synonyms): ${totalEntries}`);

  // Test a few sample ingredient matches
  console.log('\n========================================');
  console.log('Testing sample ingredient matches:');
  console.log('========================================\n');

  const testIngredients = [
    'caffeine',
    'vitamin c',
    'ascorbic acid',
    'citric acid',
    'sodium benzoate',
  ];

  for (const testIng of testIngredients) {
    const normalized = testIng.toLowerCase().trim();

    // Try exact match
    const exactMatch = allIngredients.find(
      (ing) => ing.ingredient_name.toLowerCase() === normalized
    );

    if (exactMatch) {
      console.log(`✓ "${testIng}" - FOUND (exact match: ${exactMatch.ingredient_name})`);
      continue;
    }

    // Try synonym match
    const synonymMatch = allIngredients.find(
      (ing) => ing.synonyms && ing.synonyms.some((syn) => syn.toLowerCase() === normalized)
    );

    if (synonymMatch) {
      console.log(`✓ "${testIng}" - FOUND (synonym of: ${synonymMatch.ingredient_name})`);
      continue;
    }

    console.log(`✗ "${testIng}" - NOT FOUND`);
  }

  console.log('\n🎉 GRAS pagination test complete!');
}

testGRASPagination().catch(console.error);
