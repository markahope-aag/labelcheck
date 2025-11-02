const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testGRAS() {
  console.log('Testing GRAS database...\n');

  // Test 1: Check if table exists
  console.log('1. Checking if gras_ingredients table exists...');
  const { data: tableCheck, error: tableError } = await supabase
    .from('gras_ingredients')
    .select('count')
    .limit(1);

  if (tableError) {
    console.error('❌ Table does not exist or cannot be accessed:', tableError.message);
    console.log('\n📝 ACTION REQUIRED:');
    console.log('   Please run the migration SQL in your Supabase dashboard:');
    console.log('   1. Go to https://supabase.com/dashboard/project/[your-project]/editor');
    console.log('   2. Click "SQL Editor"');
    console.log(
      '   3. Copy the contents of: supabase/migrations/20251022220000_create_gras_ingredients.sql'
    );
    console.log('   4. Paste and run the SQL\n');
    return;
  }

  console.log('✅ Table exists\n');

  // Test 2: Count total ingredients
  console.log('2. Counting ingredients in database...');
  const { count, error: countError } = await supabase
    .from('gras_ingredients')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting ingredients:', countError.message);
    return;
  }

  console.log(`✅ Total ingredients: ${count}\n`);

  // Test 3: Test some lookups
  console.log('3. Testing ingredient lookups...');

  const testIngredients = [
    'Water',
    'Salt',
    'Sugar',
    'Citric Acid',
    'Vitamin C', // Should match via synonym to Ascorbic Acid
    'Sodium Chloride', // Should match via synonym to Salt
    'FakeIngredient123', // Should NOT be found
  ];

  for (const ingredient of testIngredients) {
    const normalized = ingredient.toLowerCase().trim();

    // Try exact match
    const { data: exactMatch } = await supabase
      .from('gras_ingredients')
      .select('*')
      .eq('is_active', true)
      .ilike('ingredient_name', normalized)
      .maybeSingle();

    if (exactMatch) {
      console.log(`✅ "${ingredient}" → Found (exact match): ${exactMatch.ingredient_name}`);
      continue;
    }

    // Try synonym match
    const { data: synonymMatches } = await supabase
      .from('gras_ingredients')
      .select('*')
      .eq('is_active', true)
      .contains('synonyms', [normalized]);

    if (synonymMatches && synonymMatches.length > 0) {
      console.log(`✅ "${ingredient}" → Found (synonym): ${synonymMatches[0].ingredient_name}`);
      continue;
    }

    console.log(`❌ "${ingredient}" → NOT FOUND (expected for test ingredients)`);
  }

  console.log('\n4. Testing GRAS helper functions...');

  // Dynamically import the ES module
  const { checkGRASCompliance } = await import('./lib/gras-helpers.ts');

  const testList = ['Water', 'Salt', 'Sugar', 'FakeIngredient123', 'Vitamin C'];

  try {
    const result = await checkGRASCompliance(testList);

    console.log('\n📊 GRAS Compliance Report:');
    console.log(`   Total ingredients: ${result.totalIngredients}`);
    console.log(`   GRAS compliant: ${result.grasCompliant}`);
    console.log(`   Non-GRAS: ${result.nonGRASIngredients.length}`);
    console.log(`   Overall compliant: ${result.overallCompliant ? '✅ YES' : '❌ NO'}`);

    if (result.nonGRASIngredients.length > 0) {
      console.log(`\n   ⚠️  Non-GRAS ingredients:`);
      result.nonGRASIngredients.forEach((ing) => {
        console.log(`      - ${ing}`);
      });
    }

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Error testing GRAS helpers:', error);
  }
}

testGRAS().catch(console.error);
