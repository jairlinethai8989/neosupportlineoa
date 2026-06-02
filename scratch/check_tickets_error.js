const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const ticketWorkspaceTicketSelect = `
  id,
  ticket_no,
  customer_id,
  subject,
  description,
  status,
  priority,
  created_at,
  module,
  issue_type,
  organizations!tickets_organization_id_fkey (id, name),
  customers!tickets_customer_id_fkey (id, display_name),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name, theme_color)
`;

async function runQuery() {
  console.log('Querying tickets with ticketWorkspaceTicketSelect...');
  const { data, error } = await supabase
    .from('tickets')
    .select(ticketWorkspaceTicketSelect)
    .limit(5);

  if (error) {
    console.error('ERROR running query:', error);
  } else {
    console.log('SUCCESS! Retrieved tickets:', data.length);
  }
}

runQuery();
