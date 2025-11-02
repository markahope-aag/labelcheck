require('dotenv').config({ path: '.env.local' });

// Import the helper function (requires transpiling TypeScript)
// For testing purposes, we'll directly implement the test here

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test ingredients from the problematic analysis
const testIngredients = [
  'GROUND ROASTED COFFEE (ARABICA, ROBUSTA)',
  'NICOTINAMIDE',
  'GREEN TEA LEAF EXTRACT',
  'CALCIUM D-PANTOTHENATE',
  'PYRIDOXINE HYDROCHLORIDE',
  'THIAMINE MONONITRATE',
  'POTASSIUM IODIDE 1%',
  'SODIUM (VI) SELENATE (1% SE)',
  'CHOLECALCIFEROL',
  'METHYLCOBALAMIN 1%',
];

async function testNDIDatabase() {
  console.log('=== TESTING NDI COMPLIANCE WITH DATABASE ===\n');

  // Step 1: Check old_dietary_ingredients table
  console.log('Step 1: Checking old_dietary_ingredients table...');
  const {
    data: oldIngredients,
    error: oldError,
    count,
  } = await supabase.from('old_dietary_ingredients').select('*', { count: 'exact', head: true });

  if (oldError) {
    console.error('❌ Error accessing old_dietary_ingredients:', oldError.message);
    process.exit(1);
  }

  console.log(`✓ Table accessible with ${count} ingredients\n`);

  // Step 2: Test specific ingredients
  console.log('Step 2: Testing ingredients from problematic analysis...\n');

  for (const ingredient of testIngredients) {
    const cleanIngredient = ingredient.trim().toLowerCase();

    // Check if in old_dietary_ingredients
    const { data: matches } = await supabase
      .from('old_dietary_ingredients')
      .select('ingredient_name')
      .eq('is_active', true);

    let found = false;
    let matchedName = null;

    if (matches) {
      for (const row of matches) {
        const dbIngredient = row.ingredient_name.toLowerCase();
        if (cleanIngredient.includes(dbIngredient) || dbIngredient.includes(cleanIngredient)) {
          found = true;
          matchedName = row.ingredient_name;
          break;
        }
      }
    }

    if (found) {
      console.log(`✅ "${ingredient}"`);
      console.log(`   Matched: ${matchedName}`);
      console.log(`   Status: Pre-1994 ingredient (no NDI required)\n`);
    } else {
      console.log(`⚠️  "${ingredient}"`);
      console.log(`   Not found in old_dietary_ingredients table`);
      console.log(`   Status: May require NDI notification\n`);
    }
  }

  // Step 3: Check specific ingredient names that should be in the database
  console.log('Step 3: Checking for specific expected ingredients...\n');

  const expectedIngredients = [
    'nicotinamide',
    'green tea',
    'green tea leaf extract',
    'calcium d-pantothenate',
    'pyridoxine hydrochloride',
    'thiamine mononitrate',
    'potassium iodide',
    'cholecalciferol',
    'methylcobalamin',
    'coffee',
    'caffeine',
    'arabica',
    'robusta',
  ];

  for (const ingredient of expectedIngredients) {
    const { data: match } = await supabase
      .from('old_dietary_ingredients')
      .select('ingredient_name')
      .ilike('ingredient_name', `%${ingredient}%`)
      .limit(1)
      .single();

    if (match) {
      console.log(`✓ Found: "${ingredient}" → ${match.ingredient_name}`);
    } else {
      console.log(`✗ NOT FOUND: "${ingredient}"`);
    }
  }

  console.log('\n=== TEST COMPLETE ===');
}

testNDIDatabase().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
