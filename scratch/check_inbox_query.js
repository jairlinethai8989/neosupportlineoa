const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env.production.local') });

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace('localhost', '127.0.0.1');
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const selectClause = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    avatar_url,
    hospital_id,
    hospitals:hospital_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status
  )
`;

const selectClauseLegacy = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    hospital_id,
    hospitals:hospital_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status
  )
`;

async function run() {
  console.log("Checking conversations query performance...");
  
  // 1. Check Row Count
  const { count, error: countError } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true });
  console.log("Total rows in conversations:", count, "Error:", countError);

  // 2. Run listInboxConversationsV2 exact query structure
  console.time("Query Active Conversations (Primary select)");
  const q1 = await supabase
    .from('conversations')
    .select(selectClause)
    .not('status', 'in', '("closed","resolved","done","archived")')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(11);
  console.timeEnd("Query Active Conversations (Primary select)");
  console.log("Q1 Returned length:", q1.data?.length, "Error:", q1.error);

  if (q1.error) {
    console.time("Query Active Conversations (Legacy select)");
    const q1Legacy = await supabase
      .from('conversations')
      .select(selectClauseLegacy)
      .not('status', 'in', '("closed","resolved","done","archived")')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(11);
    console.timeEnd("Query Active Conversations (Legacy select)");
    console.log("Q1 Legacy Returned length:", q1Legacy.data?.length, "Error:", q1Legacy.error);
  }

  // 3. Let's try with a strict status filter status = 'active'
  console.time("Query Active Conversations with status = 'active'");
  const q2 = await supabase
    .from('conversations')
    .select(selectClause)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(11);
  console.timeEnd("Query Active Conversations with status = 'active'");
  console.log("Q2 Returned length:", q2.data?.length, "Error:", q2.error);

  // 4. Let's see what the contents look like
  if (q1.data && q1.data.length > 0) {
    console.log("First item in Q1:", JSON.stringify(q1.data[0], null, 2));
  }
}

run();
