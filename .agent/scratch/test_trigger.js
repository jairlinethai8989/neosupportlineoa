const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testInsert() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const supabase = createClient(url, key);

  console.log('Testing insert WITHOUT ticket_no...');
  const { data, error } = await supabase.from('tickets').insert([{
    subject: 'Test Insert Trigger',
    priority: 'Low',
    status: 'New',
    customer_id: 'd9e0b1c0-0000-0000-0000-000000000000' // Use a fake or existing ID if possible
  }]).select();

  if (error) {
    console.error('Insert failed:', error.message);
  } else {
    console.log('Insert success! Generated Ticket No:', data[0].ticket_no);
  }
}
testInsert();
