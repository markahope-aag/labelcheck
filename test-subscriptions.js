const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf8');
envContent.split('\n').forEach((line) => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    process.env[match[1]] = match[2];
  }
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  console.log('Checking subscriptions...\n');

  const { data, error } = await supabase
    .from('subscriptions')
    .select(
      `
      *,
      users (
        id,
        email,
        clerk_user_id
      )
    `
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error:', error);
  } else {
    console.log('Found', data.length, 'subscriptions:');
    console.log(JSON.stringify(data, null, 2));
  }

  process.exit(0);
}

check();
