
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('--- E2E TEST: STEP 1 (Create Ticket) ---');
  
  const testLineUid = 'U_E2E_TEST_USER_999';
  const testDisplayName = 'E2E Test Customer';
  
  // 1. Create/Get Customer
  const { data: customer, error: cErr } = await supabase
    .from('customers')
    .upsert({
      line_user_id: testLineUid,
      display_name: testDisplayName
    }, { onConflict: 'line_user_id' })
    .select()
    .single();
    
  if (cErr) throw cErr;
  console.log('Customer created/found:', customer.id);
  
  // 2. Create Ticket
  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .insert([{
      customer_id: customer.id,
      subject: 'E2E Test: เครื่องพิมพ์เสีย (Simulated from LINE)',
      description: 'ทดสอบระบบ Flow ตั้งแต่ต้นจนจบโดย Antigravity',
      status: 'New',
      priority: 'High',
      current_department_id: '2ebdd410-7f71-4924-8dde-1a923fcf72b2'
    }])
    .select()
    .single();
    
  if (tErr) throw tErr;
  console.log('Ticket created:', ticket.ticket_no, 'ID:', ticket.id);
  
  // 3. Create Conversation & Initial Message
  const { data: conv } = await supabase.from('conversations').insert([{
    customer_id: customer.id,
    status: 'active',
    current_ticket_id: ticket.id
  }]).select().single();
  
  await supabase.from('messages').insert([{
    conversation_id: conv.id,
    ticket_id: ticket.id,
    sender_type: 'customer',
    customer_id: customer.id,
    content: 'สวัสดีครับ เครื่องพิมพ์ใช้งานไม่ได้ครับ [E2E Test]',
    message_type: 'text'
  }]);
  
  console.log('Conversation and message created.');
  console.log('--- STEP 1 COMPLETE ---');
  console.log('TICKET_ID=' + ticket.id);
  console.log('TICKET_NO=' + ticket.ticket_no);
}

run().catch(console.error);
