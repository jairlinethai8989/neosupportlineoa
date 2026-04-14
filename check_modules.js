const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: compCols } = await supabase.from('company_settings').select('*').limit(1);
  const { data: ticketCols } = await supabase.from('tickets').select('*').limit(1);
  
  console.log('Company Settings Keys:', compCols ? Object.keys(compCols[0]) : 'None');
  console.log('Ticket Keys:', ticketCols ? Object.keys(ticketCols[0]) : 'None');
  
  if (compCols && compCols[0].modules) {
    console.log('Existing Modules:', compCols[0].modules);
  }
}
run();
