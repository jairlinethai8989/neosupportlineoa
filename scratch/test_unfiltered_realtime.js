const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing credentials");
  process.exit(1);
}

const anonClient = createClient(supabaseUrl, anonKey);

async function run() {
  console.log("Subscribing to UNFILTERED realtime updates for tickets...");

  const channel = anonClient
    .channel('test-unfiltered-channel')
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'tickets'
    }, (payload) => {
      console.log("Received update payload:", payload.new.id, payload.new.status);
    })
    .subscribe((status, err) => {
      console.log("Subscription status:", status, err ? err : '');
      if (status === 'CHANNEL_ERROR') {
        console.error("Failed to subscribe (CHANNEL_ERROR)!");
        process.exit(1);
      }
      if (status === 'SUBSCRIBED') {
        console.log("Successfully subscribed to unfiltered updates!");
        setTimeout(() => {
          anonClient.removeChannel(channel);
          process.exit(0);
        }, 3000);
      }
    });
}

run();
