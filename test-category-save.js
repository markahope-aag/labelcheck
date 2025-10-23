require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRecentAnalysis() {
  console.log('🔍 Checking most recent analysis for product category...\n');

  const { data, error } = await supabase
    .from('analyses')
    .select('id, analysis_result, product_category, category_rationale, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    console.error('❌ Error fetching analysis:', error.message);
    return;
  }

  if (!data) {
    console.log('⚠️  No analyses found');
    return;
  }

  const productName = data.analysis_result?.product_name || 'Unknown';

  console.log('📊 Most Recent Analysis:');
  console.log('  ID:', data.id);
  console.log('  Product:', productName);
  console.log('  Created:', new Date(data.created_at).toLocaleString());
  console.log('\n🏷️  Product Category:', data.product_category || '❌ NULL (not saved)');

  if (data.category_rationale) {
    console.log('\n📝 Category Rationale:');
    console.log('  ' + data.category_rationale);
  } else {
    console.log('\n📝 Category Rationale: ❌ NULL (not saved)');
  }

  if (data.product_category && data.category_rationale) {
    console.log('\n✅ SUCCESS: Product category data was saved correctly!');
  } else {
    console.log('\n❌ FAILURE: Product category data was NOT saved');
  }
}

checkRecentAnalysis();
