
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDomains() {
  const domains = [
    { table: 'profiles', column: 'role' },
    { table: 'tickets', column: 'status' },
    { table: 'tickets', column: 'priority' },
    { table: 'tickets', column: 'module' },
    { table: 'tickets', column: 'issue_type' },
    { table: 'messages', column: 'sender_type' },
    { table: 'messages', column: 'message_type' }
  ];

  for (const domain of domains) {
    const { data, error } = await supabase
      .from(domain.table)
      .select(domain.column);
    
    if (error) {
      console.log(`❌ Error checking ${domain.table}.${domain.column}: ${error.message}`);
      continue;
    }

    const values = data.map(item => item[domain.column]);
    const uniqueValues = [...new Set(values)];
    console.log(`## ${domain.table}.${domain.column}`);
    console.log(uniqueValues.map(v => `- \`${v === null ? 'NULL' : v === '' ? 'EMPTY STRING' : v}\``).join('\n'));
    console.log('\n');
  }
}

checkDomains();
