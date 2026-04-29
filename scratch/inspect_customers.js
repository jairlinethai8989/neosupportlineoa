const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectCustomers() {
  const { data: cols, error: colError } = await supabase.from('customers').select('*').limit(1);
  if (colError) return console.error('Error fetching customers:', colError);

  console.log('--- Customer Table Columns ---');
  console.log(Object.keys(cols[0] || {}));

  const { data: sample, error: sampleError } = await supabase.from('customers').select(`
    id,
    display_name,
    department,
    department_id,
    position,
    position_id,
    hospital_id
  `).limit(5);

  if (sampleError) return console.error('Error fetching sample:', sampleError);
  console.log('--- Sample Data ---');
  console.table(sample);
}

inspectCustomers();
