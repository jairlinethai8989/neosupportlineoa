const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: settings, error: sError } = await supabase.from('sla_settings').select('*');
  console.log('SLA Settings:', settings);
  
  const { data: tickets, error: tError } = await supabase
    .from('tickets')
    .select('id, ticket_no, priority, sla_due_at, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  console.log('Recent Tickets:', tickets);
}
run();
