const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test ingredients that should trigger allergen detection
const TEST_INGREDIENTS = {
  milk: [
    'Whey protein isolate',
    'Sodium caseinate',
    'Lactose',
    'Butter',
    'Milk powder',
    'Casein',
    'Cream',
  ],
  egg: [
    'Albumin',
    'Lecithin',
    'Lysozyme',
    'Mayonnaise',
    'Ovalbumin',
  ],
  fish: [
    'Anchovy',
    'Fish sauce',
    'Fish oil',
    'Surimi',
    'Isinglass',
  ],
  shellfish: [
    'Shrimp',
    'Crab',
    'Lobster',
    'Chitosan',
    'Glucosamine',
  ],
  tree_nuts: [
    'Almond',
    'Cashew',
    'Walnut',
    'Almond oil',
    'Marzipan',
    'Hazel nut',
  ],
  peanuts: [
    'Peanut butter',
    'Peanut oil',
    'Groundnuts',
    'Arachis oil',
  ],
  wheat: [
    'Wheat flour',
    'Gluten',
    'Semolina',
    'Seitan',
    'Vital wheat gluten',
    'Modified food starch',
  ],
  soybeans: [
    'Soy lecithin',
    'Tofu',
    'Tempeh',
    'Soy protein isolate',
    'Edamame',
    'Miso',
  ],
  sesame: [
    'Tahini',
    'Sesame oil',
    'Sesame seeds',
    'Benne',
    'Til',
  ],
};

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

async function checkIngredientForAllergen(ingredientName) {
  const normalized = normalizeIngredientName(ingredientName);

  // Fetch all active allergens with pagination
  let allAllergens = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data: pageData } = await supabase
      .from('major_allergens')
      .select('*')
      .eq('is_active', true)
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (pageData && pageData.length > 0) {
      allAllergens = [...allAllergens, ...pageData];
      hasMore = pageData.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }

  // Check for exact allergen name match
  const exactMatch = allAllergens.find(
    (allergen) => allergen.allergen_name.toLowerCase() === normalized
  );

  if (exactMatch) {
    return {
      ingredient: ingredientName,
      containsAllergen: true,
      allergen: exactMatch.allergen_name,
      matchType: 'exact',
      confidence: 'high',
    };
  }

  // Check derivatives array
  for (const allergen of allAllergens) {
    if (allergen.derivatives && allergen.derivatives.length > 0) {
      const derivativeMatch = allergen.derivatives.some(
        (derivative) => derivative.toLowerCase() === normalized
      );

      if (derivativeMatch) {
        return {
          ingredient: ingredientName,
          containsAllergen: true,
          allergen: allergen.allergen_name,
          matchType: 'derivative',
          confidence: 'high',
        };
      }
    }
  }

  return {
    ingredient: ingredientName,
    containsAllergen: false,
    matchType: 'none',
    confidence: 'n/a',
  };
}

async function runTests() {
  console.log('🧪 Testing Allergen Detection System\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // First, verify the database is set up
  const { data: allergenCount, error: countError } = await supabase
    .from('major_allergens')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ ERROR: Allergen database table does not exist!');
    console.log('\n📝 Next Steps:');
    console.log('1. Go to Supabase Dashboard → SQL Editor');
    console.log('2. Run the migration: supabase/migrations/20251024100000_create_allergen_database.sql');
    console.log('3. Re-run this test\n');
    return;
  }

  const totalAllergens = allergenCount;
  console.log(`✅ Allergen database found: ${totalAllergens} allergen(s)\n`);

  if (totalAllergens !== 9) {
    console.log(`⚠️  WARNING: Expected 9 major allergens, found ${totalAllergens}\n`);
  }

  // Test each allergen category
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const [category, ingredients] of Object.entries(TEST_INGREDIENTS)) {
    console.log(`\n🔬 Testing ${category.toUpperCase()} allergen derivatives:\n`);

    for (const ingredient of ingredients) {
      totalTests++;
      const result = await checkIngredientForAllergen(ingredient);

      if (result.containsAllergen) {
        console.log(
          `   ✅ "${ingredient}" → ${result.allergen} (${result.matchType})`
        );
        passedTests++;
      } else {
        console.log(`   ❌ "${ingredient}" → NOT DETECTED`);
        failedTests++;
      }
    }
  }

  // Final summary
  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 TEST RESULTS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log(`✅ Passed: ${passedTests}/${totalTests}`);
  console.log(`❌ Failed: ${failedTests}/${totalTests}`);

  const successRate = Math.round((passedTests / totalTests) * 100);
  console.log(`📈 Success Rate: ${successRate}%\n`);

  if (successRate === 100) {
    console.log('🎉 PERFECT! All allergen derivatives detected correctly!\n');
  } else if (successRate >= 90) {
    console.log('👍 GOOD! Most allergen derivatives detected.\n');
  } else if (successRate >= 70) {
    console.log('⚠️  FAIR: Some allergen derivatives not detected.\n');
  } else {
    console.log('❌ NEEDS IMPROVEMENT: Many allergen derivatives missed.\n');
  }

  console.log('💡 Next Steps:');
  console.log('1. Review failed matches and add missing derivatives');
  console.log('2. Test with real product labels');
  console.log('3. Integrate with analysis API endpoint\n');
}

runTests().catch(console.error);
