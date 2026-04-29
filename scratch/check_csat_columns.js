const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCSAT() {
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'csat_surveys' });
  
  if (error) {
    // If RPC doesn't exist, try a simple select
    console.log('RPC failed, trying select...');
    const { data: sample, error: selectError } = await supabase.from('csat_surveys').select('*').limit(1);
    if (selectError) {
      console.error('Select failed:', selectError);
    } else {
      console.log('Sample row columns:', Object.keys(sample[0] || {}));
    }
  } else {
    console.log('Table columns:', data);
  }
}

checkCSAT();
