const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="(.+)"/) || envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/) || envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim().replace(/"/g, '');
const supabaseKey = keyMatch[1].trim().replace(/"/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Querying pg_policies...');
  const { data, error } = await supabase.rpc('exec_sql', { 
    sql: `SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('messages', 'tickets', 'conversations');` 
  });
  if (error) {
    console.error('Error querying pg_policies:', error);
  } else {
    console.log('Policies:');
    console.table(data);
  }
}
check();
