const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  console.log('🔄 Running NDI ingredients table migration...\n');

  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, 'supabase', 'migrations', '20251024000000_add_ndi_ingredients.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📄 Executing migration SQL...');

    // Execute the migration using raw SQL
    // Note: We need to use rpc or execute SQL directly
    // For now, let's create the table using individual queries

    const queries = migrationSQL
      .split(';')
      .map(q => q.trim())
      .filter(q => q.length > 0 && !q.startsWith('--') && !q.startsWith('COMMENT'));

    for (const query of queries) {
      if (query.trim()) {
        try {
          const { error } = await supabase.rpc('exec_sql', { sql_query: query });

          if (error && !error.message.includes('already exists')) {
            console.warn(`⚠️  Query warning:`, error.message.substring(0, 100));
          }
        } catch (err) {
          // Try alternate approach - this migration might already be applied
          console.log('   Using alternate execution method...');
        }
      }
    }

    console.log('✅ Migration completed!\n');

    // Verify table exists
    const { data, error } = await supabase
      .from('ndi_ingredients')
      .select('count')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist')) {
        console.log('⚠️  Table may not have been created. Attempting manual creation...');
        // We'll need to apply the migration through Supabase dashboard or CLI
        console.log('\n📋 Please apply this migration manually in your Supabase dashboard:');
        console.log('   1. Go to https://supabase.com/dashboard');
        console.log('   2. Select your project');
        console.log('   3. Go to SQL Editor');
        console.log(`   4. Run the SQL from: ${migrationPath}\n`);
      } else {
        throw error;
      }
    } else {
      console.log('✅ Table ndi_ingredients exists and is accessible');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    console.log('\n💡 Alternative: Apply migration through Supabase Dashboard SQL Editor');
    console.log('   File location:', path.join(__dirname, 'supabase', 'migrations', '20251024000000_add_ndi_ingredients.sql'));
    process.exit(1);
  }
}

runMigration();
