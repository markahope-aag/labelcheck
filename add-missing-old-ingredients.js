require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addMissingIngredients() {
  const missingIngredients = [
    {
      ingredient_name: 'cordyceps',
      synonyms: ['cordyceps extract', 'cordyceps sinensis', 'cordyceps militaris'],
      source: 'Traditional Chinese Medicine - Pre-1994',
      is_active: true
    },
  ];

  console.log('=== ADDING MISSING OLD DIETARY INGREDIENTS ===\n');

  for (const ingredient of missingIngredients) {
    console.log(`Adding: ${ingredient.ingredient_name}`);

    const { data, error } = await supabase
      .from('old_dietary_ingredients')
      .insert(ingredient)
      .select();

    if (error) {
      console.error(`Error adding ${ingredient.ingredient_name}:`, error.message);
    } else {
      console.log(`✅ Successfully added ${ingredient.ingredient_name}`);
      console.log(`   Synonyms: ${ingredient.synonyms.join(', ')}`);
    }
  }

  // Update existing ingredients to add extract synonyms
  console.log('\n=== UPDATING EXISTING INGREDIENTS WITH EXTRACT SYNONYMS ===\n');

  const updates = [
    { search: 'fenugreek seeds', new_synonyms: ['fenugreek seed extract', 'fenugreek extract'] },
    { search: 'guarana', new_synonyms: ['guarana extract', 'guarana seed extract'] },
    { search: 'maca', new_synonyms: ['maca extract', 'maca root extract', 'lepidium meyenii'] },
  ];

  for (const update of updates) {
    // Get existing record
    const { data: existing } = await supabase
      .from('old_dietary_ingredients')
      .select('id, ingredient_name, synonyms')
      .eq('ingredient_name', update.search)
      .single();

    if (!existing) {
      console.log(`⚠️ Not found: ${update.search}`);
      continue;
    }

    // Merge new synonyms with existing
    const currentSynonyms = existing.synonyms || [];
    const mergedSynonyms = [...new Set([...currentSynonyms, ...update.new_synonyms])];

    // Update
    const { error: updateError } = await supabase
      .from('old_dietary_ingredients')
      .update({ synonyms: mergedSynonyms })
      .eq('id', existing.id);

    if (updateError) {
      console.error(`Error updating ${update.search}:`, updateError.message);
    } else {
      console.log(`✅ Updated ${update.search} with ${update.new_synonyms.length} new synonyms`);
      console.log(`   New synonyms: ${update.new_synonyms.join(', ')}`);
    }
  }

  console.log('\n=== COMPLETE ===');
}

addMissingIngredients().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
