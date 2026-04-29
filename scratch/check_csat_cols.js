const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkColumns() {
  const { data, error } = await supabase.rpc('get_table_columns', { table_name: 'csat_surveys' });
  if (error) {
    // If RPC doesn't exist, try a simple select
    const { data: sample, error: selectError } = await supabase.from('csat_surveys').select('*').limit(1);
    if (selectError) {
      console.error('Error:', selectError);
    } else {
      console.log('Columns found in sample:', Object.keys(sample[0] || {}));
    }
  } else {
    console.log('Columns:', data);
  }
}

checkColumns();
