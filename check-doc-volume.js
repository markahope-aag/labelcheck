require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

(async () => {
  const { data } = await supabase
    .from('regulatory_documents')
    .select('title, content, is_active')
    .eq('is_active', true);

  console.log('Active Documents:', data?.length || 0);
  console.log('');

  let totalChars = 0;
  data?.forEach((doc) => {
    const len = doc.content?.length || 0;
    totalChars += len;
    console.log(`- ${doc.title}: ${len.toLocaleString()} chars`);
  });

  const estimatedTokens = Math.round(totalChars / 4);
  console.log('');
  console.log(`Total: ${totalChars.toLocaleString()} characters`);
  console.log(`Estimated: ~${estimatedTokens.toLocaleString()} tokens`);
  console.log('');
  console.log('Claude 3.5 Sonnet context window: 200,000 tokens');
  console.log(`Current usage: ${((estimatedTokens / 200000) * 100).toFixed(1)}% of context window`);
})();
