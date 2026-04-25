'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

async function resolveRealTicketId(ticketIdOrToken: string) {
  if (isUuidLike(ticketIdOrToken)) {
    return ticketIdOrToken;
  }

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id')
    .eq('escalation_token', ticketIdOrToken)
    .maybeSingle();

  return ticket?.id || null;
}

export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {
    if (pin !== '1234') {
      return { error: 'รหัส PIN ไม่ถูกต้อง (Invalid PIN)' };
    }

    let query = supabaseAdmin.from('tickets').select('*');
    if (isUuidLike(ticketId)) {
      query = query.eq('id', ticketId);
    } else {
      query = query.eq('escalation_token', ticketId);
    }

    const { data: ticket, error } = await query.maybeSingle();

    if (error) {
      return { error: `Database Error: ${error.message}` };
    }

    if (!ticket) {
      return { error: 'ไม่พบข้อมูลใบงานหรือรหัสยืนยันผิดพลาด (Ticket Not Found or Invalid Token)' };
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('display_name')
      .eq('id', ticket.customer_id)
      .maybeSingle();

    const { data: hospital } = ticket.hospital_id
      ? await supabaseAdmin
          .from('hospitals')
          .select('name')
          .eq('id', ticket.hospital_id)
          .maybeSingle()
      : { data: null };

    const { data: logs } = await supabaseAdmin
      .from('ticket_logs')
      .select('action_type, note, created_at')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: false })
      .limit(5);

    return { data: { ...ticket, customers: customer, hospitals: hospital, logs } };
  } catch (err: any) {
    return { error: `เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ${err.message}` };
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

    const realId = await resolveRealTicketId(ticketId);
    if (!realId) {
      return { error: 'ไม่พบใบงานที่ระบุ' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] ผู้รับเรื่อง: ${receiverName} (เวลา: ${timestamp} UTC)`;

    const { error: logError } = await supabaseAdmin
      .from('ticket_logs')
      .insert([
        {
          ticket_id: realId,
          action_type: 'claim',
          note: logNote,
        },
      ]);

    if (logError) {
      return { error: `ไม่สามารถบันทึกการรับเรื่องได้: ${logError.message}` };
    }

    await supabaseAdmin
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', realId);

    return { success: true };
  } catch (err: any) {
    return { error: `เกิดข้อผิดพลาดรุนแรง: ${err.message}` };
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

    let query = supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, assigned_agent_id, resolution_summary');

    if (isUuidLike(ticketId)) {
      query = query.eq('id', ticketId);
    } else {
      query = query.eq('escalation_token', ticketId);
    }

    const { data: ticket, error: fetchError } = await query.maybeSingle();
    if (fetchError || !ticket) {
      return { error: 'ไม่พบข้อมูลใบงานเพื่อบันทึกงานส่งมอบ' };
    }

    const realId = ticket.id;
    // External escalation page is for reporting progress back to owner.
    // It must never close ticket directly.
    const nextStatus = newStatus === 'Resolved' ? 'In Progress' : newStatus;
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let reportText = `[External Report by ${receiverName || 'N/A'}] - ${timestamp} UTC\n`;
    reportText += `Status: ${nextStatus}\n`;
    reportText += `Details: ${notes || 'N/A'}\n`;
    if (attachmentUrls && attachmentUrls.length > 0) {
      reportText += `Attachments: ${attachmentUrls.join(', ')}`;
    }

    const updatedSummary = `${ticket.resolution_summary || ''}\n\n${reportText}`.trim();

    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: nextStatus,
        resolved_at: null,
        resolution_summary: updatedSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', realId);

    if (updateError) {
      return { error: `บันทึกข้อมูลไม่สำเร็จ: ${updateError.message}` };
    }

    await supabaseAdmin.from('ticket_logs').insert([
      {
        ticket_id: realId,
        action_type: 'status_change',
        to_status: nextStatus,
        note: reportText,
      },
    ]);

    // Re-open the conversation bound to this ticket if it was closed earlier by mistake.
    const { data: lastTicketMessage } = await supabaseAdmin
      .from('messages')
      .select('conversation_id')
      .eq('ticket_id', realId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastTicketMessage?.conversation_id) {
      await supabaseAdmin
        .from('conversations')
        .update({
          status: 'active',
          current_ticket_id: realId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lastTicketMessage.conversation_id);
    }

    if (ticket.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([
          {
            user_id: ticket.assigned_agent_id,
            title: `🚩 งานส่งต่อ #${ticket.ticket_no} แก้ไขเสร็จเรียบร้อยแล้ว`,
            body: `กรุณาตรวจสอบผลงานและยืนยันปิดใบงานด้วยเจ้าของงาน (${nextStatus})`,
            type: 'ticket',
            metadata: { ticket_id: realId, ticket_no: ticket.ticket_no },
          },
        ]);
      } catch {
        // Notification failure should not break main flow.
      }
    }

    return { success: true };
  } catch (err: any) {
    return { error: `เกิดข้อผิดพลาดรุนแรง: ${err.message}` };
  }
}

