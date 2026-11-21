'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyStaffGroupIfConfigured } from '@/lib/utils/lineNotifications';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import crypto from 'crypto';

const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || 'https://neoworkspace.vercel.app').replace(/\/$/, '');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ExternalWorkStatus = 'In Progress' | 'Pending' | 'Fix Completed';

type EscalationTicketRow = {
  id: string;
  ticket_no?: string | null;
  assigned_agent_id?: string | null;
  resolution_summary?: string | null;
  customer_id?: string | null;
  organization_id?: string | null;
  messages?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};

function isUuidLike(value: string) {
  return UUID_REGEX.test(value);
}

function getInvalidPinError() {
  return { error: 'Invalid PIN' as const };
}

function hasValidPin(pin: string, securePin: string) {
  return pin === securePin;
}

function sanitizeExternalStatus(status: string): ExternalWorkStatus {
  if (status === 'Pending') return 'Pending';
  if (status === 'Fix Completed') return 'Fix Completed';
  return 'In Progress';
}

function buildExternalReport(input: {
  receiverName?: string;
  status: ExternalWorkStatus;
  notes: string;
  attachmentUrls?: string[];
}) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const lines = [
    `[External Report by ${input.receiverName || 'N/A'}] - ${timestamp} UTC`,
    `Status: ${input.status}`,
    `Details: ${input.notes || 'N/A'}`,
  ];

  if (input.attachmentUrls && input.attachmentUrls.length > 0) {
    lines.push(`Attachments: ${input.attachmentUrls.join(', ')}`);
  }

  return lines.join('\n');
}

async function getActiveHandoff(ticketIdOrToken: string) {
  const query = supabaseAdmin.from('ticket_handoffs').select('*');
  const isUuid = isUuidLike(ticketIdOrToken);
  
  const result = isUuid
    ? await query.or(`id.eq."${ticketIdOrToken}",ticket_id.eq."${ticketIdOrToken}"`).order('created_at', { ascending: false }).limit(1).maybeSingle()
    : await query.eq('token', ticketIdOrToken).maybeSingle();

  return result.data;
}

async function reopenConversationForTicket(ticketId: string): Promise<string | null> {
  const { data: lastTicketMessage } = await supabaseAdmin
    .from('messages')
    .select('conversation_id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = lastTicketMessage?.conversation_id || null;
  if (!conversationId) {
    const { data: convRow } = await supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('current_ticket_id', ticketId)
      .order('last_message_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    conversationId = convRow?.id || null;
  }

  if (!conversationId) {
    return null;
  }

  const nowIso = new Date().toISOString();
  await supabaseAdmin
    .from('conversations')
    .update({
      status: 'active',
      current_ticket_id: ticketId,
      last_message_at: nowIso,
      updated_at: nowIso,
    })
    .eq('id', conversationId);

  return conversationId;
}

export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {
    const handoff = await getActiveHandoff(ticketId);
    if (!handoff) {
      return { error: 'Handoff session not found or invalid token' };
    }

    // Verify PIN first
    if (!hasValidPin(pin, handoff.secure_pin)) {
      return getInvalidPinError();
    }

    // Check expiration and update status in DB if needed, but DO NOT block access
    const isExpired = handoff.status === 'Expired' || new Date(handoff.expires_at) < new Date();
    if (isExpired && handoff.status !== 'Expired') {
      await supabaseAdmin
        .from('ticket_handoffs')
        .update({ status: 'Expired', updated_at: new Date().toISOString() })
        .eq('id', handoff.id);
      handoff.status = 'Expired';
    }

    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .select('*')
      .eq('id', handoff.ticket_id)
      .maybeSingle();

    if (ticketError || !ticket) {
      return { error: 'Ticket details could not be found' };
    }

    const ticketRow = ticket as unknown as EscalationTicketRow;

    const { data: customer } = ticketRow.customer_id
      ? await supabaseAdmin
          .from('customers')
          .select('display_name')
          .eq('id', ticketRow.customer_id)
          .maybeSingle()
      : { data: null };

    const { data: organization } = ticketRow.organization_id
      ? await supabaseAdmin
          .from('organizations')
          .select('name')
          .eq('id', ticketRow.organization_id)
          .maybeSingle()
      : { data: null };

    const { data: logs } = await supabaseAdmin
      .from('ticket_logs')
      .select('action_type, note, created_at')
      .eq('ticket_id', ticketRow.id)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: messages } = await supabaseAdmin
      .from('messages')
      .select('content, media_path, sender_type, created_at, message_type')
      .eq('ticket_id', ticketRow.id)
      .order('created_at', { ascending: true });

    // Fetch Quality Verification Reviews (reject/approve history)
    const { data: verifications } = await supabaseAdmin
      .from('ticket_verifications')
      .select('decision, feedback_notes, created_at')
      .eq('ticket_id', ticketRow.id)
      .order('created_at', { ascending: false });

    // Fetch reports submitted under this handoff
    const { data: reports } = await supabaseAdmin
      .from('ticket_handoff_reports')
      .select('*')
      .eq('handoff_id', handoff.id)
      .order('created_at', { ascending: false });

    return { 
      data: { 
        ...ticketRow, 
        customers: customer, 
        organizations: organization, 
        logs, 
        messages, 
        handoff,
        verifications,
        reports
      } 
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `Escalation access check failed: ${message}` };
  }
}

export async function claimEscalatedTicket(
  ticketId: string,
  pin: string,
  receiverName: string
) {
  try {
    const handoff = await getActiveHandoff(ticketId);
    if (!handoff) {
      return { error: 'Handoff session not found' };
    }

    if (!hasValidPin(pin, handoff.secure_pin)) {
      return getInvalidPinError();
    }

    if (handoff.status === 'Expired' || new Date(handoff.expires_at) < new Date()) {
      return { error: 'This magic link has expired. Cannot claim ticket.' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] Receiver: ${receiverName} (time: ${timestamp} UTC)`;

    const { error: logError } = await supabaseAdmin.from('ticket_logs').insert([
      {
        ticket_id: handoff.ticket_id,
        action_type: 'claim',
        note: logNote,
      },
    ]);

    if (logError) {
      return { error: `Failed to record claim: ${logError.message}` };
    }

    // Update handoff status to Claimed
    await supabaseAdmin
      .from('ticket_handoffs')
      .update({ 
        status: 'Claimed', 
        assigned_to_external: receiverName, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', handoff.id);

    await supabaseAdmin
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', handoff.ticket_id);

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `Failed to claim escalation ticket: ${message}` };
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
    const handoff = await getActiveHandoff(ticketId);
    if (!handoff) {
      return { error: 'Handoff session not found' };
    }

    if (!hasValidPin(pin, handoff.secure_pin)) {
      return getInvalidPinError();
    }

    if (handoff.status === 'Expired' || new Date(handoff.expires_at) < new Date()) {
      return { error: 'This magic link has expired. Cannot submit new reports.' };
    }

    const { data: ticket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, status, assigned_agent_id, resolution_summary, project_id')
      .eq('id', handoff.ticket_id)
      .maybeSingle();

    if (fetchError || !ticket) {
      return { error: 'Ticket not found for escalation update' };
    }

    const ticketRow = ticket as unknown as EscalationTicketRow;
    const nextStatus = sanitizeExternalStatus(newStatus);
    const reportText = buildExternalReport({
      receiverName,
      status: nextStatus,
      notes,
      attachmentUrls,
    });
    const updatedSummary = `${ticketRow.resolution_summary || ''}\n\n${reportText}`.trim();

    // 1. Insert report details in ticket_handoff_reports
    const { error: reportError } = await supabaseAdmin
      .from('ticket_handoff_reports')
      .insert([{
        handoff_id: handoff.id,
        status: nextStatus,
        reporter_name: receiverName || handoff.assigned_to_external || 'External Team',
        notes: notes,
        attachments: attachmentUrls || []
      }]);

    if (reportError) {
      return { error: `Failed to record progress report: ${reportError.message}` };
    }

    // 2. Update handoff status
    const handoffNextStatus = nextStatus === 'Fix Completed' ? 'Completed' : 'Claimed';
    await supabaseAdmin
      .from('ticket_handoffs')
      .update({ 
        status: handoffNextStatus, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', handoff.id);

    // 3. Update parent ticket status
    const { error: updateError } = await supabaseAdmin
      .from('tickets')
      .update({
        status: nextStatus,
        resolved_at: null,
        resolution_summary: updatedSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ticketRow.id);

    if (updateError) {
      return { error: `Failed to update ticket: ${updateError.message}` };
    }

    await supabaseAdmin.from('ticket_logs').insert([
      {
        ticket_id: ticketRow.id,
        action_type: 'status_change',
        from_status: ticketRow.status as string,
        to_status: nextStatus,
        note: reportText,
      },
    ]);

    const reopenedConvId = await reopenConversationForTicket(ticketRow.id);
    if (reopenedConvId) {
      const internalMessages: Array<Record<string, unknown>> = [
        {
          conversation_id: reopenedConvId,
          ticket_id: ticketRow.id,
          sender_type: 'system',
          content: reportText,
          message_type: 'text',
          is_internal: true,
        },
      ];

      for (const url of attachmentUrls || []) {
        if (url && typeof url === 'string') {
          const isImg = /\.(jpeg|jpg|gif|png|webp)$/i.test(url);
          internalMessages.push({
            conversation_id: reopenedConvId,
            ticket_id: ticketRow.id,
            sender_type: 'system',
            content: url,
            media_path: url,
            message_type: isImg ? 'image' : 'file',
            is_internal: true,
          });
        }
      }

      await supabaseAdmin.from('messages').insert(internalMessages);
    }

    invalidateAllLiveCaches();
    invalidateAllPreviewCaches();

    const reporter = receiverName || handoff.assigned_to_external || 'ทีมภายนอก';
    const notesPreview = notes?.trim()
      ? notes.trim().length > 140
        ? `${notes.trim().slice(0, 140)}...`
        : notes.trim()
      : '-';
    const statusEmoji = nextStatus === 'Fix Completed' ? '✅' : nextStatus === 'Pending' ? '⏸️' : '🔧';
    void notifyStaffGroupIfConfigured(
      `${statusEmoji} อัปเดตจากทีมภายนอก (#${ticketRow.ticket_no || ticketRow.id})\n` +
      `สถานะใหม่: ${nextStatus}\n` +
      `ผู้รายงาน: ${reporter}\n` +
      `รายละเอียด: ${notesPreview}\n` +
      `ตรวจสอบ/ปิดงาน: ${APP_BASE_URL}/tickets/${ticketRow.id}`,
      (ticket as { project_id?: string | null }).project_id || null
    );

    if (ticketRow.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([
          {
            user_id: ticketRow.assigned_agent_id,
            title: `Escalation update #${ticketRow.ticket_no}`,
            body: `External team returned work as ${nextStatus}. Owner review is required before final resolve.`,
            type: 'ticket',
            metadata: { ticket_id: ticketRow.id, ticket_no: ticketRow.ticket_no },
          },
        ]);
      } catch {
        // Notification failure should never block core workflow.
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `Failed to submit escalation report: ${message}` };
  }
}

export async function regenerateEscalationLink(ticketId: string, pin: string) {
  try {
    const handoff = await getActiveHandoff(ticketId);
    if (!handoff) {
      return { error: 'Handoff session not found' };
    }

    if (!hasValidPin(pin, handoff.secure_pin)) {
      return getInvalidPinError();
    }

    const tokenToUse = crypto.randomUUID();
    const securePin = Math.floor(1000 + Math.random() * 9000).toString();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('ticket_handoffs')
      .update({ status: 'Expired', updated_at: new Date().toISOString() })
      .eq('ticket_id', handoff.ticket_id)
      .neq('status', 'Completed');

    const { error: insertError } = await supabaseAdmin
      .from('ticket_handoffs')
      .insert([{
        ticket_id: handoff.ticket_id,
        handoff_type: handoff.handoff_type,
        token: tokenToUse,
        secure_pin: securePin,
        status: 'Active',
        created_by: handoff.created_by,
        expires_at: expiresAt,
      }]);

    if (insertError) {
      return { error: `Failed to create new handoff: ${insertError.message}` };
    }

    await supabaseAdmin
      .from('tickets')
      .update({ escalation_token: tokenToUse, updated_at: new Date().toISOString() })
      .eq('id', handoff.ticket_id);

    return { 
      success: true, 
      token: tokenToUse, 
      pin: securePin 
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { error: `Failed to regenerate magic link: ${message}` };
  }
}
