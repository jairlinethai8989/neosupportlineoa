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

// Ticket ID for MAESOT-260530-EGKJOK
const ticketId = 'dcd027b3-49e8-491f-aea8-df90d5b24a8c';

async function run() {
  console.log(`Subscribing to tickets UPDATE realtime updates via ANON client for ticket: ${ticketId}...`);

  const channel = anonClient
    .channel('test-tickets-channel')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tickets',
      filter: `id=eq.${ticketId}`
    }, (payload) => {
      console.log("\n[Realtime Event Received]");
      console.log("New Status:", payload.new.status);
      console.log("New Assigned Agent ID:", payload.new.assigned_agent_id);
      
      anonClient.removeChannel(channel);
      process.exit(0);
    })
    .subscribe((status, error) => {
      console.log("Subscription status:", status, error || "");
      if (status === 'SUBSCRIBED') {
        console.log("Subscribed! Now sending a test update from admin client...");
        
        setTimeout(async () => {
          console.log("Updating ticket description to trigger update...");
          const { data, error } = await adminClient
            .from('tickets')
            .update({ description: 'Test update at ' + new Date().toISOString() })
            .eq('id', ticketId)
            .select();
            
          if (error) {
            console.error("Admin update error:", error);
          } else {
            console.log("Ticket updated successfully by admin:", data[0]?.id);
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
