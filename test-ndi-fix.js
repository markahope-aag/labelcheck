require('dotenv').config({ path: '.env.local' });
const { checkNDICompliance } = require('./lib/ndi-helpers');

const testIngredients = [
  'Calcium (Carbonate)',
  'Magnesium (Oxide)',
  'Royal Jelly',
  'Coenzyme Q10',
  'Caffeine',
  'Green Tea Extract (Leaf)',
  '5-HTP',
  'Noni (Root)',
];

async function test() {
  console.log('Testing NDI compliance check with supabaseAdmin...\n');

  const result = await checkNDICompliance(testIngredients);

  console.log('Summary:', result.summary);
  console.log('\nDetailed Results:');
  result.results.forEach((r) => {
    console.log(`\n${r.ingredient}:`);
    console.log(`  Has NDI: ${r.hasNDI}`);
    console.log(`  Requires NDI: ${r.requiresNDI}`);
    console.log(`  Note: ${r.complianceNote.substring(0, 100)}...`);
  });
}

test().catch(console.error);
