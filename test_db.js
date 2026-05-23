const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data: cData } = await supabase.from('company_settings').select('id, modules, issue_types');
  console.log('company_settings:', cData);

  const { data: iData } = await supabase.from('ticket_issue_types').select('*');
  console.log('ticket_issue_types:', iData);

  const { data: mData } = await supabase.from('ticket_modules').select('*');
  console.log('ticket_modules:', mData);
}
check();
