'use server';

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { generateSecurePin, hashHandoffCredential, parseHandoffToken, requireHandoffAccessPepper } from '@/lib/handoff/handoffAccess';
import { createHandoffMediaPath, isOwnedHandoffMediaPath } from '@/lib/handoff/handoffMedia';
import { parsePortalMediaInput, type PortalMediaInput } from '@/lib/portal/portalMedia';
import { normalizeChatMediaObjectPath, PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';
import crypto from 'crypto';

type ExternalWorkStatus = 'In Progress' | 'Pending' | 'Fix Completed';

type HandoffAccessError = {
  error: string;
  data?: never;
  success?: never;
  token?: never;
  pin?: never;
  path?: never;
  uploadToken?: never;
  contentType?: never;
  url?: never;
};

type RedeemedHandoff = {
  handoff: {
    id: string;
    ticket_id: string;
    handoff_type: string;
    status: string;
    target_team: string | null;
    assigned_to_external: string | null;
    created_by: string | null;
    expires_at: string;
  };
};

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

function getInvalidPinError(): HandoffAccessError {
  return { error: 'Invalid PIN' };
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

async function redeemActiveHandoff(ticketIdOrToken: string, pin: string): Promise<RedeemedHandoff | HandoffAccessError> {
  let token: string;
  try {
    token = parseHandoffToken(ticketIdOrToken);
  } catch {
    return { error: 'Invalid PIN' as const };
  }
  const pepper = requireHandoffAccessPepper();
  const { data, error } = await supabaseAdmin.rpc('redeem_ticket_handoff', {
    p_token_hash: hashHandoffCredential('token', token, pepper),
    p_pin_hash: hashHandoffCredential('pin', pin, pepper),
  });
  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result?.allowed) {
    if (result?.reason === 'expired') return { error: 'This magic link has expired.' };
    if (result?.reason === 'locked') return { error: 'Too many invalid attempts. Try again later.' };
    return getInvalidPinError();
  }
  return {
    handoff: {
      id: result.handoff_id as string,
      ticket_id: result.ticket_id as string,
      handoff_type: result.handoff_type as string,
      status: result.handoff_status as string,
      target_team: result.target_team as string | null,
      assigned_to_external: result.assigned_to_external as string | null,
      created_by: result.created_by as string | null,
      expires_at: result.expires_at as string,
    },
  };
}

async function requireStoredHandoffAttachment(handoffId: string, path: string) {
  if (!isOwnedHandoffMediaPath(handoffId, path)) {
    throw new Error('Invalid handoff attachment');
  }

  const name = path.split('/').pop();
  const { data: objects, error } = await supabaseAdmin.storage
    .from(PRIVATE_CHAT_MEDIA_BUCKET)
    .list(`handoff/${handoffId}`, { search: name });
  const object = objects?.find((item) => `handoff/${handoffId}/${item.name}` === path);
  if (error || !object) throw new Error('Handoff attachment was not uploaded');

  const media = parsePortalMediaInput({
    name: object.name,
    type: String(object.metadata?.mimetype || ''),
    size: Number(object.metadata?.size || 0),
  });
  if (!path.endsWith(`.${media.extension}`)) throw new Error('Handoff attachment type does not match');
}

async function signHandoffAttachment(path: string) {
  const objectPath = normalizeChatMediaObjectPath(path);
  if (!objectPath) return /^https?:\/\//i.test(path) ? path : '';
  let { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUrl(objectPath, 60 * 60);
  if (error || !data?.signedUrl) {
    ({ data, error } = await supabaseAdmin.storage.from('chat_media').createSignedUrl(objectPath, 60 * 60));
  }
  return error || !data?.signedUrl ? '' : data.signedUrl;
}

export async function verifyEscalationPin(
  ticketId: string,
  pin: string
): Promise<{ data: EscalationTicketRow & Record<string, unknown>; error?: never } | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;

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
      .select('id, handoff_id, status, reporter_name, notes, attachments, created_at')
      .eq('handoff_id', handoff.id)
      .order('created_at', { ascending: false });

    const signedMessages = await Promise.all((messages || []).map(async (message) => {
      if (message.message_type !== 'image' && message.message_type !== 'file') return message;
      const signedContent = await signHandoffAttachment(String(message.media_path || message.content || ''));
      return { ...message, content: signedContent };
    }));

    const signedReports = await Promise.all((reports || []).map(async (report) => ({
      ...report,
      attachments: await Promise.all(
        (Array.isArray(report.attachments) ? report.attachments : [])
          .map((path) => String(path))
          .map(signHandoffAttachment)
      ),
    })));

    return {
      data: { 
        ...ticketRow, 
        customers: customer, 
        organizations: organization, 
        logs, 
        messages: signedMessages,
        handoff,
        verifications,
        reports: signedReports
      } 
    };
  } catch (err: unknown) {
    console.error('[Escalation] Access verification failed', err);
    return { error: 'Escalation access check failed' };
  }
}

export async function claimEscalatedTicket(
  ticketId: string,
  pin: string,
  receiverName: string
): Promise<{ success: true; error?: never } | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;
    if (handoff.status !== 'Active') {
      return { error: 'This handoff has already been claimed or closed.' };
    }

    const { data, error } = await supabaseAdmin.rpc('claim_ticket_handoff', {
      p_handoff_id: handoff.id,
      p_receiver_name: receiverName.trim().slice(0, 200),
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result?.allowed) {
      return { error: result?.reason === 'not_active'
        ? 'This handoff has already been claimed or closed.'
        : 'Failed to claim escalation ticket' };
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('[Escalation] Claim failed', err);
    return { error: 'Failed to claim escalation ticket' };
  }
}

export async function updateEscalatedTicketStatus(
  ticketId: string,
  pin: string,
  newStatus: string,
  notes: string,
  receiverName?: string,
  attachmentPaths?: string[]
): Promise<{ success: true; error?: never } | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;
    if (!['Active', 'Claimed'].includes(handoff.status)) {
      return { error: 'This handoff is no longer open for updates.' };
    }
    const safeAttachmentPaths = (attachmentPaths || []).slice(0, 10);
    if (safeAttachmentPaths.length !== (attachmentPaths || []).length) {
      return { error: 'Too many attachments.' };
    }
    try {
      await Promise.all(safeAttachmentPaths.map((path) => requireStoredHandoffAttachment(handoff.id, path)));
    } catch {
      return { error: 'One or more attachments are invalid.' };
    }

    const nextStatus = sanitizeExternalStatus(newStatus);
    const reportText = buildExternalReport({
      receiverName: receiverName?.trim().slice(0, 200),
      status: nextStatus,
      notes: notes.trim().slice(0, 10000),
      attachmentUrls: safeAttachmentPaths,
    });
    const reporterName = receiverName?.trim().slice(0, 200) || handoff.assigned_to_external || 'External Team';
    const { data, error } = await supabaseAdmin.rpc('submit_ticket_handoff_report', {
      p_handoff_id: handoff.id,
      p_status: nextStatus,
      p_reporter_name: reporterName,
      p_notes: notes.trim().slice(0, 10000),
      p_attachments: safeAttachmentPaths,
      p_report_text: reportText,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result?.allowed) {
      return { error: result?.reason === 'not_active'
        ? 'This handoff is no longer open for updates.'
        : 'Failed to submit escalation report' };
    }

    if (result.assigned_agent_id) {
      try {
        await supabaseAdmin.from('notifications').insert([
          {
            user_id: result.assigned_agent_id,
            title: `Escalation update #${result.ticket_no}`,
            body: `External team returned work as ${nextStatus}. Owner review is required before final resolve.`,
            type: 'ticket',
            metadata: { ticket_id: result.ticket_id, ticket_no: result.ticket_no },
          },
        ]);
      } catch {
        // Notification failure should never block core workflow.
      }
    }

    return { success: true };
  } catch (err: unknown) {
    console.error('[Escalation] Report submission failed', err);
    return { error: 'Failed to submit escalation report' };
  }
}

export async function createEscalationAttachmentUpload(
  ticketId: string,
  pin: string,
  input: PortalMediaInput
): Promise<{
  path: string;
  uploadToken: string;
  contentType: string;
  error?: never;
} | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;
    if (!['Active', 'Claimed'].includes(handoff.status)) {
      return { error: 'This handoff is no longer open for attachments.' };
    }

    const media = parsePortalMediaInput(input);
    const path = createHandoffMediaPath(handoff.id, media.extension);
    const { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUploadUrl(path);
    if (error || !data) return { error: 'Failed to authorize attachment upload.' };
    return { path, uploadToken: data.token, contentType: media.contentType };
  } catch (err: unknown) {
    console.error('[Escalation] Attachment authorization failed', err);
    return { error: 'Failed to authorize attachment upload.' };
  }
}

export async function finalizeEscalationAttachment(
  ticketId: string,
  pin: string,
  path: string
): Promise<{ path: string; url: string; error?: never } | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;
    if (!['Active', 'Claimed'].includes(handoff.status)) {
      return { error: 'This handoff is no longer open for attachments.' };
    }

    await requireStoredHandoffAttachment(handoff.id, path);
    const url = await signHandoffAttachment(path);
    if (!url) return { error: 'Failed to finalize attachment upload.' };
    return { path, url };
  } catch (err: unknown) {
    console.error('[Escalation] Attachment finalization failed', err);
    return { error: 'Failed to finalize attachment upload.' };
  }
}

export async function regenerateEscalationLink(
  ticketId: string,
  pin: string
): Promise<{ success: true; token: string; pin: string; error?: never } | HandoffAccessError> {
  try {
    const redemption = await redeemActiveHandoff(ticketId, pin);
    if ('error' in redemption) return redemption;
    const handoff = redemption.handoff;
    if (!['Active', 'Claimed'].includes(handoff.status)) {
      return { error: 'This handoff is no longer open for regeneration.' };
    }

    const tokenToUse = crypto.randomUUID();
    const securePin = generateSecurePin();
    const pepper = requireHandoffAccessPepper();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    await supabaseAdmin
      .from('ticket_handoffs')
      .update({ status: 'Expired', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('ticket_id', handoff.ticket_id)
      .in('status', ['Active', 'Claimed']);

    const { error: insertError } = await supabaseAdmin
      .from('ticket_handoffs')
      .insert([{
        ticket_id: handoff.ticket_id,
        handoff_type: handoff.handoff_type,
        token: null,
        secure_pin: null,
        token_hash: hashHandoffCredential('token', tokenToUse, pepper),
        secure_pin_hash: hashHandoffCredential('pin', securePin, pepper),
        status: 'Active',
        created_by: handoff.created_by,
        expires_at: expiresAt,
      }]);

    if (insertError) {
      return { error: `Failed to create new handoff: ${insertError.message}` };
    }

    await supabaseAdmin
      .from('tickets')
      .update({ escalation_token: null, updated_at: new Date().toISOString() })
      .eq('id', handoff.ticket_id);

    return { 
      success: true, 
      token: tokenToUse, 
      pin: securePin 
    };
  } catch (err: unknown) {
    console.error('[Escalation] Link regeneration failed', err);
    return { error: 'Failed to regenerate magic link' };
  }
}
