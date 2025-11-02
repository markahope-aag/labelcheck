require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    console.log('=== CHECKING FOR DUPLICATE NDI TABLES ===\n');

    const tablesToCheck = [
      'ndi_ingredients', // correct
      'ndi_ingredient',
      'new_dietary_ingredients',
      'dietary_ingredients',
      'ndiingredients',
    ];

    for (const tableName of tablesToCheck) {
      console.log(`Checking: ${tableName}`);

      const { data, error, count } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: false })
        .limit(3);

      if (error) {
        console.log(`  ❌ Not found or error: ${error.message}\n`);
      } else {
        const isCorrect =
          tableName === 'ndi_ingredients' ? ' ✅ CORRECT TABLE' : ' ⚠️  POSSIBLE DUPLICATE';
        console.log(`  ${isCorrect}`);
        console.log(`  Total rows: ${count}`);

        if (data && data.length > 0) {
          console.log(`  Columns: ${Object.keys(data[0]).join(', ')}`);
          console.log(`  Sample: ${data[0].ingredient_name || data[0].name || 'N/A'}`);
        }
        console.log('');
      }
    }

    console.log('=== RECOMMENDATION ===');
    console.log('The correct table is: "ndi_ingredients"');
    console.log('\nIf the other tables are duplicates and not used, you should:');
    console.log('1. Verify they are not referenced in your code');
    console.log('2. Delete them from Supabase Dashboard > Table Editor');
    console.log('3. This will prevent confusion and data inconsistency');
  } catch (error) {
    console.error('Error:', error.message);
  }
})();
