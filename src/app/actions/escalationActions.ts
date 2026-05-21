'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ESCALATION_PIN = '1234';
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ExternalWorkStatus = 'In Progress' | 'Pending' | 'Fix Completed';

type EscalationTicketRow = {
  id: string;
  ticket_no?: string | null;
  assigned_agent_id?: string | null;
  resolution_summary?: string | null;
  customer_id?: string | null;
  hospital_id?: string | null;
  messages?: Array<Record<string, unknown>> | null;
  [key: string]: unknown;
};

function isUuidLike(value: string) {
  return UUID_REGEX.test(value);
}

function getInvalidPinError() {
  return { error: 'Invalid PIN' as const };
}

function hasValidPin(pin: string) {
  return pin === ESCALATION_PIN;
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

async function resolveTicketQuery(selectClause: string, ticketIdOrToken: string) {
  let query = supabaseAdmin.from('tickets').select(selectClause);
  query = isUuidLike(ticketIdOrToken)
    ? query.eq('id', ticketIdOrToken)
    : query.eq('escalation_token', ticketIdOrToken);

  return query.maybeSingle();
}

async function resolveRealTicketId(ticketIdOrToken: string) {
  if (isUuidLike(ticketIdOrToken)) {
    return ticketIdOrToken;
  }

  const { data: ticket } = await resolveTicketQuery('id', ticketIdOrToken);
  return (ticket as { id: string } | null)?.id || null;
}

async function reopenConversationForTicket(ticketId: string) {
  const { data: lastTicketMessage } = await supabaseAdmin
    .from('messages')
    .select('conversation_id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastTicketMessage?.conversation_id) {
    return;
  }

  await supabaseAdmin
    .from('conversations')
    .update({
      status: 'active',
      current_ticket_id: ticketId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', lastTicketMessage.conversation_id);
}

export async function verifyEscalationPin(ticketId: string, pin: string) {
  try {
    if (!hasValidPin(pin)) {
      return getInvalidPinError();
    }

    const { data: ticket, error } = await resolveTicketQuery('*', ticketId);
    if (error) {
      return { error: `Database Error: ${error.message}` };
    }
    if (!ticket) {
      return { error: 'Ticket not found or invalid escalation token' };
    }

    const ticketRow = ticket as unknown as EscalationTicketRow;

    const { data: customer } = ticketRow.customer_id
      ? await supabaseAdmin
          .from('customers')
          .select('display_name')
          .eq('id', ticketRow.customer_id)
          .maybeSingle()
      : { data: null };

    const { data: hospital } = ticketRow.hospital_id
      ? await supabaseAdmin
          .from('hospitals')
          .select('name')
          .eq('id', ticketRow.hospital_id)
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
      .select('content, sender_type, created_at, message_type')
      .eq('ticket_id', ticketRow.id)
      .order('created_at', { ascending: true });

    return { data: { ...ticketRow, customers: customer, hospitals: hospital, logs, messages } };
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
    if (!hasValidPin(pin)) {
      return getInvalidPinError();
    }

    const realId = await resolveRealTicketId(ticketId);
    if (!realId) {
      return { error: 'Ticket not found' };
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logNote = `[Job Claimed by External] Receiver: ${receiverName} (time: ${timestamp} UTC)`;

    const { error: logError } = await supabaseAdmin.from('ticket_logs').insert([
      {
        ticket_id: realId,
        action_type: 'claim',
        note: logNote,
      },
    ]);

    if (logError) {
      return { error: `Failed to record claim: ${logError.message}` };
    }

    await supabaseAdmin
      .from('tickets')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', realId);

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
    if (!hasValidPin(pin)) {
      return getInvalidPinError();
    }

    const { data: ticket, error: fetchError } = await resolveTicketQuery(
      'id, ticket_no, status, assigned_agent_id, resolution_summary',
      ticketId
    );

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

    await reopenConversationForTicket(ticketRow.id);

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
