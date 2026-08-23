'use server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { invalidateAllLiveCaches } from '@/lib/cache/liveCache';
import { invalidateAllPreviewCaches } from '@/lib/reports/previewCache';
import crypto from 'crypto';
import { generateSecurePin, hashHandoffCredential, requireHandoffAccessPepper } from '@/lib/handoff/handoffAccess';
import { requireStaffAuth } from '@/lib/auth/staffAuthorization';
import {
  assertStaffAttachmentOwnership,
  getInternalAttachmentMediaInfo,
  parseInternalAttachmentUpload,
  parseInternalTicketInput,
} from '@/lib/tickets/internalTicketSecurity';
import { PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import {
  parseTicketDetailAttachmentReference,
  parseTicketDetailFieldUpdate,
  parseTicketDetailId,
  parseTicketDetailMessage,
} from '@/lib/tickets/ticketDetailSecurity';
import { parseStaffId } from '@/lib/auth/staffManagement';

type TicketUpdatePayload = Record<string, string | null>;

const TICKET_DETAIL_SELECT = `
  id, ticket_no, customer_id, status, subject, description, priority, module,
  issue_type, created_at, resolved_at, assigned_agent_id, current_department_id,
  organization_id, resolution_summary, ai_analysis,
  customers:customers!tickets_customer_id_fkey (
    id, display_name, full_name, line_username,
    organizations:organizations(id, name)
  ),
  assigned_agent:profiles!assigned_agent_id (id, display_name:full_name),
  department_data:departments!current_department_id(id, name)
`;

async function resolveTicketConversation(ticketId: string, customerId: string | null) {
  const { data: byTicket } = await supabaseAdmin.from('conversations')
    .select('id, status').eq('current_ticket_id', ticketId).maybeSingle();
  if (byTicket?.status === 'active') return byTicket.id as string;
  if (!customerId) return null;
  const { data: byCustomer } = await supabaseAdmin.from('conversations')
    .select('id, status').eq('customer_id', customerId).eq('status', 'active').maybeSingle();
  return byCustomer?.status === 'active' ? byCustomer.id as string : null;
}

export async function getTicketDetailAction(value: unknown) {
  await requireStaffAuth({ permission: 'tickets', level: 'view' });
  const ticketId = parseTicketDetailId(value);
  const { data: ticket, error: ticketError } = await supabaseAdmin.from('tickets')
    .select(TICKET_DETAIL_SELECT).eq('id', ticketId).maybeSingle();
  if (ticketError) throw new Error('Failed to load ticket');
  if (!ticket) return null;

  const conversationId = await resolveTicketConversation(ticketId, ticket.customer_id);
  let messageQuery = supabaseAdmin.from('messages').select(
    'id, content, sender_type, staff_id, ticket_id, conversation_id, message_type, media_path, media_mime_type, created_at'
  );
  messageQuery = conversationId
    ? messageQuery.or(`ticket_id.eq.${ticketId},conversation_id.eq.${conversationId}`)
    : messageQuery.eq('ticket_id', ticketId);

  const [{ data: logs, error: logError }, { data: messages, error: messageError }] = await Promise.all([
    supabaseAdmin.from('ticket_logs')
      .select('id, created_at, action_type, to_status, note, performer_id')
      .eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    messageQuery.order('created_at', { ascending: true }),
  ]);
  if (logError || messageError) throw new Error('Failed to load ticket activity');

  const resolverId = logs?.find((log) => log.action_type === 'resolve')?.performer_id;
  const { data: resolver } = resolverId
    ? await supabaseAdmin.from('profiles').select('full_name, signature_url').eq('id', resolverId).maybeSingle()
    : { data: null };

  return { ticket, logs: logs || [], messages: messages || [], conversationId, resolver: resolver || null };
}

export async function getTicketDetailStaticMetaAction() {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'view' });
  const [departments, modules, issueTypes, company, profile] = await Promise.all([
    supabaseAdmin.from('departments').select('id, name')
      .eq('dept_type', 'organization').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_modules').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('ticket_issue_types').select('name').eq('is_active', true).order('name'),
    supabaseAdmin.from('company_settings').select('resolution_templates').limit(1).maybeSingle(),
    supabaseAdmin.from('profiles')
      .select('id, full_name, role, quick_replies, resolution_templates')
      .eq('id', user.id).maybeSingle(),
  ]);
  if (
    departments.error || modules.error || issueTypes.error ||
    company.error || profile.error || !profile.data
  ) {
    throw new Error('Failed to load ticket options');
  }
  const names = (rows: Array<{ name?: unknown }> | null) => (rows || [])
    .map((row) => typeof row.name === 'string' ? row.name : '')
    .filter(Boolean);
  const templates = (value: unknown) => Array.isArray(value)
    ? value.slice(0, 100).map((entry) =>
      typeof entry === 'string'
        ? entry
        : String((entry as Record<string, unknown> | null)?.content ?? '')
    ).filter(Boolean)
    : [];
  return {
    departments: (departments.data || []).map((row) => ({
      label: typeof row.name === 'string' ? row.name : '',
      value: String(row.id),
    })).filter((row) => row.label && row.value),
    modules: names(modules.data),
    issueTypes: names(issueTypes.data),
    user: {
      id: user.id,
      display_name: typeof profile.data.full_name === 'string' ? profile.data.full_name : null,
      role: typeof profile.data.role === 'string' ? profile.data.role : null,
    },
    quickReplies: templates(profile.data.quick_replies),
    personalResolutionTemplates: templates(profile.data.resolution_templates),
    companyResolutionTemplates: templates(company.data?.resolution_templates),
  };
}

export async function getTicketTransferTargetsAction() {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const [teamsResult, agentsResult] = await Promise.all([
    supabaseAdmin.from('teams').select('id, name').order('name'),
    supabaseAdmin.from('profiles')
      .select('id, full_name, username')
      .in('role', ['Agent', 'Administrator'])
      .neq('id', user.id)
      .order('full_name'),
  ]);
  if (teamsResult.error || agentsResult.error) {
    throw new Error('Failed to load transfer targets');
  }
  return {
    teams: (teamsResult.data || []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === 'string' ? row.name : null,
    })),
    agents: (agentsResult.data || []).map((row) => ({
      id: String(row.id),
      full_name: typeof row.full_name === 'string' ? row.full_name : null,
      username: typeof row.username === 'string' ? row.username : null,
    })),
  };
}

export async function getInternalTicketFormOptionsAction() {
  await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const [organizationsResult, subjectTypesResult] = await Promise.all([
    supabaseAdmin.from('organizations')
      .select('id, name, abbreviation')
      .eq('is_active', true)
      .order('name'),
    supabaseAdmin.from('ticket_subject_types')
      .select('name')
      .eq('is_active', true)
      .order('name'),
  ]);
  if (organizationsResult.error || subjectTypesResult.error) {
    throw new Error('Failed to load internal ticket options');
  }
  return {
    organizations: (organizationsResult.data || []).map((row) => ({
      id: String(row.id),
      name: typeof row.name === 'string' ? row.name : '',
      abbreviation: typeof row.abbreviation === 'string' ? row.abbreviation : null,
    })).filter((row) => row.id && row.name),
    subjectTypes: (subjectTypesResult.data || [])
      .map((row) => typeof row.name === 'string' ? row.name : '')
      .filter(Boolean),
  };
}

export async function updateTicketDetailFieldAction(ticketValue: unknown, fieldValue: unknown, rawValue: unknown) {
  await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const ticketId = parseTicketDetailId(ticketValue);
  const update = parseTicketDetailFieldUpdate(fieldValue, rawValue);
  if (update.field === 'current_department_id') {
    const { data } = await supabaseAdmin.from('departments').select('id')
      .eq('id', update.value).eq('is_active', true).maybeSingle();
    if (!data) throw new Error('Department not found');
  }
  const { data, error } = await supabaseAdmin.from('tickets')
    .update({ [update.field]: update.value, updated_at: new Date().toISOString() })
    .eq('id', ticketId).select('id, priority, current_department_id, module').single();
  if (error || !data) throw new Error('Failed to update ticket');
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return data;
}

export async function sendTicketDetailMessageAction(ticketValue: unknown, value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const ticketId = parseTicketDetailId(ticketValue);
  const input = parseTicketDetailMessage(value);
  const { data: ticket } = await supabaseAdmin.from('tickets').select('id, customer_id').eq('id', ticketId).maybeSingle();
  if (!ticket) throw new Error('Ticket not found');

  if (input.conversationId) {
    const { data: conversation } = await supabaseAdmin.from('conversations')
      .select('id, customer_id, current_ticket_id').eq('id', input.conversationId).maybeSingle();
    if (!conversation || (conversation.current_ticket_id !== ticketId && conversation.customer_id !== ticket.customer_id)) {
      throw new Error('Conversation does not belong to ticket');
    }
  }

  const { data: message, error } = await supabaseAdmin.from('messages').insert([{
    conversation_id: input.conversationId,
    ticket_id: ticketId,
    sender_type: 'agent',
    staff_id: user.id,
    message_type: 'text',
    content: input.content,
  }]).select('id, content, sender_type, staff_id, ticket_id, conversation_id, message_type, created_at').single();
  if (error || !message) throw new Error('Failed to send message');
  if (input.conversationId) {
    await supabaseAdmin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', input.conversationId);
  }
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return message;
}

export async function createTicketDetailAttachmentUploadAction(ticketValue: unknown, value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const ticketId = parseTicketDetailId(ticketValue);
  const input = parseInternalAttachmentUpload(value);
  const { data: ticket } = await supabaseAdmin.from('tickets').select('id').eq('id', ticketId).maybeSingle();
  if (!ticket) throw new Error('Ticket not found');

  const path = `staff/${user.id}/tickets/${ticketId}/${crypto.randomUUID()}.${input.extension}`;
  const { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data?.token) throw new Error('Failed to authorize attachment upload');
  return { path, token: data.token };
}

export async function sendTicketDetailAttachmentAction(ticketValue: unknown, value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const ticketId = parseTicketDetailId(ticketValue);
  const input = parseTicketDetailAttachmentReference(value, user.id, ticketId);
  const media = getInternalAttachmentMediaInfo(input.path);
  await assertUploadedAttachmentsExist([input.path]);

  const { data: ticket } = await supabaseAdmin.from('tickets').select('id, customer_id').eq('id', ticketId).maybeSingle();
  if (!ticket) {
    await removeInternalTicketDrafts([input.path]);
    throw new Error('Ticket not found');
  }
  if (input.conversationId) {
    const { data: conversation } = await supabaseAdmin.from('conversations')
      .select('id, customer_id, current_ticket_id').eq('id', input.conversationId).maybeSingle();
    if (!conversation || (conversation.current_ticket_id !== ticketId && conversation.customer_id !== ticket.customer_id)) {
      await removeInternalTicketDrafts([input.path]);
      throw new Error('Conversation does not belong to ticket');
    }
  }

  const { data: message, error } = await supabaseAdmin.from('messages').insert([{
    conversation_id: input.conversationId,
    ticket_id: ticketId,
    sender_type: 'agent',
    staff_id: user.id,
    message_type: media.messageType,
    content: media.content,
    media_path: input.path,
    media_mime_type: media.mimeType,
  }]).select('id, content, sender_type, staff_id, ticket_id, conversation_id, message_type, media_path, media_mime_type, created_at').single();
  if (error || !message) {
    await removeInternalTicketDrafts([input.path]);
    throw new Error('Failed to save attachment message');
  }
  if (input.conversationId) {
    await supabaseAdmin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', input.conversationId);
  }
  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return message;
}

export async function createInternalTicketAttachmentUploadAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const input = parseInternalAttachmentUpload(value);
  const path = `staff/${user.id}/drafts/${crypto.randomUUID()}.${input.extension}`;
  const { data, error } = await supabaseAdmin.storage
    .from(PRIVATE_CHAT_MEDIA_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data?.token) throw new Error('Failed to authorize attachment upload');
  return { path, token: data.token };
}

async function assertUploadedAttachmentsExist(paths: readonly string[]) {
  await Promise.all(paths.map(async (path) => {
    const slash = path.lastIndexOf('/');
    const directory = path.slice(0, slash);
    const filename = path.slice(slash + 1);
    const { data, error } = await supabaseAdmin.storage
      .from(PRIVATE_CHAT_MEDIA_BUCKET)
      .list(directory, { search: filename, limit: 2 });
    if (error || !data?.some((object) => object.name === filename)) {
      throw new Error('Attachment upload is incomplete');
    }
  }));
}

async function removeInternalTicketDrafts(paths: readonly string[]) {
  if (paths.length > 0) {
    await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).remove([...paths]);
  }
}

export async function createInternalTicketAction(value: unknown) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const input = parseInternalTicketInput(value);
  assertStaffAttachmentOwnership(input.attachmentPaths, user.id);
  await assertUploadedAttachmentsExist(input.attachmentPaths);

  const [{ data: profile, error: profileError }, { data: organization, error: organizationError }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, full_name').eq('id', user.id).single(),
    supabaseAdmin.from('organizations').select('id').eq('id', input.organizationId).eq('is_active', true).maybeSingle(),
  ]);
  if (profileError || !profile) {
    await removeInternalTicketDrafts(input.attachmentPaths);
    throw new Error('Staff profile not found');
  }
  if (organizationError || !organization) {
    await removeInternalTicketDrafts(input.attachmentPaths);
    throw new Error('Organization not found');
  }

  const staffCustomerKey = `staff_${user.id}`;
  const customerResult = await supabaseAdmin
    .from('customers').select('id').eq('line_user_id', staffCustomerKey).maybeSingle();
  let customer = customerResult.data;
  if (customerResult.error) {
    await removeInternalTicketDrafts(input.attachmentPaths);
    throw new Error('Failed to load internal customer');
  }
  if (!customer) {
    const created = await supabaseAdmin.from('customers').insert([{
      line_user_id: staffCustomerKey,
      display_name: `${profile.full_name || 'Staff'} (Internal)`,
      full_name: profile.full_name || 'Internal Staff',
      organization_id: input.organizationId,
    }]).select('id').single();
    if (created.error || !created.data) {
      const retry = await supabaseAdmin.from('customers').select('id').eq('line_user_id', staffCustomerKey).maybeSingle();
      if (retry.error || !retry.data) {
        await removeInternalTicketDrafts(input.attachmentPaths);
        throw new Error('Failed to create internal customer');
      }
      customer = retry.data;
    } else {
      customer = created.data;
    }
  }

  const { data: slaRule } = await supabaseAdmin
    .from('sla_rules')
    .select('response_time_minutes, resolution_time_minutes')
    .eq('priority', input.priority)
    .maybeSingle();
  const durationMinutes = slaRule?.resolution_time_minutes || slaRule?.response_time_minutes || 60;
  const slaDueAt = calculateSlaDeadline(new Date(), durationMinutes).toISOString();
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const ticketNo = `TIC-${datePart}-${crypto.randomInt(100_000, 1_000_000)}`;

  const { data: ticket, error: ticketError } = await supabaseAdmin.from('tickets').insert([{
    ticket_no: ticketNo,
    customer_id: customer.id,
    organization_id: input.organizationId,
    subject: `[Private] ${input.subject}`,
    description: input.description || input.subject,
    status: 'New',
    priority: input.priority,
    assigned_agent_id: user.id,
    source: 'Internal',
    sla_due_at: slaDueAt,
  }]).select('id, ticket_no').single();
  if (ticketError || !ticket) {
    await removeInternalTicketDrafts(input.attachmentPaths);
    throw new Error('Failed to create internal ticket');
  }

  try {
    const note = input.attachmentPaths.length > 0
      ? `Internal Ticket created with ${input.attachmentPaths.length} attachments.`
      : `Internal Ticket created by ${profile.full_name || 'Staff'}`;
    const { error: logError } = await supabaseAdmin.from('ticket_logs').insert([{
      ticket_id: ticket.id,
      action_type: 'create',
      performer_id: user.id,
      note,
    }]);
    if (logError) throw logError;

    if (input.attachmentPaths.length > 0) {
      const { error: messageError } = await supabaseAdmin.from('messages').insert(
        input.attachmentPaths.map((path) => {
          const media = getInternalAttachmentMediaInfo(path);
          return {
            ticket_id: ticket.id,
            sender_type: 'system',
            staff_id: user.id,
            content: media.content,
            media_path: path,
            media_mime_type: media.mimeType,
            message_type: media.messageType,
          };
        })
      );
      if (messageError) throw messageError;
    }
  } catch {
    await supabaseAdmin.from('tickets').delete().eq('id', ticket.id);
    await removeInternalTicketDrafts(input.attachmentPaths);
    throw new Error('Failed to finalize internal ticket');
  }

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return ticket;
}

export async function claimTicketServerAction(ticketId: string) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const agentId = user.id;

  const { data, error } = await supabaseAdmin.rpc('claim_ticket_secure', {
    p_ticket_id: ticketId,
    p_agent_id: agentId
  });

  if (error) throw new Error(error.message);

  const result = data as { ticket: Record<string, unknown>; conversationId: string | null };

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  
  return { ticket: result.ticket, conversationId: result.conversationId };
}

async function createHandoffRecord(
  ticketId: string,
  status: 'Escalated' | 'Pending',
  agentId: string,
  expiresInHours?: number
) {
  const validExpiresInHours = expiresInHours ?? 72;
  if (!Number.isSafeInteger(validExpiresInHours) || validExpiresInHours < 1 || validExpiresInHours > 720) {
    throw new Error('Handoff expiry must be between 1 and 720 hours');
  }
  const tokenToUse = crypto.randomUUID();
  const securePin = generateSecurePin();
  const pepper = requireHandoffAccessPepper();
  const expiresAt = new Date(Date.now() + validExpiresInHours * 60 * 60 * 1000).toISOString();

  // Mark previous active handoffs for this ticket as Expired
  await supabaseAdmin
    .from('ticket_handoffs')
    .update({ status: 'Expired', revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('ticket_id', ticketId)
    .in('status', ['Active', 'Claimed']);

  const { error } = await supabaseAdmin
    .from('ticket_handoffs')
    .insert([{
      ticket_id: ticketId,
      handoff_type: status,
      token: null,
      secure_pin: null,
      token_hash: hashHandoffCredential('token', tokenToUse, pepper),
      secure_pin_hash: hashHandoffCredential('pin', securePin, pepper),
      status: 'Active',
      created_by: agentId,
      expires_at: expiresAt,
    }]);

  if (error) {
    console.error('Error inserting handoff record:', error);
    throw new Error('Failed to create secure handoff');
  }
  return { token: tokenToUse, pin: securePin };
}

export async function updateTicketStatusAction(
  ticketId: string,
  newStatus: string,
  note?: string,
  _escalationToken?: string,
  expiresInHours?: number
) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
  const agentId = user.id;

  const { data: currentTicket } = await supabaseAdmin
    .from('tickets')
    .select('status')
    .eq('id', ticketId)
    .single();

  const updateData: TicketUpdatePayload = { 
    status: newStatus,
    updated_at: new Date().toISOString()
  };

  let handoffInfo: { token: string; pin: string } | null = null;
  if (['Escalated', 'Pending'].includes(newStatus)) {
    handoffInfo = await createHandoffRecord(ticketId, newStatus as 'Escalated' | 'Pending', agentId, expiresInHours);
    updateData.escalation_token = null;
  }

  const { data: ticket, error: updateError } = await supabaseAdmin
    .from('tickets')
    .update(updateData)
    .eq('id', ticketId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  // v3.0: Automatically close active conversations if ticket is Resolved, Escalated or Pending
  if (['Resolved', 'Escalated', 'Pending'].includes(newStatus)) {
    await supabaseAdmin
      .from('conversations')
      .update({ 
        status: 'closed',
        current_ticket_id: null 
      })
      .eq('current_ticket_id', ticketId)
      .eq('status', 'active');
  }

  await supabaseAdmin.from('ticket_logs').insert([{
    ticket_id: ticketId,
    action_type: 'status_change',
    from_status: currentTicket?.status,
    to_status: newStatus,
    performer_id: agentId,
    note: note || `Status changed to ${newStatus}`
  }]);

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();

  return {
    ...ticket,
    escalation_token: handoffInfo?.token,
    escalation_pin: handoffInfo?.pin
  };
}

export async function transferTicketAction(ticketId: string, toAgentId?: string, toTeamId?: string, reason?: string) {
   const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
   const fromAgentId = user.id;
   const validTicketId = parseTicketDetailId(ticketId);
   const validAgentId = toAgentId ? parseStaffId({ id: toAgentId }) : undefined;
   const validTeamId = toTeamId ? parseStaffId({ id: toTeamId }) : undefined;
   if (!validAgentId && !validTeamId) throw new Error('A transfer target is required');

   const [ticketResult, agentResult, teamResult] = await Promise.all([
     supabaseAdmin.from('tickets').select('id').eq('id', validTicketId).maybeSingle(),
     validAgentId
       ? supabaseAdmin.from('profiles').select('id').eq('id', validAgentId)
         .in('role', ['Agent', 'Administrator']).maybeSingle()
       : Promise.resolve({ data: null, error: null }),
     validTeamId
       ? supabaseAdmin.from('teams').select('id').eq('id', validTeamId).maybeSingle()
       : Promise.resolve({ data: null, error: null }),
   ]);
   if (ticketResult.error || !ticketResult.data) throw new Error('Ticket not found');
   if (validAgentId && (agentResult.error || !agentResult.data)) throw new Error('Transfer agent not found');
   if (validTeamId && (teamResult.error || !teamResult.data)) throw new Error('Transfer team not found');

   const updateData: TicketUpdatePayload = { 
     updated_at: new Date().toISOString(),
     status: 'Escalated' 
   };
   if (validAgentId) updateData.assigned_agent_id = validAgentId;
   if (validTeamId) updateData.assigned_team_id = validTeamId;

   const { data: ticket, error: transferError } = await supabaseAdmin
     .from('tickets')
     .update(updateData)
     .eq('id', validTicketId)
     .select()
     .single();

   if (transferError) throw new Error(transferError.message);

   const handoff = await createHandoffRecord(validTicketId, 'Escalated', fromAgentId);

   await supabaseAdmin.from('ticket_logs').insert([{
     ticket_id: validTicketId,
     action_type: 'transfer',
     to_status: 'Escalated',
     performer_id: fromAgentId,
     to_user_id: validAgentId,
     to_team_id: validTeamId,
     note: reason || 'Ticket transferred securely'
   }]);

   // v3.1: Close active conversations on transfer (since status becomes Escalated)
   await supabaseAdmin
     .from('conversations')
     .update({ 
       status: 'closed',
       current_ticket_id: null 
     })
     .eq('current_ticket_id', validTicketId)
     .eq('status', 'active');

   invalidateAllLiveCaches();
   invalidateAllPreviewCaches();
   
   return {
     ...ticket,
     escalation_token: handoff.token,
     escalation_pin: handoff.pin
   };
}

export async function resolveTicketAction(
   ticketId: string, 
   resolutionSummary: string, 
   module?: string, 
   issueType?: string,
   conversationId?: string
) {
   const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });
   const agentId = user.id;

   // Query current status of the ticket
   const { data: currentTicket, error: fetchError } = await supabaseAdmin
     .from('tickets')
     .select('status')
     .eq('id', ticketId)
     .single();

   if (fetchError || !currentTicket) {
     throw new Error('ไม่พบข้อมูลใบงานในระบบ');
   }

   const currentStatus = currentTicket.status;
   let targetStatus = 'Resolved';

   // Special routing: Escalated or Pending tickets go to Fix Completed first
   if (currentStatus === 'Escalated' || currentStatus === 'Pending') {
     targetStatus = 'Fix Completed';
   }

   const updateData: TicketUpdatePayload = { 
     status: targetStatus,
     resolved_at: targetStatus === 'Resolved' ? new Date().toISOString() : null,
     resolution_summary: resolutionSummary,
     updated_at: new Date().toISOString()
   };

   if (module) updateData.module = module;
   if (issueType) updateData.issue_type = issueType;

    let ticket, resolveError;
    try {
      const result = await supabaseAdmin
        .from('tickets')
        .update(updateData)
        .eq('id', ticketId)
        .select()
        .single();
      ticket = result.data;
      resolveError = result.error;
    } catch (e: unknown) {
      console.error('[ResolveAction] Unexpected Database Error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(`เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล: ${errorMessage}`);
    }

    if (resolveError) {
      console.error('[ResolveAction] DB Update Error:', resolveError);
      if (resolveError.code === '22P02') {
        throw new Error(`ประเภทงาน "${issueType}" ไม่สอดคล้องกับค่าที่ฐานข้อมูลยอมรับ (Enum Mismatch) กรุณาตรวจสอบและรันสคริปต์ SQL Migration`);
      }
      throw new Error(resolveError.message);
    }

   try {
      // Record Log
      await supabaseAdmin.from('ticket_logs').insert([{
        ticket_id: ticketId,
        action_type: 'resolve',
        from_status: currentStatus,
        to_status: targetStatus,
        performer_id: agentId,
        note: resolutionSummary
      }]);

     // Only handle CSAT and Conversations if there is a customer linked
     if (ticket?.customer_id) {
        // 1. Send CSAT Survey (Silent fail - don't block resolution)
        try {
          await supabaseAdmin.from('csat_surveys').upsert({
             ticket_id: ticketId,
             sent_at: new Date().toISOString()
          }, { onConflict: 'ticket_id' });
        } catch (csatErr) {
          console.error('[ResolveAction] Silent CSAT Error:', csatErr);
        }

         // 2. Close only the conversation that belongs to this ticket resolution if NOT going to Fix Completed.
         // Never close every active conversation of the same customer.
         if (targetStatus !== 'Fix Completed') {
           if (conversationId) {
             await supabaseAdmin
               .from('conversations')
               .update({
                 status: 'closed',
                 current_ticket_id: null,
               })
               .eq('id', conversationId)
               .eq('status', 'active');
           } else {
             await supabaseAdmin
               .from('conversations')
               .update({
                 status: 'closed',
                 current_ticket_id: null,
               })
               .eq('current_ticket_id', ticketId)
               .eq('status', 'active');
           }
         }
     }

     // 3. Send system message if requested (Atomic)
     if (conversationId) {
        const surveyPath = `/portal?survey_ticket_id=${encodeURIComponent(ticketId)}`;
        const content = `[SYSTEM] Resolution completed: ${resolutionSummary}\nModule: ${module || 'N/A'}\nSurvey: ${surveyPath}`;
        await supabaseAdmin.from('messages').insert([{
           conversation_id: conversationId,
           ticket_id: ticketId,
           sender_type: 'system',
           content: content,
           staff_id: agentId,
           message_type: 'text'
        }]);
     }
   } catch (postError) {
     // Even if logs/CSAT/conv fails, we already updated the ticket status.
     // We log it but don't necessarily crash the whole resolve action.
     console.error('[ResolveAction] Post-update processing error:', postError);
   }

    // Record QA Approval verification if transitioning from Fix Completed
    if (currentStatus === 'Fix Completed') {
      try {
        const { data: activeHandoff } = await supabaseAdmin
          .from('ticket_handoffs')
          .select('id')
          .eq('ticket_id', ticketId)
          .eq('status', 'Active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabaseAdmin.from('ticket_verifications').insert([{
          ticket_id: ticketId,
          reviewer_id: agentId,
          decision: 'Approved',
          feedback_notes: resolutionSummary || null,
          handoff_id: activeHandoff?.id || null
        }]);

        if (activeHandoff) {
          await supabaseAdmin
            .from('ticket_handoffs')
            .update({ status: 'Completed', updated_at: new Date().toISOString() })
            .eq('id', activeHandoff.id);
        }
      } catch (verError) {
        console.error('[ResolveAction] Failed to record QA approval verification:', verError);
      }
    }

    invalidateAllLiveCaches();
    invalidateAllPreviewCaches();
    return ticket;
}

export async function reviewFixCompletedAction(
  ticketId: string,
  decision: 'accept' | 'reject',
  note?: string
) {
  const { user } = await requireStaffAuth({ permission: 'tickets', level: 'edit' });

  const { data: currentTicket, error: currentError } = await supabaseAdmin
    .from('tickets')
    .select('id, status, assigned_agent_id')
    .eq('id', ticketId)
    .single();

  if (currentError || !currentTicket) {
    throw new Error(currentError?.message || 'Ticket not found');
  }

  if (currentTicket.status !== 'Fix Completed') {
    throw new Error('Ticket is not in Fix Completed state');
  }

  if (decision === 'accept') {
    // Accept path intentionally keeps flow on existing resolve modal.
    return currentTicket;
  }

  // 1. Find the active handoff and previous status before it transitioned to 'Fix Completed'
  const { data: activeHandoff } = await supabaseAdmin
    .from('ticket_handoffs')
    .select('id, handoff_type')
    .eq('ticket_id', ticketId)
    .eq('status', 'Active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: lastFixLog } = await supabaseAdmin
    .from('ticket_logs')
    .select('from_status')
    .eq('ticket_id', ticketId)
    .eq('to_status', 'Fix Completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const targetStatus = activeHandoff?.handoff_type || lastFixLog?.from_status || 'In Progress';

  // 2. Record QA Rejection verification
  await supabaseAdmin.from('ticket_verifications').insert([{
    ticket_id: ticketId,
    reviewer_id: user.id,
    decision: 'Rejected',
    feedback_notes: note || null,
    handoff_id: activeHandoff?.id || null
  }]);

  // 3. Mark active handoff as Rejected
  if (activeHandoff) {
    await supabaseAdmin
      .from('ticket_handoffs')
      .update({ status: 'Rejected', updated_at: new Date().toISOString() })
      .eq('id', activeHandoff.id);
  }

  const { data: updated, error: updateError } = await supabaseAdmin
    .from('tickets')
    .update({
      status: targetStatus,
      resolved_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ticketId)
    .select()
    .single();

  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin.from('ticket_logs').insert([
    {
      ticket_id: ticketId,
      action_type: 'status_change',
      from_status: 'Fix Completed',
      to_status: targetStatus,
      performer_id: user.id,
      note: note?.trim() || `Owner requested more work after verification review, returned to ${targetStatus}`,
    },
  ]);

  if (currentTicket.assigned_agent_id && currentTicket.assigned_agent_id !== user.id) {
    await supabaseAdmin.from('notifications').insert([
      {
        user_id: currentTicket.assigned_agent_id,
        title: `Ticket ${ticketId} returned for rework`,
        body: note?.trim() || `Owner requested more work after verification review. Status returned to ${targetStatus}`,
        type: 'ticket',
        metadata: { ticket_id: ticketId, decision: 'reject', return_status: targetStatus },
      },
    ]);
  }

  invalidateAllLiveCaches();
  invalidateAllPreviewCaches();
  return updated;
}
