const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCustomerData() {
  const { data, error } = await supabase.from('customers').select('*');
  if (error) return console.error(error);

  console.log(`Total customers: ${data.length}`);
  const missingHosp = data.filter(c => !c.hospital_id).length;
  const missingDept = data.filter(c => !c.department_id).length;
  const missingPos = data.filter(c => !c.position_id).length;

  console.log(`Customers missing hospital_id: ${missingHosp}`);
  console.log(`Customers missing department_id: ${missingDept}`);
  console.log(`Customers missing position_id: ${missingPos}`);
}

checkCustomerData();
