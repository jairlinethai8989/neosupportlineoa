const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectTickets() {
  const { data, error } = await supabase.from('tickets').select('*').limit(1);
  if (error) return console.error(error);
  console.log('--- Ticket Table Columns ---');
  console.log(Object.keys(data[0] || {}));
}

inspectTickets();
