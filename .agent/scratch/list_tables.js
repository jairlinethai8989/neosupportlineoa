
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
  // PostgREST doesn't directly support listing tables, but we can query the internal metadata via RPC if available 
  // or just try to query known tables.
  
  const knownTables = ['profiles', 'tickets', 'messages', 'conversations', 'customers', 'hospitals', 'departments', 'positions', 'sla_rules', 'csat_surveys', 'teams', 'ticket_logs', 'system_logs', 'company_settings'];
  
  for (const table of knownTables) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (!error) {
      console.log(`✅ Table exists: ${table}`);
    } else {
      console.log(`❌ Table missing or error: ${table} (${error.message})`);
    }
  }
}

listTables();
