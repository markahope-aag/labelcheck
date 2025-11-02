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

async function importEAFUSData() {
  console.log('🚀 Starting EAFUS ingredient import...\n');

  try {
    // Load the converted JSON data
    const dataPath = path.join(__dirname, 'data', 'eafus-ingredients.json');

    if (!fs.existsSync(dataPath)) {
      console.error('❌ EAFUS JSON file not found!');
      console.error(`   Expected location: ${dataPath}`);
      console.error('\n📝 Please run the converter first:');
      console.error('   node convert-eafus-to-json.js\n');
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const ingredients = JSON.parse(rawData);

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
    console.log(`⏳ This may take several minutes for large datasets...\n`);

    // Import in batches of 100 (larger batches for faster import)
    const BATCH_SIZE = 100;
    let imported = 0;
    let failed = 0;
    const totalBatches = Math.ceil(newIngredients.length / BATCH_SIZE);

    for (let i = 0; i < newIngredients.length; i += BATCH_SIZE) {
      const batch = newIngredients.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;

      const { data, error } = await supabase.from('gras_ingredients').insert(batch).select();

      if (error) {
        console.error(`❌ Error importing batch ${batchNum}/${totalBatches}:`, error.message);
        failed += batch.length;
      } else {
        imported += data.length;
        if (batchNum % 5 === 0 || batchNum === totalBatches) {
          console.log(`✅ Progress: ${batchNum}/${totalBatches} batches (${imported} ingredients)`);
        }
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

    // Show category breakdown
    console.log('\n📊 Category Breakdown:');
    const { data: allIngredients } = await supabase.from('gras_ingredients').select('category');

    const categoryCounts = (allIngredients || []).reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15) // Top 15 categories
      .forEach(([cat, count]) => {
        console.log(`      ${cat}: ${count}`);
      });

    console.log('\n✅ EAFUS import completed successfully!');
    console.log('\n🎯 Your GRAS database now has comprehensive FDA coverage!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importEAFUSData();
