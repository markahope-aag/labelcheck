require('dotenv').config({ path: '.env.local' });

// Dynamically import the ES module
(async () => {
  const { checkGRASCompliance } = await import('./lib/gras-helpers.ts');

  const energyDrinkIngredients = [
    'Carbonated Water',
    'Citric Acid',
    'Erythritol',
    'Natural and Artificial Flavor',
    'Sucralose',
    'Sodium Benzoate',
    'Potassium Sorbate',
    'L-Carnitine Tartrate',
    'Taurine',
    'Caffeine',
    'Panax Ginseng Root Extract',
    'Guarana Seed Extract'
  ];

  console.log('Testing GRAS compliance for energy drink ingredients...\n');

  const result = await checkGRASCompliance(energyDrinkIngredients);

  console.log(`Total ingredients: ${result.totalIngredients}`);
  console.log(`GRAS compliant: ${result.grasCompliant}`);
  console.log(`Non-GRAS: ${result.nonGRASIngredients.length}\n`);

  console.log('Detailed Results:');
  console.log('================\n');

  for (const r of result.detailedResults) {
    if (r.isGRAS) {
      console.log(`✓ ${r.ingredient} - GRAS (${r.matchType} match: ${r.matchedEntry?.ingredient_name})`);
    } else {
      console.log(`✗ ${r.ingredient} - NOT GRAS`);
    }
  }

  if (result.nonGRASIngredients.length > 0) {
    console.log(`\n⚠️  Non-GRAS Ingredients:`);
    result.nonGRASIngredients.forEach(ing => console.log(`  - ${ing}`));
  } else {
    console.log('\n🎉 All ingredients are GRAS-compliant!');
  }
})();
