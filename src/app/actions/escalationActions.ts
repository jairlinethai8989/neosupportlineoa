'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// We verify the ticket ID and PIN here
export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง (Invalid PIN)' };
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, description, status, module, issue_type, created_at')
      .eq('id', ticketId)
      .single();
      
    if (error || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานหรือคำขอนี้หมดอายุแล้ว' };
    }
    
    return { data: ticket };
  } catch (err: any) {
    return { error: err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' };
  }
}

export async function claimEscalatedTicket(
  ticketId: string,
  pin: string,
  receiverName: string
) {
  try {
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }

    const date = new Date();
    const timestamp = `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB')}`;
    const logEntry = `\n\n--- [${timestamp} - Job Claimed] ---\nผู้รับเรื่อง: ${receiverName}\nสถานะ: กำลังดำเนินการโดยแผนกภายนอก`;

    // Fetch existing notes
    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('internal_notes')
      .eq('id', ticketId)
      .single();

    if (fetchError || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อรับเรื่อง' };
    }

    const newNotes = `${ticket.internal_notes || ''}${logEntry}`.trim();

    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ 
        internal_notes: newNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (updateError) {
      return { error: updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'เกิดข้อผิดพลาดรุนแรงบนเซิร์ฟเวอร์' };
  }
}

export async function updateEscalatedTicketStatus(
  ticketId: string, 
  pin: string, 
  newStatus: string, 
  notes: string,
  receiverName?: string,
  attachmentUrls?: string[]
) {
  try {
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }
    
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('internal_notes, status, assigned_agent_id, ticket_no')
      .eq('id', ticketId)
      .single();
      
    if (fetchError || !existingTicket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึก' };
    }

    const date = new Date();
    const timestamp = `${date.toLocaleDateString('en-GB')} ${date.toLocaleTimeString('en-GB')}`;
    let logEntry = `\n\n--- [${timestamp} - Work Completed] ---`;
    if (receiverName) logEntry += `\nผู้ส่งมอบงาน: ${receiverName}`;
    logEntry += `\nผลการดำเนินการ: ${newStatus}`;
    if (notes) logEntry += `\nรายละเอียด: ${notes}`;
    if (attachmentUrls && attachmentUrls.length > 0) {
      logEntry += `\nหลักฐานแนบ: ${attachmentUrls.join(', ')}`;
    }

    const newNotes = `${existingTicket.internal_notes || ''}${logEntry}`.trim();

    const { data: updatedData, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ 
        status: newStatus,
        internal_notes: newNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId)
      .select()
      .single();

    if (updateError || !updatedData) {
      return { error: updateError?.message || 'บันทึกข้อมูลไม่สำเร็จ' };
    }

    // Add a notification for the internal agent
    if (existingTicket.assigned_agent_id) {
      await supabaseAdmin.from('notifications').insert([{
        user_id: existingTicket.assigned_agent_id,
        title: `✅ งานส่งต่อได้รับการแก้ไขแล้ว — #${existingTicket.ticket_no}`,
        body: `ผู้รับช่วงงาน (${receiverName || 'External'}) ได้อัปเดตเป็น ${newStatus}`,
        type: 'ticket',
        metadata: { ticket_id: ticketId, ticket_no: existingTicket.ticket_no }
      }]);
    }

    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'เกิดข้อผิดพลาดรุนแรงบนเซิร์ฟเวอร์' };
  }
}
