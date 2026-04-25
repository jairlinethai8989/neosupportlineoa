'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

// We verify the ticket ID and PIN here
export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {


    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง (Invalid PIN)' };
    }
    
    // Search by ID (UUID) or custom Token
    const isUuid = ticketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    let query = supabaseAdmin.from('tickets').select('*');
    if (isUuid) {
      query = query.eq('id', ticketId);
    } else {
      query = query.eq('escalation_token', ticketId);
    }

    const { data: ticket, error } = await query.maybeSingle();
      
    if (error) {

       return { error: 'Database Error: ' + error.message };
    }

    if (!ticket) {

      return { error: 'ไม่พบข้อมูลใบงานหรือรหัสยืนยันผิดพลาด (Ticket Not Found or Invalid Token)' };
    }

    // If found, we can try to fetch the joined data separately or use a safer join
    // Safely fetch join data
    const { data: customer } = await supabaseAdmin.from('customers').select('display_name').eq('id', ticket.customer_id).maybeSingle();
    const { data: hospital } = ticket.hospital_id ? await supabaseAdmin.from('hospitals').select('name').eq('id', ticket.hospital_id).maybeSingle() : { data: null };
    
    const { data: logs } = await supabaseAdmin
      .from('ticket_logs')
      .select('action_type, note, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(5);
    
    return { data: { ...ticket, customers: customer, hospitals: hospital, logs } };
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

    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }

    // Resolve real ID if it's a token
    const isUuid = ticketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    let realId = ticketId;
    
    if (!isUuid) {
      const { data: ticket } = await supabaseAdmin
        .from('tickets')
        .select('id')
        .eq('escalation_token', ticketId)
        .maybeSingle();
      if (!ticket) return { error: 'ไม่พบใบงานที่ระบุ' };
      realId = ticket.id;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] ผู้รับเรื่อง: ${receiverName} (เวลา: ${timestamp} UTC)`;

    const { error: logError } = await supabaseAdmin
      .from('ticket_logs')
      .insert([{
        ticket_id: realId,
        action_type: 'claim',
        note: logNote
      }]);

    if (logError) {
      return { error: 'ไม่สามารถบันทึกการรับเรื่องได้: ' + logError.message };
    }

    await supabaseAdmin.from('tickets').update({ updated_at: new Date().toISOString() }).eq('id', realId);

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

    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง' };
    }
    
    // Resolve real ID if it's a token
    const isUuid = ticketId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    
    let query = supabaseAdmin.from('tickets').select('id, ticket_no, assigned_agent_id, resolution_summary');
    if (isUuid) {
      query = query.eq('id', ticketId);
    } else {
      query = query.eq('escalation_token', ticketId);
    }

    const { data: ticket, error: fetchError } = await query.maybeSingle();
      
    if (fetchError || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึกงานส่งมอบ' };
    }

    const realId = ticket.id;
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
      .eq('id', realId);

    if (updateError) {
      return { error: 'บันทึกข้อมูลไม่สำเร็จ: ' + updateError.message };
    }

    // Record Log
    await supabaseAdmin.from('ticket_logs').insert([{
      ticket_id: realId,
      action_type: 'status_change',
      to_status: newStatus,
      note: reportText
    }]);

    // Send Notification
    if (ticket.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([{
          user_id: ticket.assigned_agent_id,
          title: `🚩 งานส่งต่อ #${ticket.ticket_no} แก้ไขเสร็จสิ้น!`,
          body: `รอกรงบยืนยัน: ผู้รับช่วงงานอัปเดตสถานะเป็น ${newStatus}. กรุณาตรวจสอบผลงานและกดปิดใบงาน`,
          type: 'ticket',
          metadata: { ticket_id: realId, ticket_no: ticket.ticket_no }
        }]);
      } catch (_notifErr) {
        // Notification failure should not break the flow
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: 'เกิดข้อผิดพลาดรุนแรง: ' + err.message };
  }
}
