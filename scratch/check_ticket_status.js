const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
const envLocal = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = envLocal.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const supabaseUrl = urlMatch ? urlMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';
const supabaseAnonKey = keyMatch ? keyMatch[1].trim().replace(/^['"]|['"]$/g, '') : '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkTicket() {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('ticket_no', 'MAESOT-260529-4QDNRL')
    .maybeSingle();

  if (error) {
    console.error('Error fetching ticket:', error);
    return;
  }

  console.log('--- Ticket Data ---');
  console.log(ticket);

  if (ticket) {
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('current_ticket_id', ticket.id)
      .maybeSingle();

    if (convError) {
      console.error('Error fetching conversation:', convError);
    } else {
      console.log('--- Conversation Data ---');
      console.log(conversation);
    }
  }
}

checkTicket();
