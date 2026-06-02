const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';
  console.log(`Running query matching src/app/portal/tickets/[id]/page.tsx for ticket ID: ${ticketId}`);

  // We'll run the exact query used in the page:
  const { data: ticketData, error: e1 } = await supabase
    .from('tickets')
    .select(`*, assigned_agent:profiles!assigned_agent_id(*)`)
    .eq('id', ticketId)
    .maybeSingle();

  if (e1) {
    console.error("Query Error:", e1);
  } else {
    console.log("Query Result:");
    console.log("- Status:", ticketData?.status);
    console.log("- Assigned Agent ID:", ticketData?.assigned_agent_id);
    console.log("- Assigned Agent Profile:", ticketData?.assigned_agent);
    
    // Check if the anon client can read profiles or if RLS blocks it!
    console.log("\nTesting with ANON key...");
    const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: anonTicket, error: anonErr } = await anonClient
      .from('tickets')
      .select(`*, assigned_agent:profiles!assigned_agent_id(*)`)
      .eq('id', ticketId)
      .maybeSingle();

    if (anonErr) {
      console.error("Anon Query Error:", anonErr);
    } else {
      console.log("Anon Query Result:");
      console.log("- Status:", anonTicket?.status);
      console.log("- Assigned Agent ID:", anonTicket?.assigned_agent_id);
      console.log("- Assigned Agent Profile:", anonTicket?.assigned_agent);
    }
  }
}

run();
