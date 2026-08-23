const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!key) {
  console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function run() {
  try {
    const { data, error } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    if (error) {
      console.error('Error fetching company settings:', error);
      process.exit(1);
    }
    if (!data) {
      console.log('No company settings found.');
      process.exit(0);
    }
    console.log('Company Settings columns (keys):', Object.keys(data));
    console.log('Company Settings values:', data);
    process.exit(0);
  } catch (err) {
    console.error('Execution error:', err);
    process.exit(1);
  }
}

run();
