const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Searching for all tickets with subject 'แจ้งปัญหาระบบใช้ไม่ได้'...");

  const { data: tickets, error: tErr } = await supabase
    .from('tickets')
    .select('*, customer:customers!fk_tickets_customer(*)')
    .ilike('subject', '%แจ้งปัญหาระบบใช้ไม่ได้%')
    .order('created_at', { ascending: false });

  if (tErr) {
    console.error("Error fetching tickets:", tErr);
    return;
  }

  console.log(`Found ${tickets.length} tickets:`);
  tickets.forEach(t => {
    console.log(`- #${t.ticket_no} | ID: ${t.id} | Status: "${t.status}" | Customer: "${t.customer?.display_name}" (${t.customer?.line_user_id}) | Agent: "${t.assigned_agent_id}" | Created: ${t.created_at}`);
  });
}

run();
