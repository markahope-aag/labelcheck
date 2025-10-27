require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Extract ingredients from UNPA PDF text (pages 77-96, approximately lines 5400-6756)
const fullText = fs.readFileSync('new-odi-pdf-raw.txt', 'utf8');
const lines = fullText.split('\n');

// Pages 77-96 of a 96-page document with 6756 lines
// Approximately 70 lines per page, so page 77 starts around line 5400
const startLine = 5400;
const endLine = 6756;

const ingredientLines = lines.slice(startLine, endLine);

// Parse ingredient names from the list
// Format: "ingredient name" followed by symbols: + (AHPA), ~ (CRN), # (NNFA/NPA), * (UNPA)
const ingredients = new Set();

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

  // Remove symbols at the end: +, ~, #, *, and combinations
  let ingredient = trimmed.replace(/[\+~#\*\s]+$/, '');

  // Skip if empty after cleanup
  if (!ingredient || ingredient.length < 2) continue;

  // Clean up common formatting issues
  ingredient = ingredient
    .replace(/\s+/g, ' ')  // normalize whitespace
    .replace(/\([^)]*\)/g, match => match.toLowerCase())  // lowercase scientific names in parens
    .trim();

  // Skip if starts with a number (likely a page number or footnote)
  if (/^\d/.test(ingredient)) continue;

  // Add to set (lowercase for comparison)
  ingredients.add(ingredient.toLowerCase());
}

console.log(`\n=== EXTRACTED ${ingredients.size} UNIQUE INGREDIENTS FROM UNPA PDF ===\n`);

// Compare against existing database
(async () => {
  try {
    // Fetch all current old dietary ingredients
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

    // Find new ingredients not in database
    const newIngredients = [];
    const duplicates = [];

    for (const ingredient of ingredients) {
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

      if (found) {
        duplicates.push(ingredient);
      } else {
        newIngredients.push(ingredient);
      }
    }

    console.log('=== COMPARISON RESULTS ===\n');
    console.log(`Total extracted: ${ingredients.size}`);
    console.log(`Already in database: ${duplicates.length} (${((duplicates.length/ingredients.size)*100).toFixed(1)}%)`);
    console.log(`New/unique: ${newIngredients.length} (${((newIngredients.length/ingredients.size)*100).toFixed(1)}%)\n`);

    if (newIngredients.length > 0) {
      console.log('=== SAMPLE OF NEW INGREDIENTS (first 50) ===\n');
      newIngredients.slice(0, 50).forEach((ing, i) => {
        console.log(`${i + 1}. ${ing}`);
      });

      // Save all new ingredients to file
      fs.writeFileSync(
        'unpa-new-ingredients.json',
        JSON.stringify(newIngredients.sort(), null, 2),
        'utf8'
      );
      console.log(`\n✓ All ${newIngredients.length} new ingredients saved to: unpa-new-ingredients.json`);
    } else {
      console.log('✓ No new ingredients found - UNPA list is already fully covered by current database');
    }

    // Save extraction stats
    const stats = {
      total_extracted: ingredients.size,
      already_in_db: duplicates.length,
      new_unique: newIngredients.length,
      coverage_percentage: ((duplicates.length/ingredients.size)*100).toFixed(1),
      recommendation: newIngredients.length > 100
        ? 'Significant new ingredients found - recommend adding to database'
        : newIngredients.length > 20
        ? 'Moderate new ingredients - review and consider adding'
        : 'Minimal new ingredients - current CRN database provides good coverage'
    };

    fs.writeFileSync(
      'unpa-analysis-stats.json',
      JSON.stringify(stats, null, 2),
      'utf8'
    );

    console.log('\n=== RECOMMENDATION ===');
    console.log(stats.recommendation);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
})();
