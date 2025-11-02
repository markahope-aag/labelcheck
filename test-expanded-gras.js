const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testExpandedGRAS() {
  console.log('🧪 Testing expanded GRAS database with real-world ingredients...\n');

  // Realistic ingredient lists from common food products
  const testProducts = [
    {
      name: 'Energy Drink',
      ingredients: [
        'Water',
        'Sugar',
        'Citric Acid',
        'Caffeine',
        'Taurine',
        'Niacin',
        'Vitamin B6',
        'Riboflavin',
      ],
    },
    {
      name: 'Protein Bar',
      ingredients: [
        'Whey Protein',
        'Soy Protein Isolate',
        'Maltitol',
        'Cocoa',
        'Natural Flavors',
        'Lecithin',
        'Stevia',
      ],
    },
    {
      name: 'Diet Soda',
      ingredients: [
        'Carbonated Water',
        'Aspartame',
        'Phosphoric Acid',
        'Potassium Benzoate',
        'Natural Flavors',
        'Caramel Color',
        'Caffeine',
      ],
    },
    {
      name: 'Yogurt',
      ingredients: [
        'Milk',
        'Sugar',
        'Pectin',
        'Natural Flavors',
        'Vitamin D',
        'Calcium Carbonate',
        'Lactose',
      ],
    },
    {
      name: 'Salad Dressing',
      ingredients: [
        'Soybean Oil',
        'Vinegar',
        'Egg Yolk',
        'Salt',
        'Sugar',
        'Xanthan Gum',
        'Calcium Disodium EDTA',
        'Natural Flavors',
      ],
    },
  ];

  for (const product of testProducts) {
    console.log(`\n📦 ${product.name}`);
    console.log(`   Ingredients: ${product.ingredients.join(', ')}`);
    console.log('   Results:');

    let grasCount = 0;
    let nonGRASCount = 0;

    for (const ingredient of product.ingredients) {
      const normalized = ingredient.toLowerCase().trim();

      // Strategy 1: Exact match
      const { data: exactMatch } = await supabase
        .from('gras_ingredients')
        .select('*')
        .eq('is_active', true)
        .ilike('ingredient_name', normalized)
        .maybeSingle();

      if (exactMatch) {
        console.log(
          `      ✅ ${ingredient} → ${exactMatch.ingredient_name} (${exactMatch.category})`
        );
        grasCount++;
        continue;
      }

      // Strategy 2: Synonym match
      const { data: allIngredients } = await supabase
        .from('gras_ingredients')
        .select('*')
        .eq('is_active', true)
        .not('synonyms', 'is', null);

      let found = false;
      if (allIngredients) {
        for (const ing of allIngredients) {
          if (ing.synonyms && ing.synonyms.some((syn) => syn.toLowerCase() === normalized)) {
            console.log(
              `      ✅ ${ingredient} → ${ing.ingredient_name} (synonym, ${ing.category})`
            );
            grasCount++;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        // Strategy 3: Fuzzy match
        const words = normalized.split(' ').filter((w) => w.length > 3);
        let fuzzyFound = false;

        for (const word of words) {
          const { data: fuzzyMatches } = await supabase
            .from('gras_ingredients')
            .select('*')
            .eq('is_active', true)
            .ilike('ingredient_name', `%${word}%`)
            .limit(1);

          if (fuzzyMatches && fuzzyMatches.length > 0) {
            console.log(
              `      🔍 ${ingredient} → ${fuzzyMatches[0].ingredient_name} (fuzzy match, ${fuzzyMatches[0].category})`
            );
            grasCount++;
            fuzzyFound = true;
            break;
          }
        }

        if (!fuzzyFound) {
          console.log(`      ❌ ${ingredient} → NOT in GRAS database`);
          nonGRASCount++;
        }
      }
    }

    console.log(`   Summary: ${grasCount} GRAS / ${nonGRASCount} Non-GRAS`);
  }

  console.log('\n\n📊 Database Statistics:');
  const { count: totalCount } = await supabase
    .from('gras_ingredients')
    .select('*', { count: 'exact', head: true });

  console.log(`   Total ingredients: ${totalCount}`);

  // Count by category
  const { data: categories } = await supabase.from('gras_ingredients').select('category');

  const categoryCounts = categories.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  console.log('\n   By category:');
  Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([cat, count]) => {
      console.log(`      ${cat}: ${count}`);
    });

  console.log('\n✅ Testing complete!');
}

testExpandedGRAS().catch(console.error);
