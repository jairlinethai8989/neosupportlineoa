const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Searching for the exact ticket matching the messages in the customer's chat screen...");

  const { data: messages, error: mErr } = await supabase
    .from('messages')
    .select('*, ticket:tickets!fk_messages_ticket(*)')
    .or('content.ilike.%ขอทราบเลข AN%,content.ilike.%รีเฟรช แล้วตรวจสอบ%');

  if (mErr) {
    console.error("Error searching messages:", mErr);
    return;
  }

  console.log(`Found ${messages.length} messages matching search criteria.`);
  messages.forEach(m => {
    console.log(`\nMessage ID: ${m.id}`);
    console.log(`Content: "${m.content}"`);
    console.log(`Ticket ID: ${m.ticket_id}`);
    console.log(`Conversation ID: ${m.conversation_id}`);
    console.log(`Ticket details:`, m.ticket ? {
      ticket_no: m.ticket.ticket_no,
      status: m.ticket.status,
      assigned_agent_id: m.ticket.assigned_agent_id
    } : 'None');
  });
}

run();
