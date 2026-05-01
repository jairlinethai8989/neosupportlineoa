import { supabase } from '@/lib/supabase';
import {
  normalizeInboxAgent,
  normalizeInboxCompanySettings,
  normalizeInboxConversation,
  normalizeInboxConversations,
  normalizeInboxMessages,
  normalizeInboxTicket,
} from '@/lib/inbox/normalizers';
import type {
  InboxAgent,
  InboxCompanySettings,
  InboxConversation,
  InboxMessage,
  InboxTicket,
} from '@/types/inbox';

export const inboxConversationSelect = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (id, display_name, line_user_id, avatar_url),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    customers:customers!tickets_customer_id_fkey (id, display_name, line_user_id, avatar_url)
  )
`;

const inboxConversationSelectLegacy = `
  id,
  status,
  last_message_at,
  customer_id,
  current_ticket_id,
  customers (id, display_name, line_user_id),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    customers:customers!tickets_customer_id_fkey (id, display_name, line_user_id)
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
    maybe.code === 'PGRST204' &&
    (message.includes('avatar_url') || message.includes('column'))
  );
}

async function runConversationQueryWithAvatarFallback<T>(
  runQuery: (
    selectClause: string
  ) => PromiseLike<{ data: T | null; error: unknown }> | { data: T | null; error: unknown }
): Promise<{ data: T | null; error: unknown }> {
  const primary = await runQuery(inboxConversationSelect);
  if (!primary.error) return primary;
  const legacy = await runQuery(inboxConversationSelectLegacy);
  if (!legacy.error) return legacy;
  const minimal = await runQuery(inboxConversationSelectMinimal);
  if (!minimal.error) return minimal;
  if (!isMissingAvatarColumnError(primary.error)) return primary;
  return legacy;
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

export const inboxCompanySettingsSelect = `
  id,
  modules,
  issue_types
`;

export async function listInboxConversations(limit = 100): Promise<InboxConversation[]> {
  const { data, error } = await runConversationQueryWithAvatarFallback((selectClause) =>
    supabase
      .from('conversations')
      .select(selectClause)
      .order('last_message_at', { ascending: false })
      .limit(limit)
  );

  if (error) throw error;
  return normalizeInboxConversations(Array.isArray(data) ? data : []);
}

export async function listInboxConversationsFallback(limit = 100): Promise<InboxConversation[]> {
  const { data, error } = await runConversationQueryWithAvatarFallback((selectClause) =>
    supabase
      .from('conversations')
      .select(selectClause)
      .order('last_message_at', { ascending: false })
      .limit(limit)
  );

  if (error) throw error;
  return normalizeInboxConversations(Array.isArray(data) ? data : []);
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
  const pageSize = input.pageSize || 20;

  const { data, error } = await runConversationQueryWithAvatarFallback((selectClause) => {
    let query = supabase
      .from('conversations')
      .select(selectClause)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: false })
      .limit(pageSize + 1);

    if (input.cursorLastMessageAt && input.cursorId) {
      query = query.or(
        `last_message_at.lt.${input.cursorLastMessageAt},and(last_message_at.eq.${input.cursorLastMessageAt},id.lt.${input.cursorId})`
      );
    }

    return query;
  });

  if (error) {
    console.error('Inbox Query Error:', error);
    // Safe fallback query to prevent empty inbox on transient select/schema mismatch.
    const { data: fallbackData, error: fallbackError } =
      await runConversationQueryWithAvatarFallback((selectClause) =>
        supabase
          .from('conversations')
          .select(selectClause)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false })
          .limit(pageSize + 1)
      );

    if (fallbackError) {
      console.error('Inbox Fallback Query Error:', fallbackError);
      return { data: [], hasNext: false, nextCursor: null };
    }

    const fallbackRows = Array.isArray(fallbackData) ? fallbackData : [];
    const normalizedFallback = normalizeInboxConversations(fallbackRows.slice(0, pageSize));
    const hasNextFallback = fallbackRows.length > pageSize;
    const nextCursorRow = normalizedFallback[normalizedFallback.length - 1];
    return {
      data: normalizedFallback,
      hasNext: hasNextFallback,
      nextCursor:
        hasNextFallback && nextCursorRow?.last_message_at
          ? { lastMessageAt: nextCursorRow.last_message_at, id: nextCursorRow.id }
          : null,
    };
  }

  const rows = Array.isArray(data) ? data : [];

  // Defensive fallback: some environments can return zero rows for strict status filter
  // while conversations exist with non-standard status text.
  if (rows.length === 0 && input.status === 'active') {
    const { data: wideData, error: wideError } = await runConversationQueryWithAvatarFallback(
      (selectClause) =>
        supabase
          .from('conversations')
          .select(selectClause)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: false })
          .limit(pageSize + 1)
    );

    const wideRows = Array.isArray(wideData) ? wideData : [];
    if (!wideError && wideRows.length > 0) {
      const normalizedWide = normalizeInboxConversations(wideRows.slice(0, pageSize));
      const activeLike = normalizedWide.filter((conversation) => {
        const normalizedStatus = String(conversation.status || '').toLowerCase().trim();
        const isClosedLike =
          normalizedStatus === 'closed' ||
          normalizedStatus === 'resolved' ||
          normalizedStatus === 'done';
        if (conversation.is_active === true) return true;
        return !isClosedLike;
      });

      const hasNextWide = wideRows.length > pageSize;
      const nextCursorWide = activeLike[activeLike.length - 1];
      return {
        data: activeLike,
        hasNext: hasNextWide,
        nextCursor:
          hasNextWide && nextCursorWide?.last_message_at
            ? { lastMessageAt: nextCursorWide.last_message_at, id: nextCursorWide.id }
            : null,
      };
    }
  }

  const normalized = normalizeInboxConversations(rows.slice(0, pageSize));
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

  return conversationId ? getInboxConversationById(conversationId) : null;
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

  const baseConversationQuery = supabase
    .from('messages')
    .select(inboxMessageSelect)
    .eq('conversation_id', input.conversationId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!input.ticketId) {
    const { data, error } = await baseConversationQuery;
    if (error) throw error;
    return normalizeInboxMessages((data || []).reverse());
  }

  const baseTicketQuery = supabase
    .from('messages')
    .select(inboxMessageSelect)
    .eq('ticket_id', input.ticketId)
    .lt('created_at', before)
    .order('created_at', { ascending: false })
    .limit(limit);

  const [{ data: byConversation, error: convError }, { data: byTicket, error: ticketError }] =
    await Promise.all([baseConversationQuery, baseTicketQuery]);

  if (convError && ticketError) {
    throw convError;
  }

  const merged = [...(byConversation || []), ...(byTicket || [])];
  const normalized = normalizeInboxMessages(merged);

  const dedupedById = Array.from(
    new Map(normalized.map((message) => [message.id, message])).values()
  );

  dedupedById.sort(
    (left, right) =>
      new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
  );

  return dedupedById.slice(0, limit).reverse();
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
  const { data, error } = await supabase
    .from('company_settings')
    .select(inboxCompanySettingsSelect)
    .limit(1)
    .single();

  if (error) throw error;
  return normalizeInboxCompanySettings(data);
}
