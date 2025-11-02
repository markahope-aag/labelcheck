const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupDuplicateGRNs() {
  console.log('🧹 Cleaning up duplicate GRN numbers...\n');

  try {
    // Get all ingredients
    const { data: allIngredients, error } = await supabase.from('gras_ingredients').select('*');

    if (error) throw error;

    // Find duplicate GRNs
    const grnMap = new Map();
    allIngredients
      .filter((ing) => ing.gras_notice_number)
      .forEach((ing) => {
        const grn = ing.gras_notice_number.toUpperCase().trim();
        if (!grnMap.has(grn)) {
          grnMap.set(grn, []);
        }
        grnMap.get(grn).push(ing);
      });

    const duplicateGRNs = Array.from(grnMap.entries()).filter(([grn, ings]) => ings.length > 1);

    console.log(`Found ${duplicateGRNs.length} GRN numbers with duplicates\n`);

    // Strategy: Keep the most recent GRAS notice entry and remove placeholder/generic GRNs from older data
    let removed = 0;
    let updated = 0;

    for (const [grn, ings] of duplicateGRNs) {
      console.log(`\n🔍 Processing ${grn}:`);
      ings.forEach((ing, idx) => {
        console.log(`   ${idx + 1}. "${ing.ingredient_name}" (ID: ${ing.id})`);
      });

      // If it's a placeholder GRN like "000000", remove it from older entries
      if (grn === 'GRN 000000' || grn.match(/GRN 0{5,}/)) {
        console.log(`   → This is a placeholder GRN, clearing from all entries`);
        for (const ing of ings) {
          const { error: updateError } = await supabase
            .from('gras_ingredients')
            .update({ gras_notice_number: null })
            .eq('id', ing.id);

          if (updateError) {
            console.log(`   ❌ Error updating ${ing.ingredient_name}: ${updateError.message}`);
          } else {
            console.log(`   ✅ Cleared GRN from "${ing.ingredient_name}"`);
            updated++;
          }
        }
      }
      // For legitimate GRN conflicts, keep only the one from scraped data (most authoritative)
      // and clear from the comprehensive list entries
      else {
        // Sort by ID to keep newest (from scraping) and remove from comprehensive list
        const sortedIngs = [...ings].sort((a, b) => b.id.localeCompare(a.id));
        const toKeep = sortedIngs[0];
        const toUpdate = sortedIngs.slice(1);

        console.log(`   → Keeping GRN for "${toKeep.ingredient_name}"`);
        console.log(`   → Clearing GRN from ${toUpdate.length} other entries`);

        for (const ing of toUpdate) {
          const { error: updateError } = await supabase
            .from('gras_ingredients')
            .update({ gras_notice_number: null })
            .eq('id', ing.id);

          if (updateError) {
            console.log(`   ❌ Error updating ${ing.ingredient_name}: ${updateError.message}`);
          } else {
            console.log(`   ✅ Cleared GRN from "${ing.ingredient_name}"`);
            updated++;
          }
        }
      }
    }

    console.log(`\n\n📊 Cleanup Summary:`);
    console.log(`   ✅ Updated ${updated} ingredients (cleared conflicting GRNs)`);
    console.log(`   🔍 Re-run audit to verify cleanup\n`);
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupDuplicateGRNs();
