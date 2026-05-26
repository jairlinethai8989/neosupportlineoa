const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load env from .env.production.local
const envFile = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="(.+)"/) || envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/) || envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Failed to parse .env.production.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim().replace(/"/g, '');
const supabaseKey = keyMatch[1].trim().replace(/"/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Fetching functions...');
  // We can query functions using PostgREST from pg_catalog or by calling an RPC if exists
  // Or we can try to call a nonexistent function to see if it lists or we can try a basic query
  // Let's run a query to fetch functions using the supabase client
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_start_date: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
    p_end_date: new Date().toISOString()
  });
  console.log('get_dashboard_summary Test Output:', data ? 'Success' : 'Failed', error);
}

run();
