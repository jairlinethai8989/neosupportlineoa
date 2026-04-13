const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function findDuplicate() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)[1].trim();
  const sc = createClient(url, key);

  // Check if this ticket_no already exists
  const testNo = 'SI-260410-152443-993';
  const { data, error } = await sc.from('tickets').select('id, ticket_no').eq('ticket_no', testNo);
  console.log('Existing tickets with no', testNo, ':', data);
  
  // Check all unique ticket_nos and look for pattern
  const { data: allTickets } = await sc.from('tickets').select('id, ticket_no').order('created_at', { ascending: false }).limit(30);
  console.log('All recent tickets:', allTickets?.map(t => t.ticket_no));
}
findDuplicate();
