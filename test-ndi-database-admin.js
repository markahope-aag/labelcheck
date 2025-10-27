require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

// Use service role key to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Test ingredients from the problematic analysis
const testIngredients = [
  'coffee',
  'arabica',
  'robusta',
  'nicotinamide',
  'green tea',
  'green tea leaf extract',
  'calcium d-pantothenate',
  'pyridoxine hydrochloride',
  'thiamine mononitrate',
  'potassium iodide',
  'cholecalciferol',
  'methylcobalamin'
];

async function testNDIDatabase() {
  console.log('=== TESTING NDI COMPLIANCE WITH DATABASE (ADMIN) ===\n');

  // Step 1: Check old_dietary_ingredients table
  console.log('Step 1: Checking old_dietary_ingredients table...');
  const { data: allIngredients, error: allError, count } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true });

  if (allError) {
    console.error('❌ Error accessing old_dietary_ingredients:', allError.message);
    process.exit(1);
  }

  console.log(`✓ Table accessible with ${count} ingredients\n`);

  // Step 2: Check specific ingredient names
  console.log('Step 2: Checking for specific expected ingredients...\n');

  for (const ingredient of testIngredients) {
    const { data: match } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('ingredient_name')
      .ilike('ingredient_name', `%${ingredient}%`)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (match) {
      console.log(`✅ Found: "${ingredient}" → ${match.ingredient_name}`);
    } else {
      console.log(`❌ NOT FOUND: "${ingredient}"`);
    }
  }

  // Step 3: Sample some random ingredients from the database
  console.log('\nStep 3: Sample of ingredients in database:\n');
  const { data: sample } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('ingredient_name')
    .limit(20);

  if (sample) {
    sample.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.ingredient_name}`);
    });
  }

  console.log('\n=== TEST COMPLETE ===');
}

testNDIDatabase().catch(error => {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
});
