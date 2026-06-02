const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from .env.production.local
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.production.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking remote database tickets...");

  // Find customer by line_user_id (or similar) or display name
  const { data: customers, error: cErr } = await supabase
    .from('customers')
    .select('*')
    .limit(10);
  
  if (cErr) {
    console.error("Error fetching customers:", cErr);
    return;
  }
  
  console.log("Customers in DB:", customers.map(c => ({ id: c.id, line_user_id: c.line_user_id, display_name: c.display_name })));

  // Find tickets for the customer 'jairlinethai' or similar
  const thaiCustomer = customers.find(c => String(c.display_name).toLowerCase().includes('thai') || String(c.line_user_id).toLowerCase().includes('thai'));
  console.log("Thai Customer found:", thaiCustomer);

  if (thaiCustomer) {
    const { data: tickets, error: tErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('customer_id', thaiCustomer.id)
      .order('created_at', { ascending: false });

    if (tErr) {
      console.error("Error fetching tickets:", tErr);
      return;
    }

    console.log("Tickets for customer:", tickets.map(t => ({
      id: t.id,
      ticket_no: t.ticket_no,
      subject: t.subject,
      status: t.status,
      assigned_agent_id: t.assigned_agent_id,
      created_at: t.created_at
    })));
  }

  // Also query tickets containing '#MAESOT-260529-4QDNRL'
  const { data: searchTickets, error: sErr } = await supabase
    .from('tickets')
    .select('*')
    .ilike('ticket_no', '%4QDNRL%');

  if (sErr) {
    console.error("Error searching tickets by no:", sErr);
  } else {
    console.log("Search tickets by ticket_no pattern:", searchTickets.map(t => ({
      id: t.id,
      ticket_no: t.ticket_no,
      subject: t.subject,
      status: t.status,
      assigned_agent_id: t.assigned_agent_id,
      created_at: t.created_at
    })));
  }
}

run();
