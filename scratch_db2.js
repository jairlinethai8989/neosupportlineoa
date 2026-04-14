const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/);
const supabase = createClient(urlMatch[1].trim(), keyMatch[1].trim());

async function run() {
  const { data: comp } = await supabase.from('company_settings').select('departments');
  const { data: depts } = await supabase.from('departments').select('name');
  console.log('company_settings.departments:', comp ? comp[0].departments : null);
  console.log('departments.name:', depts ? depts.map(d=>d.name) : null);
}
run();
