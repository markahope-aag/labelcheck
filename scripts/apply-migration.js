/**
 * Apply database migration using Supabase Admin client
 *
 * Usage: node scripts/apply-migration.js <migration-file-name>
 * Example: node scripts/apply-migration.js 20251031000000_fix_public_share_security.sql
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseServiceKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration(migrationFileName) {
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFileName);

  console.log(`📄 Reading migration: ${migrationFileName}`);

  if (!fs.existsSync(migrationPath)) {
    console.error(`❌ Migration file not found: ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log(`📝 Migration content (${sql.length} characters):`);
  console.log('---');
  console.log(sql.substring(0, 500) + (sql.length > 500 ? '...' : ''));
  console.log('---\n');

  console.log('🚀 Applying migration...');

  try {
    // Execute the SQL using Supabase's RPC function
    // Note: This requires the migration SQL to be valid PostgreSQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });

    if (error) {
      // If exec_sql doesn't exist, try direct query
      if (error.message.includes('function') && error.message.includes('does not exist')) {
        console.log('📌 exec_sql RPC not available, trying direct query...');

        // Split SQL into individual statements
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          // Skip comments
          if (statement.startsWith('/*') || statement.startsWith('--')) {
            continue;
          }

          console.log(`  ➤ Executing statement: ${statement.substring(0, 80)}...`);

          const { error: stmtError } = await supabase.rpc('exec', {
            query: statement,
          });

          if (stmtError) {
            console.error(`❌ Error executing statement:`, stmtError);
            throw stmtError;
          }
        }

        console.log('✅ Migration applied successfully (via direct statements)!');
        return;
      }

      throw error;
    }

    console.log('✅ Migration applied successfully!');

    if (data) {
      console.log('📊 Result:', data);
    }
  } catch (err) {
    console.error('❌ Failed to apply migration:', err);
    console.error('\n⚠️  Manual application required. Please run this SQL in Supabase Dashboard:');
    console.error('   Dashboard → SQL Editor → New Query → Paste the SQL above\n');
    process.exit(1);
  }
}

// Get migration file name from command line args
const migrationFile = process.argv[2];

if (!migrationFile) {
  console.error('❌ Usage: node scripts/apply-migration.js <migration-file-name>');
  console.error(
    '   Example: node scripts/apply-migration.js 20251031000000_fix_public_share_security.sql'
  );
  process.exit(1);
}

// Run migration
applyMigration(migrationFile)
  .then(() => {
    console.log('🎉 Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥 Unexpected error:', err);
    process.exit(1);
  });
