/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing Supabase env vars. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
}

const LOCKED_CUSTOMER_IDS = [
  '61a8bb18-a197-4b77-b167-0f034aeed963',
  '13633a48-33fb-47ec-aec4-7ab60b67efb8',
  '3b1f426c-3ee8-4756-85e6-14448f2abff8',
  'e1deffbe-d691-4096-aa39-329b1f3f226b',
  '3d04f63f-a34b-4482-9947-741a36f5138b',
];

const supabase = createClient(supabaseUrl, serviceRoleKey);

function parseArgs(argv) {
  return {
    dryRun: !argv.includes('--confirm'),
  };
}

async function fetchLockedCustomers() {
  const { data, error } = await supabase
    .from('customers')
    .select('id, line_user_id, display_name')
    .in('id', LOCKED_CUSTOMER_IDS);

  if (error) throw error;
  return data || [];
}

async function countByCustomer(tableName, customerId) {
  const { count, error } = await supabase
    .from(tableName)
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId);

  if (error) throw error;
  return count || 0;
}

async function countRelatedRows(customerId) {
  const [tickets, conversations, messages] = await Promise.all([
    countByCustomer('tickets', customerId),
    countByCustomer('conversations', customerId),
    countByCustomer('messages', customerId),
  ]);

  return { tickets, conversations, messages };
}

async function deleteLockedCustomers() {
  const { error: messageDeleteError } = await supabase
    .from('messages')
    .delete()
    .in('customer_id', LOCKED_CUSTOMER_IDS);

  if (messageDeleteError) throw messageDeleteError;

  const { error: conversationDeleteError } = await supabase
    .from('conversations')
    .delete()
    .in('customer_id', LOCKED_CUSTOMER_IDS);

  if (conversationDeleteError) throw conversationDeleteError;

  const { error: ticketDeleteError } = await supabase
    .from('tickets')
    .delete()
    .in('customer_id', LOCKED_CUSTOMER_IDS);

  if (ticketDeleteError) throw ticketDeleteError;

  const { error } = await supabase
    .from('customers')
    .delete()
    .in('id', LOCKED_CUSTOMER_IDS);

  if (error) throw error;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const customers = await fetchLockedCustomers();

  console.log(`Locked scope: ${LOCKED_CUSTOMER_IDS.length} customer_id(s).`);
  console.log(`Found in DB: ${customers.length} customer(s).`);

  for (const customer of customers) {
    const related = await countRelatedRows(customer.id);
    console.log(
      `- ${customer.id} | name="${customer.display_name || ''}" | line_user_id=${customer.line_user_id || ''} | tickets=${related.tickets}, conversations=${related.conversations}, messages=${related.messages}`
    );
  }

  if (args.dryRun) {
    console.log('');
    console.log('Dry-run mode: no data deleted. Add --confirm to delete locked customers.');
    return;
  }

  await deleteLockedCustomers();
  console.log('');
  console.log(`Deleted locked customers: ${LOCKED_CUSTOMER_IDS.length} requested.`);
}

main().catch((error) => {
  console.error('Locked delete failed:', error);
  process.exitCode = 1;
});
