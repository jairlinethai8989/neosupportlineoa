const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.production.local', 'utf8');
const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL="(.+)"/) || envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/);
const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY="(.+)"/) || envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim().replace(/"/g, '');
const supabaseKey = keyMatch[1].trim().replace(/"/g, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Renaming foreign key constraints in database...');
  
  const sql = `
    -- Rename tickets table constraint
    ALTER TABLE public.tickets 
    RENAME CONSTRAINT tickets_hospital_id_fkey TO tickets_organization_id_fkey;

    -- Rename customers table constraint
    ALTER TABLE public.customers 
    RENAME CONSTRAINT customers_hospital_id_fkey TO customers_organization_id_fkey;
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
