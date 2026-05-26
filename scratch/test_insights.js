const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Testing Top Hospitals...');
  const { data: hospData, error: hospErr } = await supabase
    .from('tickets')
    .select('hospital_id, hospitals(name)');
  
  if (hospErr) {
    console.error('Hospital query error:', hospErr);
  } else {
    console.log('Hospital query success, count:', hospData?.length);
    console.log('First 3 records:', hospData?.slice(0, 3));
  }

  console.log('\nTesting Issue Types...');
  const { data: issueData, error: issueErr } = await supabase
    .from('tickets')
    .select('issue_type');

  if (issueErr) {
    console.error('Issue query error:', issueErr);
  } else {
    console.log('Issue query success, count:', issueData?.length);
    console.log('First 3 records:', issueData?.slice(0, 3));
  }

  console.log('\nTesting Top Staff...');
  const { data: staffData, error: staffErr } = await supabase
    .from('tickets')
    .select('customer_id, customers!tickets_customer_id_fkey(display_name, hospitals(name))');

  if (staffErr) {
    console.error('Staff query error:', staffErr);
  } else {
    console.log('Staff query success, count:', staffData?.length);
    console.log('First record customers:', JSON.stringify(staffData?.[0]?.customers, null, 2));
  }
}

test();
