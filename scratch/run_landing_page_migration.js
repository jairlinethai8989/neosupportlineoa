const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="(.+)"/) || envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/) || envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim().replace(/"/g, '');
const supabaseKey = keyMatch[1].trim().replace(/"/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Adding landing_page column to profiles...');
  
  const sql = `
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS landing_page TEXT DEFAULT NULL;
  `;
  
  const { data, error } = await supabase.rpc('exec_sql', { sql });
  if (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
  
  console.log('Migration successful!', data);
  process.exit(0);
}

run();
