const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="(.+)"/) || envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/) || envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim().replace(/"/g, '');
const supabaseKey = keyMatch[1].trim().replace(/"/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log('Testing exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql: 'SELECT 1' });
  console.log('exec_sql result:', data, error);
}
check();
