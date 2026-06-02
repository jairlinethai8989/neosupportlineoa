const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ticketId = 'dcd027b3-49e8-491f-aea8-df90d5b24a8c';
  console.log(`Checking details and logs for ticket ${ticketId}...`);

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .single();

  if (tErr) {
    console.error("Error fetching ticket:", tErr);
    return;
  }

  console.log("Ticket Status:", ticket.status);
  console.log("Assigned Agent ID:", ticket.assigned_agent_id);

  const { data: logs, error: lErr } = await supabase
    .from('ticket_logs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (lErr) {
    console.error("Error fetching logs:", lErr);
    return;
  }

  console.log(`Found ${logs.length} logs:`);
  logs.forEach(l => {
    console.log(`- Action: "${l.action_type}" | From: "${l.from_status}" | To: "${l.to_status}" | Created: ${l.created_at} | Actor: ${l.performed_by}`);
  });
}

run();
