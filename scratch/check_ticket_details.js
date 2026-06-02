const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  console.log("Fetching ticket details for MAESOT-260530-EGKJOK...");
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_no', 'MAESOT-260530-EGKJOK')
    .maybeSingle();

  if (error) {
    console.error("Error fetching ticket:", error);
    process.exit(1);
  }

  if (!data) {
    console.log("Ticket not found!");
  } else {
    console.log("Ticket details:");
    console.log("- ID:", data.id);
    console.log("- Status:", data.status);
    console.log("- Assigned Agent ID:", data.assigned_agent_id);
    console.log("- Assigned Team ID:", data.assigned_team_id);
  }
}

run();
