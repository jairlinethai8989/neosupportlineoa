'use server';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyLineIdToken, type TrustedLineIdentity } from '@/lib/portal/lineIdentity';
import { parsePortalTicketInput, type PortalTicketInput } from '@/lib/portal/portalTicketInput';
import { createPortalMediaPath, isOwnedPortalMediaPath, parsePortalMediaInput, type PortalMediaInput } from '@/lib/portal/portalMedia';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import { normalizeChatMediaObjectPath, PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';

type PortalHomeCustomer = {
  id: string;
  display_name: string | null;
  full_name: string | null;
  line_username: string | null;
  organization_id: string | null;
  department_id: string | null;
  position_id: string | null;
  organizations: { name?: string | null; abbreviation?: string | null } | null;
};

type PortalSyncCustomer = {
  id: string;
  line_user_id: string;
  display_name: string | null;
  avatar_url?: string | null;
};

const PORTAL_HOME_CUSTOMER_SELECT =
  'id, display_name, full_name, line_username, organization_id, department_id, position_id, organizations(name, abbreviation)';

async function requireTrustedLineIdentity(lineIdToken: string) {
  const lineLoginChannelId = process.env.LINE_LOGIN_CHANNEL_ID;
  if (!lineLoginChannelId) {
    throw new Error('LINE Login channel is not configured');
  }

  return verifyLineIdToken(lineIdToken, lineLoginChannelId);
}

async function syncVerifiedPortalCustomer<T extends Record<string, unknown>>(
  identity: TrustedLineIdentity,
  select: string,
  fallbackSelect: string = select
): Promise<T> {
  const profile = {
    line_user_id: identity.lineUserId,
    display_name: identity.displayName || 'LINE Customer',
    avatar_url: identity.pictureUrl,
    metadata: {
      line_profile: {
        display_name: identity.displayName,
        picture_url: identity.pictureUrl,
        synced_at: new Date().toISOString(),
      },
    },
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('customers')
    .upsert(profile, { onConflict: 'line_user_id' })
    .select(select)
    .single();

  if (error?.code === 'PGRST204' && String(error.message || '').includes('avatar_url')) {
    const fallbackProfile = {
      line_user_id: profile.line_user_id,
      display_name: profile.display_name,
      metadata: profile.metadata,
      updated_at: profile.updated_at,
    };
    const fallback = await supabaseAdmin
      .from('customers')
      .upsert(fallbackProfile, { onConflict: 'line_user_id' })
      .select(fallbackSelect)
      .single();
    if (fallback.error) throw new Error('Failed to sync customer profile');
    return fallback.data as unknown as T;
  }

  if (error || !data) throw new Error('Failed to sync customer profile');
  return data as unknown as T;
}

async function findOrCreatePortalHomeCustomer(identity: TrustedLineIdentity): Promise<PortalHomeCustomer> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select(PORTAL_HOME_CUSTOMER_SELECT)
    .eq('line_user_id', identity.lineUserId)
    .maybeSingle();

  if (error) throw new Error('Failed to load portal customer');
  if (data) return data as unknown as PortalHomeCustomer;

  return syncVerifiedPortalCustomer<PortalHomeCustomer>(identity, PORTAL_HOME_CUSTOMER_SELECT);
}

async function requirePortalCustomer(lineIdToken: string) {
  const identity = await requireTrustedLineIdentity(lineIdToken);
  const { data: customer, error } = await supabaseAdmin
    .from('customers')
    .select('id, display_name, organization_id, department_id')
    .eq('line_user_id', identity.lineUserId)
    .single();

  if (error || !customer) {
    throw new Error('Unauthorized: Customer not found');
  }

  return customer;
}

async function requireOwnedTicket(customerId: string, ticketId: string) {
  const { data: ticket, error } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, ticket_no, status')
    .eq('id', ticketId)
    .single();

  if (error || !ticket) {
    throw new Error('Ticket not found');
  }
  if (ticket.customer_id !== customerId) {
    throw new Error('Unauthorized: You do not own this ticket');
  }

  return ticket;
}

const DONE_STATUSES = ['Resolved', 'Closed', 'Canceled', 'Fix Completed', 'resolved', 'closed', 'canceled', 'fix completed'];

async function signPortalMessageContent(message: Record<string, unknown>) {
  const content = String(message.content || '');
  if (message.message_type === 'text') return message;

  const rawMedia = String(message.media_path || content);
  const path = normalizeChatMediaObjectPath(rawMedia);
  if (!path) {
    return /^https?:\/\//i.test(rawMedia) ? { ...message, content: rawMedia } : { ...message, content: '' };
  }

  let { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data?.signedUrl) {
    ({ data, error } = await supabaseAdmin.storage.from('chat_media').createSignedUrl(path, 60 * 60));
  }
  return { ...message, content: error || !data?.signedUrl ? '' : data.signedUrl };
}

export async function getPortalHomeAction(
  lineIdToken: string,
  options: { historyPage?: number; search?: string; directSurveyTicketId?: string | null } = {}
) {
  const identity = await requireTrustedLineIdentity(lineIdToken);
  const customer = await findOrCreatePortalHomeCustomer(identity);
  const page = Math.max(1, Math.min(10000, Math.trunc(options.historyPage || 1)));
  const from = (page - 1) * 5;
  const search = String(options.search || '').trim().slice(0, 100).replace(/[^\p{L}\p{N}\s_-]/gu, '');

  let pastQuery = supabaseAdmin
    .from('tickets')
    .select('id, ticket_no, subject, status, created_at, resolved_at', { count: 'exact' })
    .eq('customer_id', customer.id)
    .in('status', DONE_STATUSES);
  if (search) pastQuery = pastQuery.or(`ticket_no.ilike.%${search}%,subject.ilike.%${search}%`);

  const [activeResult, pastResult, surveyCandidatesResult] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, status, created_at, resolved_at')
      .eq('customer_id', customer.id)
      .not('status', 'in', `(${DONE_STATUSES.map((status) => `"${status}"`).join(',')})`)
      .order('created_at', { ascending: false }),
    pastQuery.order('created_at', { ascending: false }).range(from, from + 4),
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, status, created_at, resolved_at')
      .eq('customer_id', customer.id)
      .in('status', ['Resolved', 'Closed', 'Fix Completed', 'resolved', 'closed', 'fix completed'])
      .order('resolved_at', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  if (activeResult.error || pastResult.error || surveyCandidatesResult.error) {
    throw new Error('Failed to load portal tickets');
  }

  const candidates = surveyCandidatesResult.data || [];
  const candidateIds = candidates.map((ticket) => ticket.id);
  const { data: surveys, error: surveyError } = candidateIds.length
    ? await supabaseAdmin.from('csat_surveys').select('ticket_id, score, rating, responded_at').in('ticket_id', candidateIds)
    : { data: [], error: null };
  if (surveyError) throw new Error('Failed to load portal survey state');

  const completedSurveyIds = new Set((surveys || []).filter((row) => row.responded_at || row.score || row.rating).map((row) => row.ticket_id));
  let pendingSurvey = candidates.find((ticket) => !completedSurveyIds.has(ticket.id)) || null;
  if (options.directSurveyTicketId) {
    pendingSurvey = candidates.find((ticket) => ticket.id === options.directSurveyTicketId && !completedSurveyIds.has(ticket.id)) || pendingSurvey;
  }

  return {
    customer,
    activeTickets: activeResult.data || [],
    pastTickets: pastResult.data || [],
    totalHistory: pastResult.count || 0,
    pendingSurvey,
  };
}

export async function getPortalTicketDetailAction(ticketId: string, lineIdToken: string) {
  const customer = await requirePortalCustomer(lineIdToken);
  await requireOwnedTicket(customer.id, ticketId);

  const [ticketResult, conversationResult, logsResult, surveyResult] = await Promise.all([
    supabaseAdmin
      .from('tickets')
      .select('id, ticket_no, subject, description, module, status, priority, created_at, resolved_at, assigned_agent_id')
      .eq('id', ticketId)
      .single(),
    supabaseAdmin
      .from('conversations')
      .select('id')
      .eq('current_ticket_id', ticketId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('ticket_logs')
      .select('id, created_at, action_type, to_status')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('csat_surveys')
      .select('score, rating, responded_at')
      .eq('ticket_id', ticketId)
      .maybeSingle(),
  ]);
  if (ticketResult.error || conversationResult.error || logsResult.error || surveyResult.error) {
    throw new Error('Failed to load portal ticket');
  }

  const conversationId = conversationResult.data?.id || null;
  let messagesQuery = supabaseAdmin
    .from('messages')
    .select('id, content, sender_type, message_type, media_path, created_at, ticket_id, conversation_id');
  messagesQuery = conversationId
    ? messagesQuery.or(`ticket_id.eq.${ticketId},conversation_id.eq.${conversationId}`)
    : messagesQuery.eq('ticket_id', ticketId);
  const { data: messages, error: messagesError } = await messagesQuery.order('created_at', { ascending: true });
  if (messagesError) throw new Error('Failed to load portal messages');

  const signedMessages = await Promise.all((messages || []).map((message) => signPortalMessageContent(message)));
  const score = surveyResult.data?.score || surveyResult.data?.rating || 0;
  return {
    ticket: ticketResult.data,
    conversationId,
    logs: logsResult.data || [],
    messages: signedMessages,
    survey: { responded: Boolean(surveyResult.data?.responded_at || score), score },
  };
}

export async function getPortalCreateOptionsAction(lineIdToken: string) {
  const customer = await requirePortalCustomer(lineIdToken);
  if (!customer.organization_id) return { registered: false, subjects: [] as string[] };
  const { data, error } = await supabaseAdmin.from('ticket_subject_types').select('name').eq('is_active', true).order('name');
  if (error) throw new Error('Failed to load ticket subjects');
  return { registered: true, subjects: (data || []).map((row) => row.name) };
}

export async function getPortalProfileOptionsAction(lineIdToken: string) {
  await requireTrustedLineIdentity(lineIdToken);
  const [organizations, departments, positions] = await Promise.all([
    supabaseAdmin.from('organizations').select('id, name').order('name'),
    supabaseAdmin.from('departments').select('id, name').eq('dept_type', 'organization').eq('is_active', true).order('name'),
    supabaseAdmin.from('positions').select('id, name').order('name'),
  ]);
  if (organizations.error || departments.error || positions.error) throw new Error('Failed to load profile options');
  return { organizations: organizations.data || [], departments: departments.data || [], positions: positions.data || [] };
}

export async function savePortalProfileAction(lineIdToken: string, input: { displayName: string; organizationId: string; departmentId: string; positionId: string }) {
  const identity = await requireTrustedLineIdentity(lineIdToken);
  const displayName = String(input.displayName || '').trim().slice(0, 200);
  if (!displayName || !input.organizationId || !input.departmentId || !input.positionId) throw new Error('Profile information is incomplete');
  const { error } = await supabaseAdmin.from('customers').upsert({
    line_user_id: identity.lineUserId,
    display_name: displayName,
    full_name: displayName,
    line_username: identity.displayName || null,
    organization_id: input.organizationId,
    department_id: input.departmentId,
    position_id: input.positionId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'line_user_id' });
  if (error) throw new Error('Failed to save customer profile');
}

export async function createPortalMediaUploadAction(ticketId: string, lineIdToken: string, input: PortalMediaInput) {
  const customer = await requirePortalCustomer(lineIdToken);
  await requireOwnedTicket(customer.id, ticketId);
  const media = parsePortalMediaInput(input);
  const path = createPortalMediaPath(ticketId, media.extension);
  const { data, error } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error('Failed to authorize attachment upload');
  return { path, token: data.token, contentType: media.contentType, messageType: media.messageType };
}

async function insertPortalMessage(ticketId: string, customerId: string, content: string, messageType: 'text' | 'image' | 'file') {
  const { data: conversation } = await supabaseAdmin.from('conversations').select('id').eq('current_ticket_id', ticketId).maybeSingle();
  const { data: message, error } = await supabaseAdmin.from('messages').insert({
    ticket_id: ticketId,
    conversation_id: conversation?.id || null,
    sender_type: 'customer',
    customer_id: customerId,
    content,
    message_type: messageType,
  }).select('id, content, sender_type, message_type, created_at, ticket_id, conversation_id').single();
  if (error || !message) throw new Error('Failed to send message');
  if (conversation) await supabaseAdmin.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', conversation.id);
  return message;
}

export async function finalizePortalMediaAction(ticketId: string, lineIdToken: string, path: string, messageType: 'image' | 'file') {
  if (!isOwnedPortalMediaPath(ticketId, path) || !['image', 'file'].includes(messageType)) throw new Error('Invalid attachment');
  const customer = await requirePortalCustomer(lineIdToken);
  await requireOwnedTicket(customer.id, ticketId);
  const { data: objects, error: listError } = await supabaseAdmin.storage.from(PRIVATE_CHAT_MEDIA_BUCKET).list(`portal/${ticketId}`, { search: path.split('/').pop() });
  const object = objects?.find((item) => `portal/${ticketId}/${item.name}` === path);
  if (listError || !object) throw new Error('Attachment upload was not completed');
  const uploadedMedia = parsePortalMediaInput({ name: object.name, type: String(object.metadata?.mimetype || ''), size: Number(object.metadata?.size || 0) });
  if (uploadedMedia.messageType !== messageType || !path.endsWith(`.${uploadedMedia.extension}`)) throw new Error('Uploaded attachment does not match its authorization');
  return insertPortalMessage(ticketId, customer.id, path, messageType);
}

export async function syncPortalCustomerAction(lineIdToken: string) {
  if (!lineIdToken) {
    throw new Error('LINE identity token is required');
  }

  const identity = await requireTrustedLineIdentity(lineIdToken);
  return syncVerifiedPortalCustomer<PortalSyncCustomer>(
    identity,
    'id, line_user_id, display_name, avatar_url',
    'id, line_user_id, display_name'
  );
}

export async function createPortalTicketAction(
  lineIdToken: string,
  input: PortalTicketInput
) {
  if (!lineIdToken) {
    throw new Error('LINE identity token is required');
  }

  const parsed = parsePortalTicketInput(input);
  const customer = await requirePortalCustomer(lineIdToken);
  if (!customer.organization_id) {
    throw new Error('Customer organization is required');
  }

  const [{ data: organization }, { data: slaRule }] = await Promise.all([
    supabaseAdmin
      .from('organizations')
      .select('abbreviation')
      .eq('id', customer.organization_id)
      .maybeSingle(),
    supabaseAdmin
      .from('sla_rules')
      .select('response_time_minutes, resolution_time_minutes')
      .eq('priority', 'Medium')
      .maybeSingle(),
  ]);

  const abbreviation = organization?.abbreviation || 'NEO';
  const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const randomPart = randomBytes(4).toString('hex').toUpperCase();
  const ticketNo = `${abbreviation}-${datePart}-${randomPart}`;
  const duration = slaRule?.resolution_time_minutes || slaRule?.response_time_minutes || 60;
  const slaDueAt = calculateSlaDeadline(new Date(), duration).toISOString();

  const { data: ticket, error: ticketError } = await supabaseAdmin
    .from('tickets')
    .insert({
      ticket_no: ticketNo,
      customer_id: customer.id,
      organization_id: customer.organization_id,
      current_department_id: customer.department_id,
      subject: parsed.subject,
      description: parsed.description,
      status: 'New',
      priority: 'Medium',
      sla_due_at: slaDueAt,
    })
    .select('id, ticket_no')
    .single();

  if (ticketError || !ticket) {
    throw new Error('Failed to create ticket');
  }

  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .insert({
      customer_id: customer.id,
      status: 'active',
      current_ticket_id: ticket.id,
      last_message_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (conversationError || !conversation) {
    await supabaseAdmin.from('tickets').delete().eq('id', ticket.id);
    throw new Error('Failed to create ticket conversation');
  }

  const { error: messageError } = await supabaseAdmin.from('messages').insert({
    ticket_id: ticket.id,
    conversation_id: conversation.id,
    sender_type: 'customer',
    customer_id: customer.id,
    message_type: 'text',
    content: parsed.description,
  });

  if (messageError) {
    await supabaseAdmin.from('conversations').delete().eq('id', conversation.id);
    await supabaseAdmin.from('tickets').delete().eq('id', ticket.id);
    throw new Error('Failed to create initial ticket message');
  }

  return { id: ticket.id, ticketNo: ticket.ticket_no };
}

/**
 * Securely sends a message from the Portal (Customer side).
 * Verifies that the LINE User ID owns the ticket before inserting.
 * After successful insert, pushes a LINE notification to the internal staff group.
 */
export async function sendPortalMessageAction(
  ticketId: string,
  lineIdToken: string,
  content: string,
  messageType: string = 'text'
) {
  if (!ticketId || !lineIdToken || !content || messageType !== 'text') {
    throw new Error('Missing required fields');
  }

  const customer = await requirePortalCustomer(lineIdToken);
  await requireOwnedTicket(customer.id, ticketId);
  const safeContent = messageType === 'text' ? content.trim().slice(0, 10000) : content;
  if (!safeContent || (messageType !== 'text' && !isOwnedPortalMediaPath(ticketId, safeContent))) {
    throw new Error('Invalid message content');
  }

  // 1. Verify Ownership — find customer by line_user_id
  // 2. Verify ticket belongs to this customer
  // 3. Resolve Conversation ID
  const { data: conversation } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('current_ticket_id', ticketId)
    .maybeSingle();

  // 4. Insert Message Securely
  const { data: message, error: insertError } = await supabaseAdmin
    .from('messages')
    .insert([{
      ticket_id: ticketId,
      conversation_id: conversation?.id || null,
      sender_type: 'customer',
      customer_id: customer.id,
      content: safeContent,
      message_type: messageType
    }])
    .select('id, content, sender_type, message_type, created_at, ticket_id, conversation_id')
    .single();

  if (insertError) {
    throw new Error('Failed to send message: ' + insertError.message);
  }

  // 5. Update conversation timestamp if exists
  if (conversation) {
    await supabaseAdmin
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation.id);
  }

  return message;
}

export async function submitPortalCsatAction(
  ticketId: string,
  lineIdToken: string,
  score: number,
  comment: string
) {
  if (!ticketId || !lineIdToken || !Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error('Invalid survey submission');
  }

  const customer = await requirePortalCustomer(lineIdToken);
  const ticket = await requireOwnedTicket(customer.id, ticketId);
  if (!['Resolved', 'Closed', 'Fix Completed', 'resolved', 'closed', 'fix completed'].includes(ticket.status)) {
    throw new Error('Survey is not available for this ticket');
  }

  const { data, error } = await supabaseAdmin
    .from('csat_surveys')
    .upsert(
      {
        ticket_id: ticket.id,
        score,
        rating: score,
        comment: comment.trim().slice(0, 2000),
        responded_at: new Date().toISOString(),
      },
      { onConflict: 'ticket_id' }
    )
    .select('ticket_id, score, rating, comment, responded_at')
    .single();

  if (error) {
    throw new Error('Failed to submit survey');
  }

  return data;
}
