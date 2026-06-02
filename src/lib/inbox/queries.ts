import { supabase } from '@/lib/supabase';
import {
  normalizeInboxAgent,
  normalizeInboxConversation,
  normalizeInboxConversations,
  normalizeInboxMessages,
  normalizeInboxTicket,
} from '@/lib/inbox/normalizers';
import type {
  InboxAgent,
  InboxCompanySettings,
  InboxConversation,
  InboxCustomer,
  InboxMessage,
  InboxTicket,
} from '@/types/inbox';

export const inboxConversationSelect = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    line_user_id,
    metadata,
    organization_id,
    department_id,
    position_id,
    organizations:organization_id (id, name),
    departments:department_id (id, name),
    positions:position_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status,
    organization_id,
    current_department_id,
    organizations:organization_id (id, name),
    departments:current_department_id (id, name)
  )
`;

const inboxConversationSelectLegacy = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    line_user_id,
    metadata,
    organization_id,
    department_id,
    position_id,
    organizations:organization_id (id, name),
    departments:department_id (id, name),
    positions:position_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status,
    organization_id,
    current_department_id,
    organizations:organization_id (id, name),
    departments:current_department_id (id, name)
  )
`;

export const inboxConversationSelectForList = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    organization_id,
    organizations:organization_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status,
    organization_id,
    organizations:organization_id (id, name)
  )
`;

const inboxConversationSelectForListLegacy = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (
    id,
    display_name,
    organization_id,
    organizations:organization_id (id, name)
  ),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    status,
    organization_id,
    organizations:organization_id (id, name)
  )
`;

const inboxConversationSelectMinimal = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id
`;

function isMissingAvatarColumnError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string; message?: string };
  const message = String(maybe.message || '').toLowerCase();
  return (
    (maybe.code === 'PGRST204' || maybe.code === '42703') &&
    (message.includes('avatar_url') || message.includes('column'))
  );
}

async function runConversationQueryWithAvatarFallback<T>(
  runQuery: (
    selectClause: string
  ) => PromiseLike<{ data: T | null; error: unknown }> | { data: T | null; error: unknown },
  options?: { isList?: boolean }
): Promise<{ data: T | null; error: unknown }> {
  const selectPrimary = options?.isList ? inboxConversationSelectForList : inboxConversationSelect;
  const primary = await runQuery(selectPrimary);
  if (!primary.error) return primary;

  // Minimal select fallback if primary query fails
  console.warn('Primary inbox query failed, trying minimal select:', primary.error);
  const selectMinimal = inboxConversationSelectMinimal;
  const minimal = await runQuery(selectMinimal);
  if (!minimal.error) return minimal;

  return primary;
}

export const inboxMessageSelect = `
  id,
  content,
  sender_type,
  staff_id,
  conversation_id,
  ticket_id,
  message_type,
  created_at
`;

export const inboxTicketSelect = `
  id,
  ticket_no,
  customer_id,
  subject,
  description,
  status,
  assigned_agent_id,
  module,
  issue_type,
  escalation_token
`;

export const inboxProfileSelect = `
  id,
  role,
  permissions,
  quick_replies,
  resolution_templates
`;



type EnrichCustomerRow = {
  id: string;
  display_name: string | null;
  line_user_id: string | null;
  avatar_url?: string | null;
  organization_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  organizations?: { id: string; name: string | null } | null;
  departments?: { id: string; name: string | null } | null;
  positions?: { id: string; name: string | null } | null;
};

type EnrichTicketRow = {
  id: string;
  ticket_no: string | null;
  subject: string | null;
  status: string | null;
  customer_id: string | null;
  organization_id?: string | null;
  current_department_id?: string | null;
  organizations?: { id: string; name: string | null } | null;
  departments?: { id: string; name: string | null } | null;
};

async function enrichConversationsIfNeeded(
  conversations: InboxConversation[]
): Promise<InboxConversation[]> {
  const needsCustomer = conversations.some((item) => item.customer_id && !item.customers);
  const needsTicket = conversations.some(
    (item) => item.current_ticket_id && !item.ticket_data
  );
  if (!needsCustomer && !needsTicket) return conversations;

  const customerIds = Array.from(
    new Set(
      conversations
        .map((item) => item.customer_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const ticketIds = Array.from(
    new Set(
      conversations
        .map((item) => item.current_ticket_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  const [customerResult, ticketResult] = await Promise.all([
    customerIds.length
      ? supabase
          .from('customers')
          .select(`
            id,
            display_name,
            line_user_id,
            avatar_url,
            metadata,
            organization_id,
            department_id,
            position_id,
            organizations:organization_id (id, name),
            departments:department_id (id, name),
            positions:position_id (id, name)
          `)
          .in('id', customerIds)
      : Promise.resolve({ data: [], error: null }),
    ticketIds.length
      ? supabase
          .from('tickets')
          .select('id,ticket_no,subject,status,customer_id,organization_id,current_department_id,organizations:organization_id(id,name),departments:current_department_id(id,name)')
          .in('id', ticketIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const customerMap = new Map<string, EnrichCustomerRow>();
  (customerResult.data as Array<Record<string, unknown>> | null || []).forEach((row) => {
    if (typeof row?.id === 'string') {
      customerMap.set(row.id, {
        id: row.id,
        display_name: typeof row.display_name === 'string' ? row.display_name : null,
        line_user_id: typeof row.line_user_id === 'string' ? row.line_user_id : null,
        organization_id: typeof row.organization_id === 'string' ? row.organization_id : null,
        department_id: typeof row.department_id === 'string' ? row.department_id : null,
        position_id: typeof row.position_id === 'string' ? row.position_id : null,
        organizations:
          row.organizations && typeof row.organizations === 'object'
            ? {
                id: typeof (row.organizations as Record<string, unknown>).id === 'string' ? (row.organizations as Record<string, unknown>).id as string : '',
                name: typeof (row.organizations as Record<string, unknown>).name === 'string' ? (row.organizations as Record<string, unknown>).name as string : null,
              }
            : null,
        departments:
          row.departments && typeof row.departments === 'object'
            ? {
                id: typeof (row.departments as Record<string, unknown>).id === 'string' ? (row.departments as Record<string, unknown>).id as string : '',
                name: typeof (row.departments as Record<string, unknown>).name === 'string' ? (row.departments as Record<string, unknown>).name as string : null,
              }
            : null,
        positions:
          row.positions && typeof row.positions === 'object'
            ? {
                id: typeof (row.positions as Record<string, unknown>).id === 'string' ? (row.positions as Record<string, unknown>).id as string : '',
                name: typeof (row.positions as Record<string, unknown>).name === 'string' ? (row.positions as Record<string, unknown>).name as string : null,
              }
            : null,
        avatar_url:
          typeof row.avatar_url === 'string'
            ? row.avatar_url
            : typeof (row.metadata as Record<string, unknown> | null)?.line_profile === 'object'
              ? (row.metadata as { line_profile?: { picture_url?: unknown } }).line_profile &&
                typeof (row.metadata as { line_profile?: { picture_url?: unknown } }).line_profile
                  ?.picture_url === 'string'
                ? ((row.metadata as { line_profile?: { picture_url?: string } }).line_profile
                    ?.picture_url || null)
                : null
              : null,
      });
    }
  });

  const ticketMap = new Map<string, EnrichTicketRow>();
  (ticketResult.data as Array<Record<string, unknown>> | null || []).forEach((row) => {
    if (typeof row?.id === 'string') {
      ticketMap.set(row.id, {
        id: row.id,
        ticket_no: typeof row.ticket_no === 'string' ? row.ticket_no : null,
        subject: typeof row.subject === 'string' ? row.subject : null,
        status: typeof row.status === 'string' ? row.status : null,
        customer_id: typeof row.customer_id === 'string' ? row.customer_id : null,
        organization_id: typeof row.organization_id === 'string' ? row.organization_id : null,
        current_department_id: typeof row.current_department_id === 'string' ? row.current_department_id : null,
        organizations: row.organizations && typeof row.organizations === 'object'
          ? {
              id: typeof (row.organizations as Record<string, unknown>).id === 'string' ? (row.organizations as Record<string, unknown>).id as string : '',
              name: typeof (row.organizations as Record<string, unknown>).name === 'string' ? (row.organizations as Record<string, unknown>).name as string : null,
            }
          : null,
        departments: row.departments && typeof row.departments === 'object'
          ? {
              id: typeof (row.departments as Record<string, unknown>).id === 'string' ? (row.departments as Record<string, unknown>).id as string : '',
              name: typeof (row.departments as Record<string, unknown>).name === 'string' ? (row.departments as Record<string, unknown>).name as string : null,
            }
          : null,
      });
    }
  });

  return conversations.map((conversation) => {
    const ticketFromMap = conversation.current_ticket_id
      ? ticketMap.get(conversation.current_ticket_id)
      : null;
    const customerFromMap = conversation.customer_id
      ? customerMap.get(conversation.customer_id)
      : ticketFromMap?.customer_id
        ? customerMap.get(ticketFromMap.customer_id)
        : null;

    return {
      ...conversation,
      customers:
        conversation.customers?.display_name || !customerFromMap
          ? {
              ...conversation.customers,
              // Override with ticket's snapshot data if available (Option A implementation)
              organization_id: ticketFromMap?.organization_id || conversation.customers?.organization_id || null,
              department_id: ticketFromMap?.current_department_id || conversation.customers?.department_id || null,
              organizations: ticketFromMap?.organizations || conversation.customers?.organizations || null,
              departments: ticketFromMap?.departments || conversation.customers?.departments || null,
            } as InboxCustomer
          : {
              id: customerFromMap.id,
              display_name: customerFromMap.display_name,
              line_user_id: customerFromMap.line_user_id,
              avatar_url: conversation.customers?.avatar_url || customerFromMap.avatar_url || null,
              // Override with ticket's snapshot data if available (Option A implementation)
              organization_id: ticketFromMap?.organization_id || customerFromMap.organization_id || null,
              department_id: ticketFromMap?.current_department_id || customerFromMap.department_id || null,
              position_id: customerFromMap.position_id || null,
              organizations: ticketFromMap?.organizations || customerFromMap.organizations || null,
              departments: ticketFromMap?.departments || customerFromMap.departments || null,
              positions: customerFromMap.positions || null,
            },
      ticket_data:
        conversation.ticket_data?.ticket_no || !ticketFromMap
          ? (conversation.ticket_data
              ? {
                  ...conversation.ticket_data,
                  organizations:
                    conversation.ticket_data.organizations ||
                    ticketFromMap?.organizations ||
                    null,
                }
              : null)
          : {
              id: ticketFromMap.id,
              ticket_no: ticketFromMap.ticket_no,
              subject: ticketFromMap.subject,
              status: ticketFromMap.status,
              organizations: ticketFromMap.organizations || null,
            },
    };
  });
}

export async function listInboxConversations(limit = 100): Promise<InboxConversation[]> {
  const { data, error } = await runConversationQueryWithAvatarFallback(
    (selectClause) =>
      supabase
        .from('conversations')
        .select(selectClause)
        .order('last_message_at', { ascending: false })
        .limit(limit),
    { isList: true }
  );

  if (error) throw error;
  const normalized = normalizeInboxConversations(Array.isArray(data) ? data : []);
  return enrichConversationsIfNeeded(normalized);
}

export async function listInboxConversationsFallback(limit = 100): Promise<InboxConversation[]> {
  const { data, error } = await runConversationQueryWithAvatarFallback(
    (selectClause) =>
      supabase
        .from('conversations')
        .select(selectClause)
        .order('last_message_at', { ascending: false })
        .limit(limit),
    { isList: true }
  );

  if (error) throw error;
  const normalized = normalizeInboxConversations(Array.isArray(data) ? data : []);
  return enrichConversationsIfNeeded(normalized);
}

export async function listInboxConversationsV2(input: {
  status?: 'active' | 'closed';
  pageSize?: number;
  cursorLastMessageAt?: string | null;
  cursorId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}): Promise<{ data: InboxConversation[]; hasNext: boolean; nextCursor: { lastMessageAt: string; id: string } | null }> {
  const pageSize = input.pageSize || 10;

  const { data, error } = await runConversationQueryWithAvatarFallback(
    (selectClause) => {
      let query = supabase
        .from('conversations')
        .select(selectClause)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false })
        .limit(pageSize + 1);

      if (input.status === 'active') {
        query = query.not('status', 'in', '("closed","resolved","done","archived")');
      } else if (input.status === 'closed') {
        query = query.in('status', ['closed', 'resolved', 'done', 'archived']);
      }

      if (input.cursorLastMessageAt && input.cursorId) {
        query = query.or(
          `last_message_at.lt.${input.cursorLastMessageAt},and(last_message_at.eq.${input.cursorLastMessageAt},id.lt.${input.cursorId})`
        );
      }

      return query;
    },
    { isList: true }
  );

  if (error) {
    console.error('Inbox Query Error:', error);
    return { data: [], hasNext: false, nextCursor: null };
  }

  const rows = Array.isArray(data) ? data : [];
  const normalized = await enrichConversationsIfNeeded(
    normalizeInboxConversations(rows.slice(0, pageSize))
  );
  const hasNext = rows.length > pageSize;
  const nextCursorRow = normalized[normalized.length - 1];
  return {
    data: normalized,
    hasNext,
    nextCursor:
      hasNext && nextCursorRow?.last_message_at
        ? { lastMessageAt: nextCursorRow.last_message_at, id: nextCursorRow.id }
        : null,
  };
}

export async function getInboxConversationById(id: string): Promise<InboxConversation | null> {
  const { data, error } = await runConversationQueryWithAvatarFallback((selectClause) =>
    supabase.from('conversations').select(selectClause).eq('id', id).single()
  );

  if (error) throw error;
  return normalizeInboxConversation(data);
}

export async function getInboxConversationByTicketId(
  ticketId: string
): Promise<InboxConversation | null> {
  const { data, error } = await runConversationQueryWithAvatarFallback((selectClause) =>
    supabase
      .from('conversations')
      .select(selectClause)
      .eq('current_ticket_id', ticketId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
  );

  if (error) throw error;
  if (data) return normalizeInboxConversation(data);

  const { data: messageRow, error: messageError } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (messageError) throw messageError;
  const conversationId =
    messageRow && typeof messageRow.conversation_id === 'string'
      ? messageRow.conversation_id
      : null;

  if (conversationId) {
    return getInboxConversationById(conversationId);
  }

  // Fallback: Query the ticket to find customer_id and get the active/any conversation for that customer
  const { data: ticketRow, error: ticketError } = await supabase
    .from('tickets')
    .select('customer_id')
    .eq('id', ticketId)
    .maybeSingle();

  if (ticketError) throw ticketError;

  if (ticketRow?.customer_id) {
    // 1. Try to find an active conversation for this customer
    const { data: activeConv, error: activeConvError } = await runConversationQueryWithAvatarFallback((selectClause) =>
      supabase
        .from('conversations')
        .select(selectClause)
        .eq('customer_id', ticketRow.customer_id)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
    );

    if (activeConvError) throw activeConvError;
    if (activeConv) return normalizeInboxConversation(activeConv);

    // 2. Try to find any conversation for this customer
    const { data: anyConv, error: anyConvError } = await runConversationQueryWithAvatarFallback((selectClause) =>
      supabase
        .from('conversations')
        .select(selectClause)
        .eq('customer_id', ticketRow.customer_id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
    );

    if (anyConvError) throw anyConvError;
    if (anyConv) return normalizeInboxConversation(anyConv);
  }

  return null;
}

export async function listInboxMessages(
  conversationId: string,
  limit = 200
): Promise<InboxMessage[]> {
  return listInboxMessagesPage({ conversationId, limit });
}

export async function listInboxMessagesPage(input: {
  conversationId: string;
  ticketId?: string | null;
  limit?: number;
  beforeCreatedAt?: string | null;
}): Promise<InboxMessage[]> {
  const limit = input.limit || 50;
  const before = input.beforeCreatedAt || '9999-12-31T23:59:59.999Z';

  const { data, error } = await supabase
    .from('messages')
    .select(inboxMessageSelect)
    .eq('conversation_id', input.conversationId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeInboxMessages((data || []).reverse());
}

export async function getInboxTicketById(ticketId: string): Promise<InboxTicket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select(inboxTicketSelect)
    .eq('id', ticketId)
    .single();

  if (error) throw error;
  return normalizeInboxTicket(data);
}

export async function getLatestInboxTicketForConversation(
  conversationId: string
): Promise<InboxTicket | null> {
  const { data: messageRow, error: messageError } = await supabase
    .from('messages')
    .select('ticket_id')
    .eq('conversation_id', conversationId)
    .not('ticket_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (messageError) throw messageError;

  const ticketId =
    messageRow && typeof messageRow.ticket_id === 'string'
      ? messageRow.ticket_id
      : null;

  if (!ticketId) return null;

  return getInboxTicketById(ticketId);
}

export async function getInboxProfile(userId: string): Promise<InboxAgent | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(inboxProfileSelect)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return normalizeInboxAgent(data, userId);
}

export async function getInboxCompanySettings(): Promise<InboxCompanySettings> {
  try {
    const [settingsRes, modulesRes, issuesRes] = await Promise.all([
      supabase.from('company_settings').select('id, resolution_templates').limit(1).maybeSingle(),
      supabase.from('ticket_modules').select('name').eq('is_active', true),
      supabase.from('ticket_issue_types').select('name').eq('is_active', true),
    ]);

    if (settingsRes.error) throw settingsRes.error;

    return {
      modules: modulesRes.data?.map((d) => d.name) || [],
      issue_types: issuesRes.data?.map((d) => d.name) || [],
      resolution_templates: settingsRes.data?.resolution_templates || [],
    };
  } catch (error) {
    console.error('Failed to fetch inbox company settings:', error);
    return {
      modules: [],
      issue_types: [],
    };
  }
}
