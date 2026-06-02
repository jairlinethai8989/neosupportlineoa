const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envLocal = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function listCustomerTickets() {
  const customerId = '9926b7ae-55f3-4d25-800b-cf17d862ee2e';
  
  const { data: tickets, error } = await supabase
    .from('tickets')
    .select('id, ticket_no, subject, status, assigned_agent_id, created_at')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tickets:', error);
    return;
  }

  console.log('--- Tickets for jairlinethai ---');
  tickets.forEach(t => {
    console.log(`No: ${t.ticket_no} | Status: ${t.status} | Agent: ${t.assigned_agent_id} | Created: ${t.created_at} | ID: ${t.id}`);
  });

  const { data: conversations, error: convError } = await supabase
    .from('conversations')
    .select('id, current_ticket_id, status, last_message_at')
    .eq('customer_id', customerId);

  if (convError) {
    console.error('Error fetching conversations:', convError);
  } else {
    console.log('--- Conversations for jairlinethai ---');
    conversations.forEach(c => {
      console.log(`ID: ${c.id} | Status: ${c.status} | Ticket: ${c.current_ticket_id} | LastMsg: ${c.last_message_at}`);
    });
  }
}

listCustomerTickets();
