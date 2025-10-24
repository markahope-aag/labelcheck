require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Symbol mapping from UNPA PDF
// + = AHPA (American Herbal Products Association)
// ~ = CRN (Council for Responsible Nutrition)
// # = NNFA/NPA (National Nutritional Foods Association / Natural Products Association)
// * = UNPA (United Natural Products Alliance)

function parseIngredientSources(line) {
  const sources = [];

  if (line.includes('+')) sources.push('AHPA');
  if (line.includes('~')) sources.push('CRN');
  if (line.includes('#')) sources.push('NPA');
  if (line.includes('*')) sources.push('UNPA');

  return sources;
}

// Extract ingredients from UNPA PDF text (pages 77-96)
const fullText = fs.readFileSync('new-odi-pdf-raw.txt', 'utf8');
const lines = fullText.split('\n');

const startLine = 5400;
const endLine = 6756;
const ingredientLines = lines.slice(startLine, endLine);

// Parse ingredients with source attribution
const ingredientsMap = new Map(); // ingredient_name -> sources[]

for (const line of ingredientLines) {
  const trimmed = line.trim();

  // Skip empty lines, copyright lines, headers
  if (!trimmed ||
      trimmed.includes('©') ||
      trimmed.includes('UNITED') ||
      trimmed.includes('NATURAL') ||
      trimmed.includes('PRODUCTS') ||
      trimmed.includes('ALLIANCE') ||
      trimmed.includes('OLDDIETARYINGREDIENTLIST') ||
      trimmed.includes('AHPA') ||
      trimmed.includes('CRN') ||
      trimmed.includes('NNFA') ||
      trimmed.includes('NPA') ||
      trimmed.includes('UNPA') ||
      trimmed.length < 3) {
    continue;
  }

  // Extract sources before removing symbols
  const sources = parseIngredientSources(trimmed);

  // Remove symbols at the end
  let ingredient = trimmed.replace(/[\+~#\*\s]+$/, '');

  // Skip if empty after cleanup
  if (!ingredient || ingredient.length < 2) continue;

  // Clean up formatting
  ingredient = ingredient
    .replace(/\s+/g, ' ')
    .replace(/\([^)]*\)/g, match => match.toLowerCase())
    .trim();

  // Skip if starts with a number
  if (/^\d/.test(ingredient)) continue;

  // Store with sources
  const key = ingredient.toLowerCase();
  if (!ingredientsMap.has(key)) {
    ingredientsMap.set(key, sources);
  } else {
    // Merge sources if ingredient appears multiple times
    const existing = ingredientsMap.get(key);
    const merged = [...new Set([...existing, ...sources])];
    ingredientsMap.set(key, merged);
  }
}

console.log(`\n=== EXTRACTED ${ingredientsMap.size} UNIQUE INGREDIENTS WITH SOURCES ===\n`);

// Load existing database ingredients
(async () => {
  try {
    const { data: currentIngredients, error } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('ingredient_name')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching current ingredients:', error);
      return;
    }

    const currentSet = new Set(currentIngredients.map(i => i.ingredient_name.toLowerCase()));
    console.log(`Current database: ${currentSet.size} ingredients\n`);

    // Filter to only new ingredients
    const newIngredients = [];

    for (const [ingredient, sources] of ingredientsMap.entries()) {
      let found = false;

      // Check exact match
      if (currentSet.has(ingredient)) {
        found = true;
      } else {
        // Check partial match
        for (const dbIngredient of currentSet) {
          if (ingredient.includes(dbIngredient) || dbIngredient.includes(ingredient)) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        newIngredients.push({
          ingredient_name: ingredient,
          sources: sources,
        });
      }
    }

    console.log(`New ingredients to add: ${newIngredients.length}\n`);

    if (newIngredients.length === 0) {
      console.log('✓ No new ingredients to add');
      return;
    }

    // Prepare records for database insertion
    const records = newIngredients.map(item => ({
      ingredient_name: item.ingredient_name,
      source: `UNPA Consolidated ODI List (1999) - ${item.sources.join(', ')}`,
      notes: `Dietary ingredient marketed before October 15, 1994. From: ${item.sources.join(', ')}`,
      is_active: true
    }));

    console.log('=== SAMPLE OF INGREDIENTS TO ADD (first 20) ===\n');
    records.slice(0, 20).forEach((rec, i) => {
      console.log(`${i + 1}. ${rec.ingredient_name}`);
      console.log(`   Source: ${rec.source}\n`);
    });

    console.log('\n=== INSERTING INGREDIENTS INTO DATABASE ===\n');

    // Insert in batches of 100
    const batchSize = 100;
    let totalInserted = 0;

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(records.length / batchSize);

      console.log(`Processing batch ${batchNum}/${totalBatches} (${batch.length} ingredients)...`);

      const { data, error } = await supabaseAdmin
        .from('old_dietary_ingredients')
        .upsert(batch, {
          onConflict: 'ingredient_name',
          ignoreDuplicates: false
        });

      if (error) {
        console.error(`❌ Error inserting batch ${batchNum}:`, error.message);
        continue;
      }

      totalInserted += batch.length;
      console.log(`✓ Batch ${batchNum} completed\n`);
    }

    console.log('\n=== INSERTION COMPLETE ===');
    console.log(`Total ingredients added: ${totalInserted}`);

    // Verify final count
    const { data: finalCount, error: countError } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (!countError) {
      console.log(`Final database size: ${finalCount} active ingredients`);
    }

    console.log('\n✓ UNPA ingredients successfully added to database');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
