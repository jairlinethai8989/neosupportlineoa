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
    .select('internal_notes, status')
    .eq('id', ticketId)
    .single();
    
  let newNotes = existingTicket?.internal_notes || '';
  
  const timestamp = new Date().toLocaleString('th-TH');
  let logEntry = `\n\n--- [${timestamp} - External Feedback] ---`;
  if (receiverName) logEntry += `\nผู้รับช่วงงาน: ${receiverName}`;
  logEntry += `\nสถานะใหม่: ${newStatus}`;
  if (notes) logEntry += `\nบันทึก: ${notes}`;
  if (attachmentUrls && attachmentUrls.length > 0) {
    logEntry += `\nไฟล์แนบ: ${attachmentUrls.join(', ')}`;
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
    throw new Error(error.message);
  }

  // If status resolved, optionally close the active conversation if requested? 
  // Probably let the Agent handle it on the dashboard side.
  
  return data;
}
