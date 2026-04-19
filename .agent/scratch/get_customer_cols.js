
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function getAllColumns() {
  const table = 'customers';
  // Try to get one row and its keys
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (data && data.length > 0) {
    console.log(`## ${table} (with keys)`);
    console.log(Object.keys(data[0]).join(', '));
  } else {
    // If no data, we might not see columns unless we have an RPC.
    // Let's try to fetch a known non-existent row and see if it returns metadata (it doesn't in JS client)
    console.log(`## ${table} (no data)`);
  }
}

getAllColumns();
