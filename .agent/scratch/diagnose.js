const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

async function diagnose() {
  const env = fs.readFileSync('.env.local', 'utf8');
  const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
  const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)?.[1]?.trim() || env.match(/ANON_KEY=(.*)/)[1].trim();
  const sc = createClient(url, serviceKey);

  console.log('=== Last 5 failed tickets that may have temp state ===');
  const { data: pending } = await sc.from('tickets').select('id, ticket_no, created_at').is('ticket_no', null).limit(5);
  console.log('NULL ticket_no rows:', pending);

  console.log('\n=== Checking sequence table if exists ===');
  const { data: seq, error: seqErr } = await sc.rpc('generate_ticket_no', { p_hospital_id: 'bac80af7-7c63-4eb2-86d9-d4b7652fbc6a' }).single();
  if (seqErr) {
    console.log('RPC error:', seqErr.message);
  } else {
    console.log('RPC result:', seq);
  }
}
diagnose();
