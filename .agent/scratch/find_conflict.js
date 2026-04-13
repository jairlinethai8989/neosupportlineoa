const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function findConflict() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const sc = createClient(url, key);

  // The trigger generates TIC-XXXX. What is next in sequence?
  // Tickets are TIC-0001 through TIC-0026. Let's check TIC-0027 specifically
  const nextNos = ['TIC-0027', 'TIC-0028', 'TIC-0029', 'TIC-0030'];
  for (const no of nextNos) {
    const { data } = await sc.from('tickets').select('id').eq('ticket_no', no).limit(1);
    console.log(`${no} exists: ${data && data.length > 0}`);
  }

  // Try insert completely bypassing ticket_no by using a unique nano ID
  const { data: cust } = await sc.from('customers').select('id, hospital_id').limit(1).single();
  
  const nano = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
  console.log('\nInserting with nano ID (completely unique):', nano);
  
  const { data, error } = await sc.from('tickets').insert([{
    ticket_no: nano,
    customer_id: cust.id,
    hospital_id: cust.hospital_id,
    subject: 'Debug test',
    description: 'Debug',
    status: 'New',
    priority: 'Medium'
  }]).select('ticket_no');

  if (error) {
    console.error('STILL FAILS:', error.message);
    console.error('This means the DB TRIGGER is ignoring our ticket_no and generating TIC-XXXX which conflicts.');
    console.error('Resolution: Run SQL to reset the sequence OR disable the trigger for portal inserts.');
  } else {
    console.log('Result ticket_no:', data[0].ticket_no);
    if (data[0].ticket_no === nano) {
      console.log('-> Our ticket_no was KEPT. Good. Something else is wrong.');
    } else {
      console.log('-> DB TRIGGER REPLACED IT with:', data[0].ticket_no);
      console.log('-> The trigger generates its own ticket_no from a broken SEQUENCE.');
      await sc.from('tickets').delete().eq('ticket_no', data[0].ticket_no);
    }
  }
}
findConflict();
