
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  'customers',
  'hospitals',
  'departments',
  'positions',
  'tickets',
  'conversations',
  'messages',
  'sla_rules',
  'csat_surveys'
];

async function extractSchema() {
  console.log('# Actual Database Schema (Live Snapshot)\n');

  for (const table of TABLES) {
    console.log(`## \`${table}\``);
    
    // Query information_schema via RPC or raw query if possible, 
    // but since we don't have a direct SQL tool, we try to get one row to see columns 
    // AND we can try to use the specific Supabase way to get schema or just rely on a generic helper.
    // Actually, querying information_schema.columns via supabase.rpc('inspect_table') might not exist.
    // Let's try to query information_schema directly if permissions allow.
    
    const { data: columns, error } = await supabase
      .from('_columns_view') // This might not work. Let's try a different approach.
      .select('*')
      .limit(0); // This just gets columns in some clients.

    // Better approach: use a sample row or use the postgres extension if available.
    // Alternatively, I can run a raw SQL query using an RPC if the user has defined one.
    // Let's check for existing RPCs first.
    
    // If no RPC, I'll just use a 'select * limit 1' to at least see column names and types inferred.
    const { data: sample, error: sampleError } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (sampleError) {
      console.log(`> Error fetching ${table}: ${sampleError.message}`);
      continue;
    }

    if (sample && sample.length >= 0) {
      const row = sample[0] || {};
      const colNames = Object.keys(row);
      
      console.log('| Column | Sample Value Type |');
      console.log('|---|---|');
      for (const col of colNames) {
        const val = row[col];
        const type = val === null ? 'null (unknown)' : typeof val;
        console.log(`| \`${col}\` | \`${type}\` |`);
      }
      console.log('\n');
    }
  }
}

extractSchema();
