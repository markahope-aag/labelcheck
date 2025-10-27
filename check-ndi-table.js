require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    console.log('=== CHECKING NDI INGREDIENTS TABLE ===\n');

    // Check if 'ndi_ingredients' table exists (correct name)
    console.log('1. Checking for "ndi_ingredients" table (CORRECT name)...');
    const { data: correctTable, error: correctError, count: correctCount } = await supabaseAdmin
      .from('ndi_ingredients')
      .select('*', { count: 'exact', head: false })
      .limit(5);

    if (correctError) {
      console.log('   ❌ Table "ndi_ingredients" NOT FOUND');
      console.log('   Error:', correctError.message);
    } else {
      console.log('   ✅ Table "ndi_ingredients" EXISTS');
      console.log(`   Total rows: ${correctCount}`);
      if (correctTable && correctTable.length > 0) {
        console.log('\n   Columns found:');
        Object.keys(correctTable[0]).forEach(col => {
          console.log(`     - ${col}`);
        });
        console.log('\n   Sample data (first 3 rows):');
        correctTable.slice(0, 3).forEach((row, i) => {
          console.log(`     ${i + 1}. ${row.ingredient_name} (Notification #${row.notification_number})`);
        });
      }
    }

    // Check for common misspellings/variations
    console.log('\n2. Checking for possible alternate names...');
    const alternateNames = [
      'ndi_ingredient', // singular
      'new_dietary_ingredients',
      'dietary_ingredients',
      'ndiingredients'
    ];

    for (const tableName of alternateNames) {
      const { error } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (!error) {
        console.log(`   ⚠️  Found table: "${tableName}"`);
      }
    }

    console.log('\n=== EXPECTED TABLE NAME ===');
    console.log('The code expects the table to be named: "ndi_ingredients"');
    console.log('Location: lib/ndi-helpers.ts line 150');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
})();
