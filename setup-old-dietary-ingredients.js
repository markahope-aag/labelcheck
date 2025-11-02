require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error(
    'Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local'
  );
  process.exit(1);
}

// Create admin client to bypass RLS
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  try {
    console.log('=== OLD DIETARY INGREDIENTS SETUP ===\n');

    // Step 1: Create table if it doesn't exist
    console.log('Step 1: Checking if old_dietary_ingredients table exists...');

    const migrationSQL = fs.readFileSync(
      'supabase/migrations/20251024050000_create_old_dietary_ingredients.sql',
      'utf8'
    );

    console.log('Running migration SQL...');
    const { error: migrationError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: migrationSQL,
    });

    // If exec_sql RPC doesn't exist, we'll try a different approach
    // Check if table exists by querying it
    const { error: checkError } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      // Table doesn't exist - need to run migration manually
      console.error('\n⚠️  Table does not exist and migration could not be run automatically.');
      console.error('Please run the migration manually:');
      console.error('1. Go to Supabase Dashboard > SQL Editor');
      console.error('2. Copy and paste the contents of:');
      console.error('   supabase/migrations/20251024050000_create_old_dietary_ingredients.sql');
      console.error('3. Run the SQL');
      console.error('4. Then run this script again.\n');
      process.exit(1);
    } else if (checkError) {
      console.error('Error checking table:', checkError.message);
      process.exit(1);
    } else {
      console.log('✓ Table exists');
    }

    // Step 2: Load ingredients from JSON
    console.log('\nStep 2: Loading ingredients from grandfather-ingredients.json...');
    const ingredientsJson = fs.readFileSync('grandfather-ingredients.json', 'utf8');
    const ingredients = JSON.parse(ingredientsJson);
    console.log(`✓ Found ${ingredients.length} ingredients to import`);

    // Step 3: Prepare data for insertion
    console.log('\nStep 3: Preparing data...');
    const records = ingredients.map((name) => ({
      ingredient_name: name,
      source: 'CRN Grandfather List (September 1998)',
      notes: 'Dietary ingredient marketed in the United States before October 15, 1994',
      is_active: true,
    }));
    console.log(`✓ Prepared ${records.length} records`);

    // Step 4: Insert in batches
    console.log('\nStep 4: Inserting ingredients into Supabase...');
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      process.stdout.write(`  Batch ${batchNum}/${totalBatches} (${batch.length} ingredients)... `);

      const { data, error } = await supabaseAdmin.from('old_dietary_ingredients').upsert(batch, {
        onConflict: 'ingredient_name',
        ignoreDuplicates: false, // Update existing records
      });

      if (error) {
        console.log('❌ ERROR');
        console.error(`    Error: ${error.message}`);
        errorCount += batch.length;
      } else {
        console.log('✓');
        successCount += batch.length;
      }
    }

    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`✓ Successfully imported: ${successCount} ingredients`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} ingredients`);
    }

    // Step 5: Verify count in database
    console.log('\nStep 5: Verifying data...');
    const { count, error: countError } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`✓ Total ingredients in database: ${count}`);
    } else {
      console.error('Error getting count:', countError.message);
    }

    // Show sample ingredients
    console.log('\nSample ingredients from database:');
    const { data: sampleData, error: sampleError } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('ingredient_name')
      .limit(10);

    if (!sampleError && sampleData) {
      sampleData.forEach((row, i) => {
        console.log(`  ${i + 1}. ${row.ingredient_name}`);
      });
    }

    console.log('\n✅ Setup complete!');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
