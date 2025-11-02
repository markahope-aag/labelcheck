const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testMigration() {
  console.log('📋 Product Category Migration Test\n');
  console.log('This script will test if the migration can be applied.\n');

  try {
    // Test 1: Check if analyses table exists
    console.log('✓ Test 1: Checking if analyses table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('analyses')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Cannot access analyses table:', tableError.message);
      process.exit(1);
    }
    console.log('  ✓ analyses table exists\n');

    // Test 2: Check if product_category column already exists
    console.log('✓ Test 2: Checking if product_category column exists...');
    const { data: columnCheck, error: columnError } = await supabase
      .from('analyses')
      .select('product_category')
      .limit(1);

    if (columnError) {
      if (
        columnError.message.includes('column') &&
        columnError.message.includes('does not exist')
      ) {
        console.log('  ℹ Column does not exist yet (expected - migration needed)\n');
        console.log('📝 TO APPLY MIGRATION:');
        console.log('   1. Open your Supabase dashboard at: https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Navigate to "SQL Editor" in the left sidebar');
        console.log('   4. Click "New Query"');
        console.log('   5. Copy and paste the contents of this file:');
        console.log('      supabase/migrations/20251023000000_add_product_category.sql');
        console.log('   6. Click "Run" to execute the migration\n');

        // Show the SQL content
        const migrationPath = path.join(
          __dirname,
          'supabase',
          'migrations',
          '20251023000000_add_product_category.sql'
        );
        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('📄 Migration SQL Content:');
        console.log('─'.repeat(80));
        console.log(sql);
        console.log('─'.repeat(80));
      } else {
        console.error('❌ Unexpected error checking column:', columnError.message);
        process.exit(1);
      }
    } else {
      console.log('  ✓ product_category column already exists!');
      console.log('  ✓ Migration has already been applied.\n');

      // Show sample data
      const { data: sampleData } = await supabase
        .from('analyses')
        .select('id, product_name, product_category, category_rationale')
        .limit(3);

      if (sampleData && sampleData.length > 0) {
        console.log('📊 Sample data from analyses table:');
        sampleData.forEach((row) => {
          console.log(
            `  - ${row.product_name || 'Unnamed'}: category=${row.product_category || 'NULL'}`
          );
        });
      }
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testMigration();
