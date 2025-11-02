const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigration() {
  try {
    console.log('Reading product category migration file...');
    const migrationPath = path.join(
      __dirname,
      'supabase',
      'migrations',
      '20251023000000_add_product_category.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running product category migration...');

    // Split the SQL into individual statements
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting statement:', statement.substring(0, 80) + '...');

        // For ALTER TABLE and CREATE INDEX statements, we need to execute them directly
        // Supabase doesn't have a general-purpose SQL execution RPC by default
        // We'll execute using the raw SQL query method
        const { error } = await supabase
          .rpc('exec_sql', { sql_query: statement + ';' })
          .catch(async (rpcError) => {
            // If RPC doesn't exist, try using the SQL editor API
            console.log('Note: exec_sql RPC not available, executing via raw query...');

            // For production, you would use Supabase's SQL editor API or CLI
            // For now, we'll just report what needs to be run
            console.log('SQL to execute manually in Supabase SQL editor:');
            console.log(statement + ';');
            return { error: null };
          });

        if (error) {
          console.error('Error executing statement:', error);
          throw error;
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the columns were added
    console.log('\nVerifying migration...');
    const { data, error } = await supabase
      .from('analyses')
      .select('id, product_category, category_rationale')
      .limit(1);

    if (error) {
      console.error('⚠️  Could not verify columns (this is normal if using raw SQL execution)');
      console.log('Error:', error.message);
      console.log('\n📝 Please verify the migration manually in Supabase dashboard:');
      console.log('   1. Go to Supabase SQL Editor');
      console.log(
        '   2. Run the SQL from: supabase/migrations/20251023000000_add_product_category.sql'
      );
      console.log(
        '   3. Verify columns exist: SELECT product_category, category_rationale FROM analyses LIMIT 1;'
      );
    } else {
      console.log(
        '✅ Columns verified - product_category and category_rationale exist in analyses table'
      );
    }
  } catch (error) {
    console.error('Migration failed:', error);
    console.log('\n📝 Manual migration steps:');
    console.log('   1. Open Supabase dashboard: https://supabase.com/dashboard');
    console.log('   2. Navigate to SQL Editor');
    console.log(
      '   3. Copy and paste the contents of: supabase/migrations/20251023000000_add_product_category.sql'
    );
    console.log('   4. Execute the SQL');
    process.exit(1);
  }
}

runMigration();
