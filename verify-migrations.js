const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyMigrations() {
  console.log('🔍 Verifying Database Migrations...\n');

  const requiredColumns = {
    'Phase 1': ['product_category', 'category_rationale'],
    'Phase 1.5': [
      'category_confidence',
      'is_category_ambiguous',
      'alternative_categories',
      'user_selected_category',
      'category_selection_reason',
      'compared_categories',
    ],
  };

  let allPresent = true;

  for (const [phase, columns] of Object.entries(requiredColumns)) {
    console.log(`📋 ${phase} Columns:`);

    for (const column of columns) {
      try {
        const { error } = await supabase.from('analyses').select(column).limit(1);

        if (error) {
          if (error.message.includes('column') && error.message.includes('does not exist')) {
            console.log(`  ❌ ${column} - NOT FOUND`);
            allPresent = false;
          } else {
            console.log(`  ⚠️  ${column} - Error: ${error.message}`);
            allPresent = false;
          }
        } else {
          console.log(`  ✅ ${column}`);
        }
      } catch (err) {
        console.log(`  ❌ ${column} - Error checking column`);
        allPresent = false;
      }
    }
    console.log('');
  }

  if (allPresent) {
    console.log('✅ All migrations applied successfully!\n');
    console.log('You can now proceed with frontend integration.\n');
  } else {
    console.log('❌ Some migrations are missing.\n');
    console.log('📝 TO APPLY MIGRATIONS:\n');
    console.log('1. Open Supabase dashboard: https://supabase.com/dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Run these files in order:');
    console.log('   a) supabase/migrations/20251023000000_add_product_category.sql');
    console.log('   b) supabase/migrations/20251023130000_add_category_guidance.sql\n');
  }
}

verifyMigrations();
