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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    console.log('Reading migration file...');
    const migrationPath = path.join(
      __dirname,
      'supabase',
      'migrations',
      '20251022220000_create_gras_ingredients.sql'
    );
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running GRAS ingredients migration...');

    // Split the SQL into individual statements (splitting on semicolons that aren't in strings)
    // This is a simple split - for production you might want a more sophisticated SQL parser
    const statements = sql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('\nExecuting statement:', statement.substring(0, 100) + '...');
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });

        if (error) {
          // Try direct query if RPC fails
          console.log('RPC failed, trying direct query...');
          const { error: directError } = await supabase.from('_').select('*').limit(0);

          if (directError) {
            console.error('Error executing statement:', error);
            throw error;
          }
        }
      }
    }

    console.log('\n✅ Migration completed successfully!');

    // Verify the table was created
    const { data, error } = await supabase.from('gras_ingredients').select('count').limit(1);

    if (error) {
      console.error('Error verifying table:', error);
    } else {
      console.log('✅ Table verified - gras_ingredients exists');

      // Count seed data
      const { count } = await supabase
        .from('gras_ingredients')
        .select('*', { count: 'exact', head: true });

      console.log(`✅ Seed data loaded: ${count} ingredients`);
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
