const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data, error } = await supabase
    .from('tickets')
    .select(`
      *,
      customers (*),
      assigned_agent:profiles!assigned_agent_id(*)
    `)
    .limit(1);
  console.log('Error:', error);
  console.log('Data:', data ? data.length : null);
}
run();
