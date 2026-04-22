'use server';

import { createClient } from '@supabase/supabase-js';

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
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง (Invalid PIN)' };
    }
    
    // Selecting columns that DEFINITELY exist
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, description, status, module, issue_type, created_at, customer_id')
      .eq('id', ticketId)
      .maybeSingle();
      
    if (error || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานหรือคำขอนี้หมดอายุแล้ว' };
    }
    
    return { data: ticket };
  } catch (err: any) {
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
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }

    const date = new Date();
    const timestamp = date.toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] ผู้รับเรื่อง: ${receiverName} (เวลา: ${timestamp} UTC)`;

    // INSTEAD of updating 'internal_notes' (which doesn't exist), we insert into ticket_logs
    const { error: logError } = await supabaseAdmin
      .from('ticket_logs')
      .insert([{
        ticket_id: ticketId,
        action_type: 'claim',
        note: logNote
      }]);

    if (logError) {
      return { error: 'ไม่สามารถบันทึกการรับเรื่องได้: ' + logError.message };
    }

    // Also update ticket updated_at
    await supabaseAdmin.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', ticketId);

    return { success: true };
  } catch (err: any) {
    return { error: 'เกิดข้อผิดพลาดรุนแรง: ' + err.message };
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
    
    // Fetch info needed for notification
    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('ticket_no, assigned_agent_id, resolution_summary')
      .eq('id', ticketId)
      .maybeSingle();
      
    if (fetchError || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึกงานส่งมอบ' };
    }

    const date = new Date();
    const timestamp = date.toISOString().replace('T', ' ').substring(0, 19);
    
    let reportText = `[External Report by ${receiverName || 'N/A'}] - ${timestamp} UTC\n`;
    reportText += `ผลการดำเนินงาน: ${newStatus}\n`;
    reportText += `รายละเอียด: ${notes || 'N/A'}\n`;
    if (attachmentUrls && attachmentUrls.length > 0) {
      reportText += `หลักฐาน: ${attachmentUrls.join(', ')}`;
    }

    // Append to resolution_summary (existing column)
    const updatedSummary = `${ticket.resolution_summary || ''}\n\n${reportText}`.trim();

    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({ 
        status: newStatus,
        resolution_summary: updatedSummary,
        updated_at: new Date().toISOString()
      })
      .eq('id', ticketId);

    if (updateError) {
      return { error: 'บันทึกข้อมูลไม่สำเร็จ: ' + updateError.message };
    }

    // Record Log
    await supabaseAdmin.from('ticket_logs').insert([{
      ticket_id: ticketId,
      action_type: 'status_change',
      to_status: newStatus,
      note: reportText
    }]);

    // Send Notification
    if (ticket.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: ticket.assigned_agent_id,
          title: `✅ งานส่งต่อได้รับการแก้ไขแล้ว — #${ticket.ticket_no}`,
          body: `ผู้รับช่วงงาน (${receiverName || 'External'}) ได้อัปเดตสถานะเป็น ${newStatus}`,
          type: 'ticket',
          metadata: { ticket_id: ticketId, ticket_no: ticket.ticket_no }
        }]);
      } catch (notifErr) {
        console.error('[UpdateStatus] Notification Error:', notifErr);
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'เกิดข้อผิดพลาดรุนแรง: ' + err.message };
  }
}
