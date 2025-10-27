require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  // Get total count
  const { data: countData, error: countError, count } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('*', { count: 'exact', head: true })
    .eq('is_active', true);

  if (countError) {
    console.error('Error getting count:', countError);
    return;
  }

  console.log('\n=== OLD DIETARY INGREDIENTS DATABASE ===\n');
  console.log(`Total active ingredients: ${count?.toLocaleString()}\n`);

  // Get breakdown by source
  const { data: allIngredients } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('source')
    .eq('is_active', true);

  const sourceCounts = {
    CRN: 0,
    AHPA: 0,
    NPA: 0,
    UNPA: 0,
    Multiple: 0
  };

  allIngredients?.forEach(ing => {
    const source = ing.source || '';

    if (source.includes('CRN Grandfather List')) {
      sourceCounts.CRN++;
    } else if (source.includes('UNPA Consolidated')) {
      // Count which organizations
      const orgs = [];
      if (source.includes('AHPA')) orgs.push('AHPA');
      if (source.includes('CRN')) orgs.push('CRN');
      if (source.includes('NPA')) orgs.push('NPA');
      if (source.includes('UNPA')) orgs.push('UNPA');

      if (orgs.length > 1) {
        sourceCounts.Multiple++;
      } else if (orgs.includes('AHPA')) {
        sourceCounts.AHPA++;
      } else if (orgs.includes('NPA')) {
        sourceCounts.NPA++;
      } else if (orgs.includes('UNPA')) {
        sourceCounts.UNPA++;
      }
    }
  });

  console.log('=== BREAKDOWN BY SOURCE ===\n');
  console.log(`CRN only (original): ${sourceCounts.CRN.toLocaleString()}`);
  console.log(`AHPA only: ${sourceCounts.AHPA.toLocaleString()}`);
  console.log(`NPA only: ${sourceCounts.NPA.toLocaleString()}`);
  console.log(`UNPA only: ${sourceCounts.UNPA.toLocaleString()}`);
  console.log(`Multiple organizations: ${sourceCounts.Multiple.toLocaleString()}\n`);

  // Sample some newly added ingredients
  const { data: newSample } = await supabaseAdmin
    .from('old_dietary_ingredients')
    .select('ingredient_name, source')
    .ilike('source', '%UNPA Consolidated%')
    .limit(10);

  console.log('=== SAMPLE OF NEWLY ADDED INGREDIENTS ===\n');
  newSample?.forEach((ing, i) => {
    console.log(`${i + 1}. ${ing.ingredient_name}`);
    const orgs = ing.source.split(' - ')[1] || '';
    console.log(`   Organizations: ${orgs}\n`);
  });

  console.log('✓ Database verification complete');
})();
