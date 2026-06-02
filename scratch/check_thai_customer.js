const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking specific ticket 'MAESOT-260529-4QDNRL'...");

  const { data: specTicket, error: sErr } = await supabase
    .from('tickets')
    .select('*, customer:customers!fk_tickets_customer(*), agent:profiles!assigned_agent_id(*)')
    .eq('ticket_no', 'MAESOT-260529-4QDNRL')
    .maybeSingle();

  if (sErr) {
    console.error("Error getting specific ticket:", sErr);
  } else {
    console.log("\nSpecific Ticket Details:");
    console.log("- ID:", specTicket?.id);
    console.log("- Ticket No:", specTicket?.ticket_no);
    console.log("- Subject:", specTicket?.subject);
    console.log("- Status:", specTicket?.status);
    console.log("- Customer ID:", specTicket?.customer_id);
    console.log("- Customer Display Name:", specTicket?.customer?.display_name);
    console.log("- Customer Line User ID:", specTicket?.customer?.line_user_id);
    console.log("- Assigned Agent ID:", specTicket?.assigned_agent_id);
    console.log("- Assigned Agent Name:", specTicket?.agent?.full_name);
    console.log("- Created At:", specTicket?.created_at);
  }
}

run();
