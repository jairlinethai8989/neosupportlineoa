const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function check() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const urlMatches = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
  const keyMatches = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);
  
  const url = urlMatches[1].trim();
  const key = keyMatches[1].trim();
  
  const supabase = createClient(url, key);
  const { data } = await supabase.from('tickets').select().limit(1);
  if (data && data.length > 0) {
    console.log('TICKET_COLUMNS:', Object.keys(data[0]));
  }
}
check();
