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

async function importGRASNotices() {
  console.log('🚀 Starting GRAS Notice import...\n');

  try {
    // Load the scraped JSON data
    const dataPath = path.join(__dirname, 'data', 'gras-notices-scraped.json');

    if (!fs.existsSync(dataPath)) {
      console.error('❌ GRAS notices JSON file not found!');
      console.error(`   Expected location: ${dataPath}`);
      console.error('\n📝 Please run the scraper first:');
      console.error('   node scrape-gras-notices.js\n');
      process.exit(1);
    }

    const rawData = fs.readFileSync(dataPath, 'utf8');
    const allIngredients = JSON.parse(rawData);

    console.log(`📦 Loaded ${allIngredients.length} total entries from file`);

    // Deduplicate by GRN number
    const uniqueMap = new Map();
    allIngredients.forEach((ing) => {
      const key = ing.gras_notice_number;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, ing);
      }
    });

    const ingredients = Array.from(uniqueMap.values());
    console.log(`🔍 After deduplication: ${ingredients.length} unique GRAS notices\n`);

    // Check for existing ingredients to avoid duplicates
    console.log('🔍 Checking for existing ingredients...');
    const { data: existing, error: checkError } = await supabase
      .from('gras_ingredients')
      .select('ingredient_name, gras_notice_number');

    if (checkError) {
      console.error('❌ Error checking existing ingredients:', checkError);
      throw checkError;
    }

    const existingGRNs = new Set(
      (existing || [])
        .filter((i) => i.gras_notice_number)
        .map((i) => i.gras_notice_number.toUpperCase())
    );

    console.log(`   Found ${existingGRNs.size} existing GRAS notices in database\n`);

    // Filter out duplicates
    const newIngredients = ingredients.filter(
      (ing) => !existingGRNs.has(ing.gras_notice_number.toUpperCase())
    );

    if (newIngredients.length === 0) {
      console.log('✅ All GRAS notices already exist in database!');
      console.log(`📊 Total GRAS notices in database: ${existingGRNs.size}`);
      return;
    }

    console.log(`📝 Importing ${newIngredients.length} new GRAS notices...\n`);
    console.log(`⏳ This may take a few minutes...\n`);

    // Import in batches of 100
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

    // Show GRAS status breakdown
    console.log('\n📊 GRAS Status Breakdown:');
    const { data: allIngredients2 } = await supabase.from('gras_ingredients').select('gras_status');

    const statusCounts = (allIngredients2 || []).reduce((acc, item) => {
      acc[item.gras_status] = (acc[item.gras_status] || 0) + 1;
      return acc;
    }, {});

    Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([status, count]) => {
        console.log(`      ${status}: ${count}`);
      });

    console.log('\n✅ GRAS Notice import completed successfully!');
    console.log('\n🎯 Your database now includes comprehensive FDA GRAS Notice coverage!');
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

// Run the import
importGRASNotices();
