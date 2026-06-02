const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.production.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log('Querying database foreign key constraints...');
  const { data, error } = await supabase.rpc('get_db_constraints', {});
  if (error) {
    // If get_db_constraints doesn't exist, let's run an arbitrary SQL query via a generic query if possible,
    // or query information schema via a known RPC or just query with both hints.
    console.error('RPC get_db_constraints not found/failed, trying select query on a view or table.');
    
    // Let's try querying using postgrest schema check or common tables
    console.log(error);
  } else {
    console.log('Constraints:', data);
  }
}

// Let's also test if tickets_hospital_id_fkey still works as the hint
async function testOldHint() {
  const querySelect = `
    id,
    organizations!tickets_hospital_id_fkey (id, name)
  `;
  const { data, error } = await supabase.from('tickets').select(querySelect).limit(1);
  if (error) {
    console.error('Failed with tickets_hospital_id_fkey:', error.message);
  } else {
    console.log('SUCCESS with tickets_hospital_id_fkey! Data:', data);
  }
}

async function testNoHint() {
  const querySelect = `
    id,
    organizations (id, name)
  `;
  const { data, error } = await supabase.from('tickets').select(querySelect).limit(1);
  if (error) {
    console.error('Failed without hint:', error.message);
  } else {
    console.log('SUCCESS without hint! Data:', data);
  }
}

async function main() {
  await testOldHint();
  await testNoHint();
}

main();
