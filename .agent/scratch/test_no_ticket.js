const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function findNextSeq() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const sc = createClient(url, key);

  // The DB trigger expects TIC-XXXX format (TIC-0027 would be next)
  // Try to insert WITHOUT ticket_no to see if trigger auto-generates
  const { data: cust } = await sc.from('customers').select('id, hospital_id').limit(1).single();
  
  console.log('Customer ID:', cust?.id);
  console.log('Trying insert WITHOUT ticket_no to let trigger work...');
  
  const { data, error } = await sc.from('tickets').insert([{
    customer_id: cust.id,
    hospital_id: cust.hospital_id,
    subject: 'Test no manual ticket_no',
    description: 'Testing trigger auto-generation',
    status: 'New',
    priority: 'Medium'
  }]).select();

  if (error) {
    console.error('ERROR (no ticket_no):', error.message);
    console.log('');
    console.log('Trying with explicitly empty ticket_no...');
    const { data: d2, error: e2 } = await sc.from('tickets').insert([{
      customer_id: cust.id,
      hospital_id: cust.hospital_id,
      subject: 'Test empty ticket_no',
      status: 'New',
      priority: 'Medium'
    }]).select();
    if (e2) console.error('ERROR (empty):', e2.message);
    else console.log('SUCCESS (no ticket_no):', d2[0].ticket_no);
  } else {
    console.log('SUCCESS! Auto-generated ticket_no:', data[0].ticket_no);
    await sc.from('tickets').delete().eq('id', data[0].id);
    console.log('Cleaned up.');
  }
}
findNextSeq();
