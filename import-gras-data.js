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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function importGRASData() {
  console.log('🚀 Starting GRAS ingredient import...\n');

  try {
    // Load both datasets
    const commonPath = path.join(__dirname, 'data', 'gras-common-ingredients.json');
    const comprehensivePath = path.join(__dirname, 'data', 'gras-comprehensive.json');

    let ingredients = [];

    // Load common ingredients if file exists
    if (fs.existsSync(commonPath)) {
      const commonData = fs.readFileSync(commonPath, 'utf8');
      ingredients = ingredients.concat(JSON.parse(commonData));
    }

    // Load comprehensive ingredients if file exists
    if (fs.existsSync(comprehensivePath)) {
      const comprehensiveData = fs.readFileSync(comprehensivePath, 'utf8');
      ingredients = ingredients.concat(JSON.parse(comprehensiveData));
    }

    if (ingredients.length === 0) {
      console.error('❌ No ingredient data files found!');
      process.exit(1);
    }

    console.log(`📦 Loaded ${ingredients.length} ingredients from file\n`);

    // Check for existing ingredients to avoid duplicates
    console.log('🔍 Checking for existing ingredients...');
    const { data: existing, error: checkError } = await supabase
      .from('gras_ingredients')
      .select('ingredient_name');

    if (checkError) {
      console.error('❌ Error checking existing ingredients:', checkError);
      throw checkError;
    }

    const existingNames = new Set((existing || []).map((i) => i.ingredient_name.toLowerCase()));
    console.log(`   Found ${existingNames.size} existing ingredients in database\n`);

    // Filter out duplicates
    const newIngredients = ingredients.filter(
      (ing) => !existingNames.has(ing.ingredient_name.toLowerCase())
    );

    if (newIngredients.length === 0) {
      console.log('✅ All ingredients already exist in database!');
      console.log(`📊 Total ingredients in database: ${existingNames.size}`);
      return;
    }

    console.log(`📝 Importing ${newIngredients.length} new ingredients...\n`);

    // Import in batches of 50
    const BATCH_SIZE = 50;
    let imported = 0;
    let failed = 0;

    for (let i = 0; i < newIngredients.length; i += BATCH_SIZE) {
      const batch = newIngredients.slice(i, i + BATCH_SIZE);

      const { data, error } = await supabase.from('gras_ingredients').insert(batch).select();

      if (error) {
        console.error(`❌ Error importing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        failed += batch.length;
      } else {
        imported += data.length;
        console.log(
          `✅ Imported batch ${Math.floor(i / BATCH_SIZE) + 1}: ${data.length} ingredients`
        );
      }
    }

    console.log('\n📊 Import Summary:');
    console.log(`   ✅ Successfully imported: ${imported}`);
    if (failed > 0) {
      console.log(`   ❌ Failed: ${failed}`);
    }

    // Get final count
    const { count } = await supabase
      .from('gras_ingredients')
      .select('*', { count: 'exact', head: true });

    console.log(`   📦 Total ingredients now in database: ${count}`);

    // Show some sample ingredients
    console.log('\n📋 Sample ingredients:');
    const { data: samples } = await supabase
      .from('gras_ingredients')
      .select('ingredient_name, category, synonyms')
      .limit(5)
      .order('ingredient_name');

    samples.forEach((ing) => {
      console.log(`   • ${ing.ingredient_name} (${ing.category})`);
      if (ing.synonyms && ing.synonyms.length > 0) {
        console.log(`     Synonyms: ${ing.synonyms.join(', ')}`);
      }
    });

    console.log('\n✅ GRAS import completed successfully!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importGRASData();
