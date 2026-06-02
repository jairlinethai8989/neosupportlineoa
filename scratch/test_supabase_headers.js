const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function run() {
  const ticketId = '2df64ff6-b6b7-49a6-a09e-0187adbb43a4';
  
  console.log("Initializing Supabase client with Cache-Control headers...");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    }
  });
  
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', ticketId)
    .maybeSingle();
    
  if (error) {
    console.error("Query failed:", error);
  } else {
    console.log("Query succeeded! Status:", data?.status);
  }
}

run();
