const { createClient } = require('@supabase/supabase-js');

// Load env vars from .env.local if possible
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('localhost', '127.0.0.1');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Env vars!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking row counts...");
  
  const { count: ticketCount, error: err1 } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true });
    
  const { count: csatCount, error: err2 } = await supabase
    .from('csat_surveys')
    .select('*', { count: 'exact', head: true });

  console.log("Total Tickets:", ticketCount, "Error:", err1);
  console.log("Total CSAT Surveys:", csatCount, "Error:", err2);

  // Test queries for a month date range
  const start = '2026-04-23';
  const end = '2026-05-23';

  console.time('Query Tickets');
  const tQ = await supabase
    .from('tickets')
    .select(`
      id,
      ticket_no,
      subject,
      status,
      priority,
      issue_type,
      created_at,
      resolved_at
    `)
    .gte('created_at', start)
    .lte('created_at', end)
    .order('created_at', { ascending: false });
  console.timeEnd('Query Tickets');
  console.log("Tickets returned:", tQ.data?.length, "Error:", tQ.error);

  console.time('Query CSAT');
  const cQ = await supabase
    .from('csat_surveys')
    .select('score, created_at')
    .not('score', 'is', null)
    .gte('created_at', start)
    .lte('created_at', end);
  console.timeEnd('Query CSAT');
  console.log("CSAT surveys returned:", cQ.data?.length, "Error:", cQ.error);
}

check();
