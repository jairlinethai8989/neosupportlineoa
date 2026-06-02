const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  console.error("Missing credentials in env production local");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceRoleKey);

const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';

async function run() {
  console.log("Subscribing to realtime updates using ANON client...");

  const channel = anonClient
    .channel('test-realtime-tickets')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tickets',
      filter: `id=eq.${ticketId}`
    }, (payload) => {
      console.log("\n[Realtime Event Received]");
      console.log("Payload Event Type:", payload.eventType);
      console.log("Payload Old Row:", payload.old);
      console.log("Payload New Row:", payload.new);
      
      // Cleanup and exit
      anonClient.removeChannel(channel);
      process.exit(0);
    })
    .subscribe((status) => {
      console.log("Realtime subscription status:", status);
      
      if (status === 'SUBSCRIBED') {
        console.log("Subscribed! Now triggering a status update from admin client...");
        
        // Let's toggle the status or update description slightly to trigger an update
        setTimeout(async () => {
          console.log("Sending update...");
          const { data, error } = await adminClient
            .from('tickets')
            .update({ description: 'Testing realtime updates at ' + new Date().toISOString() })
            .eq('id', ticketId)
            .select();
            
          if (error) {
            console.error("Admin update error:", error);
          } else {
            console.log("Admin update success, rows updated:", data.length);
          }
        }, 1500);
      }
    });

  // Keep process alive for a bit
  setTimeout(() => {
    console.log("Timeout reached, exiting.");
    anonClient.removeChannel(channel);
    process.exit(0);
  }, 10000);
}

run();
