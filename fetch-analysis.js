require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', 'aa78c97e-f081-4e0b-9570-7ace0a026ea1')
    .single();

  if (error) {
    console.log('Error:', JSON.stringify(error, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
})();
