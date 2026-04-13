const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testInsert() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/URL=(.*)/)[1].trim();
  const key = env.match(/KEY=(.*)/)[1].trim();
  const sc = createClient(url, key);

  const testId = `SUPER-UNIQUE-${Date.now()}`;
  console.log(`Testing insert with ticket_no: ${testId}`);
  
  const { data, error } = await supabase.from('tickets').insert([{
    ticket_no: testId,
    subject: 'Test Overwrite',
    status: 'New',
    priority: 'Low',
    customer_id: 'd9e0b1c0-0000-0000-0000-000000000000'
  }]).select();

  if (error) {
    console.error('Insert Error:', error.message);
  } else {
    console.log('Resulting ticket_no:', data[0].ticket_no);
    if (data[0].ticket_no === testId) {
      console.log('STAYED: The manual ID was preserved.');
    } else {
      console.log('OVERWRITTEN: The DB trigger replaced it with:', data[0].ticket_no);
    }
  }
}
// testInsert();
