const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  const fromIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const toIso = new Date().toISOString();
  console.log(`Querying get_dashboard_summary from ${fromIso} to ${toIso}...`);
  const { data, error } = await supabase.rpc('get_dashboard_summary', {
    p_start_date: fromIso,
    p_end_date: toIso,
    p_organization_id: null,
    p_module: null,
    p_issue_type: null
  });

  if (error) {
    console.error('RPC Error:', error);
  } else {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    console.log('RPC Data keys:', Object.keys(parsed));
    console.log('organizationData:', parsed.organizationData);
    console.log('hospitalData:', parsed.hospitalData);
  }
}

testRpc();
