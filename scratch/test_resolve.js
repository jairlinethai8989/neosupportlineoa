const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

// Load production env variables
if (fs.existsSync('.env.production.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.production.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Connecting to Supabase at:', supabaseUrl);
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function test() {
  const ticketNo = 'KOKHA-260515-TD4XEO';
  console.log(`Finding ticket ${ticketNo}...`);
  
  const { data: ticket, error: findError } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('ticket_no', ticketNo)
    .single();

  if (findError) {
    console.error('Error finding ticket:', findError);
    return;
  }

  console.log('Found Ticket UUID:', ticket.id);
  console.log('Ticket Current Status:', ticket.status);
  console.log('Ticket customer_id:', ticket.customer_id);

  // Try updating the ticket just like resolveTicketAction does
  const updateData = { 
    status: 'Resolved',
    resolved_at: new Date().toISOString(),
    resolution_summary: 'ทดสอบแก้ไขปิดงาน',
    updated_at: new Date().toISOString(),
    module: 'ห้องพยาบาล',
    issue_type: 'รออัพเดทแก้ไข'
  };

  console.log('Attempting to update ticket in DB with updateData:', updateData);
  const { data: updatedTicket, error: updateError } = await supabaseAdmin
    .from('tickets')
    .update(updateData)
    .eq('id', ticket.id)
    .select()
    .single();

  if (updateError) {
    console.error('❌ UPDATE ERROR:', updateError);
    return;
  }

  console.log('✅ Update ticket status success:', updatedTicket.status);

  // Try writing to ticket_logs
  console.log('Attempting to write ticket log...');
  const { error: logError } = await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticket.id,
    action_type: 'resolve',
    to_status: 'Resolved',
    performer_id: ticket.assigned_agent_id || '00000000-0000-0000-0000-000000000000', // dummy/real performer ID
    note: 'ทดสอบแก้ไขปิดงาน'
  }]);

  if (logError) {
    console.error('❌ LOG WRITE ERROR:', logError);
    return;
  }
  console.log('✅ Log write success!');

  // Try csat_surveys upsert
  console.log('Attempting to upsert CSAT survey...');
  const { error: csatError } = await supabaseAdmin.from('csat_surveys').upsert({
    ticket_id: ticket.id,
    sent_at: new Date().toISOString()
  }, { onConflict: 'ticket_id' });

  if (csatError) {
    console.error('❌ CSAT UPSERT ERROR:', csatError);
    return;
  }
  console.log('✅ CSAT upsert success!');
}

test();
