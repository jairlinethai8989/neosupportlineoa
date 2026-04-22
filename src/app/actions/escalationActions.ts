'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// We verify the ticket ID and PIN here
export async function verifyEscalationPin(ticketId: string, pin: string) {
  // Option A MVP: for local testing, we consider PIN '1234' as correct.
  // In a real system, we'd query the DB for the ticket's pin or department pin.
  if (pin !== '1234') {
    throw new Error('รหัส PIN ไม่ถูกต้อง (Invalid PIN)');
  }
  
  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select('id, ticket_no, subject, description, status, module, issue_type, created_at')
    .eq('id', ticketId)
    .single();
    
  if (error || !ticket) {
    throw new Error('Ticket not found or expired');
  }
  
  return ticket;
}

export async function claimEscalatedTicket(
  ticketId: string,
  pin: string,
  receiverName: string
) {
  if (pin !== '1234') {
    throw new Error('รหัส PIN ไม่ถูกต้อง (Invalid PIN)');
  }

  const timestamp = new Date().toLocaleString('th-TH');
  const logEntry = `\n\n--- [${timestamp} - Job Claimed] ---\nผู้รับเรื่อง: ${receiverName}\nสถานะ: กำลังดำเนินการโดยแผนกภายนอก`.trim();

  // Fetch existing notes
  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('internal_notes')
    .eq('id', ticketId)
    .single();

  const newNotes = `${ticket?.internal_notes || ''}\n\n${logEntry}`.trim();

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update({ 
      internal_notes: newNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { success: true, id: data.id };
}

export async function updateEscalatedTicketStatus(
  ticketId: string, 
  pin: string, 
  newStatus: string, 
  notes: string,
  receiverName?: string,
  attachmentUrls?: string[]
) {
  if (pin !== '1234') {
    throw new Error('รหัส PIN ไม่ถูกต้อง (Invalid PIN)');
  }
  
  // First, fetch existing internal notes to append to
  const { data: existingTicket } = await supabaseAdmin
    .from('tickets')
    .select('internal_notes, status, assigned_agent_id')
    .eq('id', ticketId)
    .single();
    
  let newNotes = existingTicket?.internal_notes || '';
  
  const timestamp = new Date().toLocaleString('th-TH');
  let logEntry = `\n\n--- [${timestamp} - Work Completed] ---`;
  if (receiverName) logEntry += `\nผู้ส่งมอบงาน: ${receiverName}`;
  logEntry += `\nผลการดำเนินการ: ${newStatus}`;
  if (notes) logEntry += `\nรายละเอียด: ${notes}`;
  if (attachmentUrls && attachmentUrls.length > 0) {
    logEntry += `\nหลักฐานแนบ: ${attachmentUrls.join(', ')}`;
  }

  newNotes = `${newNotes}${logEntry}`.trim();

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .update({ 
      status: newStatus,
      internal_notes: newNotes,
      updated_at: new Date().toISOString()
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (error) {
    console.error('[EscalationAction] DB Update Error:', error);
    throw new Error(error.message);
  }

  // Add a notification for the internal agent
  if (existingTicket?.assigned_agent_id) {
    try {
      await supabaseAdmin.from('notifications').insert([{
        user_id: existingTicket.assigned_agent_id,
        title: `✅ งานส่งต่อได้รับการแก้ไขแล้ว — #${data.ticket_no}`,
        body: `ผู้รับช่วงงาน (${receiverName || 'External'}) ได้อัปเดตสถานะเป็น ${newStatus}`,
        type: 'ticket',
        metadata: { ticket_id: ticketId, ticket_no: data.ticket_no }
      }]);
    } catch (notifErr) {
      console.error('[EscalationAction] Notification Error:', notifErr);
    }
  }

  // Ensure we return a plain object to avoid serialization issues
  return JSON.parse(JSON.stringify({ success: true, ticketId: data.id }));
}
