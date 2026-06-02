const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

const conversationId = '957ec98b-8b1e-4ce7-a6ca-dd52c86ac4b5';
const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';

async function run() {
  console.log(`Subscribing to messages INSERT realtime updates via ANON client with filter ticket_id=eq.${ticketId}...`);

  const channel = anonClient
    .channel('test-filtered-msg-channel')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `ticket_id=eq.${ticketId}`
    }, (payload) => {
      console.log("\n[Realtime Event Received]");
      console.log("New Message Content:", payload.new.content);
      console.log("New Message Ticket ID:", payload.new.ticket_id);
      
      anonClient.removeChannel(channel);
      process.exit(0);
    })
    .subscribe((status, error) => {
      console.log("Subscription status:", status, error || "");
      if (status === 'SUBSCRIBED') {
        console.log("Subscribed! Now sending a test message from admin client...");
        
        setTimeout(async () => {
          const { data: profiles } = await adminClient
            .from('profiles')
            .select('id')
            .eq('role', 'Agent')
            .limit(1);

          const staffId = profiles[0].id;
          console.log("Inserting message...");
          const { data, error } = await adminClient
            .from('messages')
            .insert([{
              conversation_id: conversationId,
              ticket_id: ticketId,
              sender_type: 'agent',
              content: 'Filtered test message ' + new Date().toISOString(),
              message_type: 'text',
              staff_id: staffId
            }])
            .select();
            
          if (error) {
            console.error("Admin insert error:", error);
          } else {
            console.log("Message inserted successfully by admin:", data[0]?.id);
          }
        }, 1500);
      }
    });

  setTimeout(() => {
    console.log("Timeout reached. No event received.");
    anonClient.removeChannel(channel);
    process.exit(0);
  }, 10000);
}

run();
