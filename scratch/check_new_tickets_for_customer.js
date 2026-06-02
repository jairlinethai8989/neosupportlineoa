const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const customerId = '9926b7ae-55f3-4d25-800b-cf17d862ee2e';
  console.log(`Checking all tickets with status 'New' or 'new' for customer ${customerId}...`);

  const { data: tickets, error: tErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('customer_id', customerId)
    .ilike('status', 'new')
    .order('created_at', { ascending: false });

  if (tErr) {
    console.error("Error fetching tickets:", tErr);
    return;
  }

  console.log(`Found ${tickets.length} new tickets:`);
  tickets.forEach(t => {
    console.log(`- #${t.ticket_no} | ID: ${t.id} | Subject: "${t.subject}" | Status: "${t.status}" | Agent: "${t.assigned_agent_id}" | Created: ${t.created_at}`);
  });
}

run();
