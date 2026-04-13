const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkFKs() {
  const { data, error } = await supabase.from('tickets').select('*').limit(1);
  if (error) console.error(error);
  
  // Try to use a very explicit join
  const { data: test, error: testErr } = await supabase
    .from('tickets')
    .select(`
      id,
      customer_id,
      customers!tickets_customer_id_fkey ( display_name )
    `)
    .limit(1);
  console.log('Test result:', test, testErr);
}
checkFKs();
