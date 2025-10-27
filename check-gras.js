require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const vitaminsToCheck = [
  'NICOTINAMIDE',
  'NIACIN',
  'VITAMIN B3',
  'CALCIUM D-PANTOTHENATE',
  'PANTOTHENIC ACID',
  'PYRIDOXINE HYDROCHLORIDE',
  'VITAMIN B6',
  'THIAMINE MONONITRATE',
  'VITAMIN B1',
  'CHOLECALCIFEROL',
  'VITAMIN D3',
  'METHYLCOBALAMIN',
  'VITAMIN B12',
  'COFFEE',
  'GREEN TEA'
];

(async () => {
  for (const vitamin of vitaminsToCheck) {
    const { data, error } = await supabase
      .from('gras_ingredients')
      .select('ingredient_name, gras_notice_number, category, synonyms')
      .or(`ingredient_name.ilike.%${vitamin}%,synonyms.cs.{${vitamin}}`)
      .limit(5);

    if (error) {
      console.log(`Error searching for ${vitamin}:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`\n✅ FOUND "${vitamin}":`);
      data.forEach(d => console.log(`   - ${d.ingredient_name} (${d.gras_notice_number || 'N/A'})`));
    } else {
      console.log(`\n❌ NOT FOUND: "${vitamin}"`);
    }
  }
})();
