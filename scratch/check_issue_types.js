const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.production.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.production.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying ticket_issue_types...');
  const { data, error } = await supabase.from('ticket_issue_types').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('ticket_issue_types table contents:', data);
  }

  console.log('Querying ticket_modules...');
  const { data: mData, error: mErr } = await supabase.from('ticket_modules').select('*');
  if (mErr) {
    console.error('Error:', mErr);
  } else {
    console.log('ticket_modules table contents:', mData);
  }
}
run();
