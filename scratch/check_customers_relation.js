const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      display_name,
      organizations!customers_organization_id_fkey (id, name)
    `)
    .limit(1);

  if (error) {
    console.error('Failed with customers_organization_id_fkey:', error.message);
  } else {
    console.log('SUCCESS with customers_organization_id_fkey! Data:', data);
  }
}

async function testCustomersOldHint() {
  const { data, error } = await supabase
    .from('customers')
    .select(`
      id,
      display_name,
      organizations!customers_hospital_id_fkey (id, name)
    `)
    .limit(1);

  if (error) {
    console.error('Failed with customers_hospital_id_fkey:', error.message);
  } else {
    console.log('SUCCESS with customers_hospital_id_fkey! Data:', data);
  }
}

async function main() {
  await testCustomers();
  await testCustomersOldHint();
}

main();
