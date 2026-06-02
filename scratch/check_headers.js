const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !anonKey) {
  console.error("Missing credentials");
  process.exit(1);
}

async function run() {
  const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';
  const url = `${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}&select=*,assigned_agent:profiles!assigned_agent_id(*)`;

  console.log("Fetching ticket via HTTP fetch directly to inspect headers...");
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'apikey': anonKey,
      'Authorization': `Bearer ${anonKey}`
    }
  });

  console.log("Response Status:", response.status);
  console.log("Response Headers:");
  for (const [key, value] of response.headers.entries()) {
    console.log(`- ${key}: ${value}`);
  }
}

run();
