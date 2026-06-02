const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Listing all customers and their active tickets...");

  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .or('display_name.ilike.%jairlinethai%,line_user_id.ilike.%jairlinethai%');

  if (cErr) {
    console.error("Error fetching customers:", cErr);
    return;
  }

  console.log(`Found ${customers.length} customers.`);
  for (const c of customers) {
    console.log(`\nCustomer ID: ${c.id}`);
    console.log(`Display Name: ${c.display_name}`);
    console.log(`Line User ID: ${c.line_user_id}`);

    const { data: tickets, error: tErr } = await supabase
      .from('tickets')
      .select('id, ticket_no, subject, status, assigned_agent_id, created_at')
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false });

    if (tErr) {
      console.error(`Error fetching tickets for ${c.id}:`, tErr);
      continue;
    }

    console.log(`Tickets (${tickets.length}):`);
    const active = tickets.filter(t => !['resolved', 'closed', 'canceled'].includes(t.status.toLowerCase()));
    console.log("Active tickets:");
    active.forEach(t => {
      console.log(`  - #${t.ticket_no} | ${t.id} | Subject: "${t.subject}" | Status: "${t.status}" | Agent: "${t.assigned_agent_id}" | Created: ${t.created_at}`);
    });
    
    const resolved = tickets.filter(t => ['resolved', 'closed', 'canceled'].includes(t.status.toLowerCase())).slice(0, 3);
    console.log("Recent Resolved/Closed tickets (last 3):");
    resolved.forEach(t => {
      console.log(`  - #${t.ticket_no} | ${t.id} | Subject: "${t.subject}" | Status: "${t.status}" | Agent: "${t.assigned_agent_id}" | Created: ${t.created_at}`);
    });
  }
}

run();
