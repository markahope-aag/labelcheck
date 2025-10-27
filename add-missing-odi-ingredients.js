require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Ingredients to add based on earlier analysis
const missingIngredients = [
  {
    ingredient_name: '5-HTP',
    synonyms: ['5-hydroxytryptophan', '5-hydroxy-L-tryptophan', 'hydroxytryptophan'],
    source: 'Manual Addition - Common Pre-1994 Ingredient',
    notes: 'Dietary supplement ingredient marketed in the United States before October 15, 1994'
  },
  {
    ingredient_name: 'noni',
    synonyms: ['noni fruit', 'morinda citrifolia', 'indian mulberry'],
    source: 'Manual Addition - Common Pre-1994 Ingredient',
    notes: 'Dietary supplement ingredient marketed in the United States before October 15, 1994'
  },
  {
    ingredient_name: 'cellulose',
    synonyms: ['microcrystalline cellulose', 'powdered cellulose'],
    source: 'Manual Addition - Common Pre-1994 Ingredient',
    notes: 'Common excipient used in dietary supplements before October 15, 1994'
  },
  {
    ingredient_name: 'green tea extract',
    synonyms: ['green tea leaf extract', 'camellia sinensis extract'],
    source: 'Manual Addition - Common Pre-1994 Ingredient',
    notes: 'Dietary supplement ingredient marketed in the United States before October 15, 1994'
  },
];

async function addIngredients() {
  console.log('Adding missing old dietary ingredients...\n');

  for (const ingredient of missingIngredients) {
    // Check if already exists
    const { data: existing } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .select('id')
      .eq('ingredient_name', ingredient.ingredient_name)
      .maybeSingle();

    if (existing) {
      console.log(`✓ "${ingredient.ingredient_name}" already exists, skipping`);
      continue;
    }

    // Insert new ingredient
    const { data, error } = await supabaseAdmin
      .from('old_dietary_ingredients')
      .insert({
        ingredient_name: ingredient.ingredient_name,
        synonyms: ingredient.synonyms,
        source: ingredient.source,
        notes: ingredient.notes,
        is_active: true
      })
      .select();

    if (error) {
      console.error(`✗ Error adding "${ingredient.ingredient_name}":`, error.message);
    } else {
      console.log(`✓ Added "${ingredient.ingredient_name}" with ${ingredient.synonyms.length} synonyms`);
    }
  }

  // Verify total count
  const { count } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true });

  console.log(`\n✓ Total old dietary ingredients in database: ${count}`);
}

addIngredients().catch(console.error);
