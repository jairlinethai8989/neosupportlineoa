const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env.production.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.production.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying tickets columns and types...');

  // Let's check what values the "issue_type" column has across all tickets in the database!
  const { data: allIssueTypes, error: allErr } = await supabase
    .from('tickets')
    .select('issue_type, module');

  if (allErr) {
    console.error('Error fetching issue types:', allErr);
  } else {
    const uniqueIssueTypes = [...new Set(allIssueTypes.map(t => t.issue_type))];
    const uniqueModules = [...new Set(allIssueTypes.map(t => t.module))];
    console.log('Unique issue_type values currently in tickets table:', uniqueIssueTypes);
    console.log('Unique module values currently in tickets table:', uniqueModules);
  }
}
run();
