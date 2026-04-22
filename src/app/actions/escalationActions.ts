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
    
    // Selecting expanded info
    const { data: ticket, error } = await supabaseAdmin
      .from('tickets')
      .select(`
        id, 
        ticket_no, 
        subject, 
        description, 
        status, 
        module, 
        issue_type, 
        created_at, 
        customer_id,
        customers (display_name),
        hospitals (name)
      `)
      .eq('id', ticketId)
      .maybeSingle();
      
    if (error || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานหรือคำขอนี้หมดอายุแล้ว' };
    }

    // Also fetch recent logs to show progress/instructions better
    const { data: logs } = await supabaseAdmin
      .from('ticket_logs')
      .select('action_type, note, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    return { data: { ...ticket, logs } };
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

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] ผู้รับเรื่อง: ${receiverName} (เวลา: ${timestamp} UTC)`;

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
    
    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('ticket_no, assigned_agent_id, resolution_summary')
      .eq('id', ticketId)
      .maybeSingle();
      
    if (fetchError || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึกงานส่งมอบ' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    let reportText = `[External Report by ${receiverName || 'N/A'}] - ${timestamp} UTC\n`;
    reportText += `ผลการดำเนินงาน: ${newStatus}\n`;
    reportText += `รายละเอียด: ${notes || 'N/A'}\n`;
    if (attachmentUrls && attachmentUrls.length > 0) {
      reportText += `หลักฐาน: ${attachmentUrls.join(', ')}`;
    }

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

    // Send Notification to the internal agent
    // We add a specific 'source' or 'category' to the notification if possible, but the current schema uses discrete fields.
    if (ticket.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: ticket.assigned_agent_id,
          title: `🚩 งานส่งต่อ #${ticket.ticket_no} แก้ไขเสร็จสิ้น!`,
          body: `รอกรงบยืนยัน: ผู้รับช่วงงานอัปเดตสถานะเป็น ${newStatus}. กรุณาตรวจสอบผลงานและกดปิดใบงาน`,
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
