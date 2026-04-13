const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const supabase = createClient(url, key);

  console.log('Fetching hospitals...');
  const { data: hospitals } = await supabase.from('hospitals').select('*');
  console.log('HOSPITALS:', JSON.stringify(hospitals, null, 2));
}
check();
