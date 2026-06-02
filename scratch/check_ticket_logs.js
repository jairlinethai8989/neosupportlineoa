const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';
  console.log(`Checking logs for ticket ${ticketId}...`);

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
