const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function testInsert() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const sc = createClient(url, key);

  // Get a real customer and hospital
  const { data: cust } = await sc.from('customers').select('id, hospital_id, hospitals(abbreviation)').limit(1).single();
  if (!cust) return console.log('No customer found.');

  const abbr = cust.hospitals?.abbreviation || 'NEO';
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '');
  const rand = Math.floor(100 + Math.random() * 899);
  const ticketNo = `${abbr}-${dateStr}-${timeStr}-${rand}`;

  console.log('Attempting insert with ticket_no:', ticketNo);

  const { data, error } = await sc.from('tickets').insert([{
    ticket_no: ticketNo,
    customer_id: cust.id,
    hospital_id: cust.hospital_id,
    subject: 'Test ticket creation',
    description: 'Test',
    status: 'New',
    priority: 'Medium'
  }]).select();

  if (error) {
    console.error('ERROR:', error.message);
    console.error('CODE:', error.code);
    console.error('DETAILS:', error.details);
    console.error('HINT:', error.hint);
  } else {
    console.log('SUCCESS! Ticket No:', data[0].ticket_no);
    // Cleanup
    await sc.from('tickets').delete().eq('id', data[0].id);
    console.log('Cleaned up test ticket.');
  }
}
testInsert();
