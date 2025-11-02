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
    console.log('Loading ingredients from grandfather-ingredients.json...');
    const ingredientsJson = fs.readFileSync('grandfather-ingredients.json', 'utf8');
    const ingredients = JSON.parse(ingredientsJson);

    console.log(`Found ${ingredients.length} ingredients to import`);

    // Prepare data for insertion
    const records = ingredients.map((name) => ({
      ingredient_name: name,
      source: 'CRN Grandfather List (September 1998)',
      notes: 'Dietary ingredient marketed in the United States before October 15, 1994',
      is_active: true,
    }));

    console.log('\nInserting ingredients into Supabase...');
    console.log('(This may take a few moments)');

    // Insert in batches of 100 to avoid timeouts
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ingredients)...`);

      const { data, error } = await supabaseAdmin.from('old_dietary_ingredients').upsert(batch, {
        onConflict: 'ingredient_name',
        ignoreDuplicates: false, // Update existing records
      });

      if (error) {
        console.error(`Error in batch ${batchNum}:`, error.message);
        errorCount += batch.length;
      } else {
        successCount += batch.length;
        console.log(`✓ Batch ${batchNum} completed`);
      }
    }

    console.log('\n=== IMPORT COMPLETE ===');
    console.log(`Successfully imported: ${successCount} ingredients`);
    if (errorCount > 0) {
      console.log(`Errors: ${errorCount} ingredients`);
    }

    // Verify count in database
    const { count, error: countError } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`\nTotal ingredients in database: ${count}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
