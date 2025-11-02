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

// Simple CSV parser (handles quoted fields with commas)
function parseCSV(text) {
  const lines = text.split('\n');
  const result = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Push the last field
    fields.push(current.trim());

    result.push(fields);
  }

  return result;
}

// Parse date in M/D/YYYY format
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;

  const month = parts[0].padStart(2, '0');
  const day = parts[1].padStart(2, '0');
  const year = parts[2];

  return `${year}-${month}-${day}`;
}

async function importNDIDatabase() {
  console.log('🧪 Importing NDI Database...\n');

  try {
    // Read CSV file
    const csvPath = path.join(__dirname, 'data', 'ndi-database.csv');
    console.log(`📂 Reading CSV file: ${csvPath}`);

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const rows = parseCSV(csvContent);

    console.log(`✅ Parsed ${rows.length} rows from CSV\n`);

    // Skip header row
    const header = rows[0];
    const dataRows = rows.slice(1);

    console.log('📋 CSV Columns:');
    header.forEach((col, idx) => console.log(`   ${idx}: ${col}`));
    console.log('');

    // Check if table exists and has data
    const { count: existingCount } = await supabase
      .from('ndi_ingredients')
      .select('*', { count: 'exact', head: true });

    if (existingCount && existingCount > 0) {
      console.log(`⚠️  Table already has ${existingCount} records`);
      console.log('   Delete existing records? (This script will clear and reimport)');

      // Clear existing data
      console.log('🗑️  Clearing existing NDI data...');
      const { error: deleteError } = await supabase
        .from('ndi_ingredients')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (deleteError) {
        console.error('❌ Error clearing table:', deleteError);
        throw deleteError;
      }
      console.log('✅ Cleared existing data\n');
    }

    // Prepare data for insert
    const ndiIngredients = [];
    const seenNotificationNumbers = new Set();
    let skipped = 0;
    let duplicates = 0;

    for (const row of dataRows) {
      const notificationNumber = parseInt(row[0]);
      const reportNumber = row[1];
      const ingredientName = row[2];
      const firm = row[3];
      const submissionDate = parseDate(row[4]);
      const fdaResponseDate = parseDate(row[5]);

      // Skip rows with invalid notification numbers or missing ingredient names
      if (isNaN(notificationNumber) || !ingredientName || ingredientName.trim() === '') {
        skipped++;
        continue;
      }

      // Skip duplicate notification numbers (keep first occurrence)
      if (seenNotificationNumbers.has(notificationNumber)) {
        console.log(
          `   ⚠️  Skipping duplicate notification #${notificationNumber}: ${ingredientName}`
        );
        duplicates++;
        continue;
      }

      seenNotificationNumbers.add(notificationNumber);

      ndiIngredients.push({
        notification_number: notificationNumber,
        report_number: reportNumber || null,
        ingredient_name: ingredientName,
        firm: firm || null,
        submission_date: submissionDate,
        fda_response_date: fdaResponseDate,
      });
    }

    console.log(
      `📊 Processing ${ndiIngredients.length} NDI entries (skipped ${skipped} invalid rows, ${duplicates} duplicates)`
    );

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;

    for (let i = 0; i < ndiIngredients.length; i += batchSize) {
      const batch = ndiIngredients.slice(i, i + batchSize);

      const { error: insertError } = await supabase.from('ndi_ingredients').insert(batch);

      if (insertError) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, insertError);
        throw insertError;
      }

      inserted += batch.length;
      console.log(
        `   ✅ Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${ndiIngredients.length})`
      );
    }

    console.log(`\n✅ Successfully imported ${inserted} NDI ingredients!`);

    // Verify import
    const { count: finalCount } = await supabase
      .from('ndi_ingredients')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📊 Final database count: ${finalCount} NDI ingredients`);

    // Show some sample entries
    const { data: samples } = await supabase
      .from('ndi_ingredients')
      .select('*')
      .order('notification_number')
      .limit(5);

    console.log('\n📋 Sample entries:');
    samples?.forEach((s) => {
      console.log(
        `   #${s.notification_number}: ${s.ingredient_name} (${s.firm || 'Unknown firm'})`
      );
    });
  } catch (error) {
    console.error('\n❌ Import failed:', error);
    process.exit(1);
  }
}

importNDIDatabase();
