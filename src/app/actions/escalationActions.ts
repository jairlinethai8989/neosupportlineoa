'use server';

import { createClient } from '@supabase/supabase-js';

// We initialize inside or ensure it's strictly from env
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

// We verify the ticket ID and PIN here
export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    console.log('[Verify] TicketID:', ticketId);

    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง (Invalid PIN)' };
    }
    
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, description, status, module, issue_type, created_at')
      .eq('id', ticketId)
      .single();
      
    if (error || !ticket) {
      console.error('[Verify] Fetch Error:', error);
      return { error: 'ไม่พบข้อมูลใบงานหรือคำขอนี้หมดอายุแล้ว' };
    }
    
    return { data: ticket };
  } catch (err: any) {
    console.error('[Verify] Critical Error:', err);
    return { error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + err.message };
  }
}

export async function claimEscalatedTicket(
  ticketId: string,
  pin: string,
  receiverName: string
) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    console.log('[Claim] TicketID:', ticketId, 'for', receiverName);

    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `\n\n--- [${timestamp} UTC - Job Claimed] ---\nผู้รับเรื่อง: ${receiverName}\nสถานะ: กำลังดำเนินการโดยแผนกภายนอก`;

    // Fetch existing notes
    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('internal_notes')
      .eq('id', ticketId)
      .maybeSingle(); // Better than single() if we want to handle "not found" gracefully

    if (fetchError || !ticket) {
      console.error('[Claim] Fetch Error:', fetchError);
      return { error: `ไม่พบข้อมูลใบงานเพื่อรับเรื่อง (ID: ${ticketId.substring(0, 8)}...)` };
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
      console.error('[Claim] Update Error:', updateError);
      return { error: 'บันทึกข้อมูลล้มเหลว: ' + updateError.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Claim] Critical Error:', err);
    return { error: 'เกิดข้อผิดพลาดรุนแรงบนเซิร์ฟเวอร์: ' + err.message };
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
    const supabaseAdmin = getSupabaseAdmin();
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }
    
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('internal_notes, status, assigned_agent_id, ticket_no')
      .eq('id', ticketId)
      .maybeSingle();
      
    if (fetchError || !existingTicket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึกงานส่งมอบ' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    let logEntry = `\n\n--- [${timestamp} UTC - Work Completed] ---`;
    if (receiverName) logEntry += `\nผู้ส่งมอบงาน: ${receiverName}`;
    logEntry += `\nผลการดำเนินการ: ${newStatus}`;
    if (notes) logEntry += `\nรายละเอียด: ${notes}`;
    if (attachmentUrls && attachmentUrls.length > 0) {
      logEntry += `\nหลักฐานแนบ: ${attachmentUrls.join(', ')}`;
    }

    const newNotes = `${existingTicket.internal_notes || ''}${logEntry}`.trim();

    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ 
        status: newStatus,
        internal_notes: newNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (updateError) {
      return { error: 'บันทึกข้อมูลไม่สำเร็จ: ' + updateError.message };
    }

    // Add a notification for the internal agent
    if (existingTicket.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: existingTicket.assigned_agent_id,
          title: `✅ งานส่งต่อได้รับการแก้ไขแล้ว — #${existingTicket.ticket_no}`,
          body: `ผู้รับช่วงงาน (${receiverName || 'External'}) ได้อัปเดตเป็น ${newStatus}`,
          type: 'ticket',
          metadata: { ticket_id: ticketId, ticket_no: existingTicket.ticket_no }
        }]);
      } catch (notifErr) {
        console.error('[UpdateStatus] Notification Error:', notifErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'เกิดข้อผิดพลาดรุนแรงบนเซิร์ฟเวอร์: ' + err.message };
  }
}
