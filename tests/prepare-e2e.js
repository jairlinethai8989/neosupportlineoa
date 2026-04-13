const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function prepare() {
  console.log('--- Preparing E2E Test Data ---');

  // 1. Get first hospital
  const { data: hospitals } = await supabase.from('hospitals').select('id').limit(1);
  if (!hospitals || hospitals.length === 0) {
    console.error('No hospital found. Please run seed_master.ts first.');
    process.exit(1);
  }
  const hospitalId = hospitals[0].id;

  // 2. Ensure Test Customer exists
  const TEST_LINE_ID = 'U_E2E_TEST_999';
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('line_user_id', TEST_LINE_ID)
    .maybeSingle();

  if (!customer) {
    console.log('Creating test customer...');
    const { error } = await supabase.from('customers').insert([{
      line_user_id: TEST_LINE_ID,
      display_name: 'E2E Test Customer',
      hospital_id: hospitalId,
      is_active: true
    }]);
    if (error) console.error('Error creating customer:', error);
    else console.log('Test customer created.');
  } else {
    console.log('Test customer already exists.');
  }

  console.log('Preparation complete.');
}

prepare();
