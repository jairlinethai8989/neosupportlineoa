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
  is_active,
  customers (id, display_name, line_user_id),
  ticket_data:current_ticket_id (
    id,
    ticket_no,
    subject,
    customers:customers!tickets_customer_id_fkey (id, display_name, line_user_id)
  )
`;

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
  const { data, error } = await supabase
    .from('conversations')
    .select(inboxConversationSelect)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeInboxConversations(data || []);
}

export async function listInboxConversationsFallback(limit = 100): Promise<InboxConversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select(inboxConversationSelect)
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeInboxConversations(data || []);
}

export async function listInboxConversationsV2(input: {
  status?: 'active' | 'closed';
  page?: number;
  pageSize?: number;
  includeCount?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}): Promise<{ data: InboxConversation[]; count: number }> {
  const page = input.page || 1;
  const pageSize = input.pageSize || 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Include multiple legacy status variants and is_active=true so claimed chats do not disappear.
  const activeStatusFilter =
    'status.ilike.active,status.ilike.open,status.ilike.new,status.ilike.in progress,status.ilike.in_progress,is_active.eq.true';

  const selectOptions = input.includeCount === false ? undefined : { count: 'exact' as const };
  const { data, error, count } = await supabase
    .from('conversations')
    .select(inboxConversationSelect, selectOptions)
    .or(activeStatusFilter)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error('Inbox Query Error:', error);
    // Safe fallback query to prevent empty inbox on transient select/schema mismatch.
    const { data: fallbackData, count: fallbackCount, error: fallbackError } = await supabase
      .from('conversations')
      .select(inboxConversationSelect, selectOptions)
      .or(activeStatusFilter)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (fallbackError) {
      console.error('Inbox Fallback Query Error:', fallbackError);
      return { data: [], count: 0 };
    }

    return {
      data: normalizeInboxConversations(fallbackData || []),
      count: fallbackCount || (fallbackData?.length || 0),
    };
  }

  // Defensive fallback: some environments can return zero rows for strict status filter
  // while conversations exist with non-standard status text.
  if ((data?.length || 0) === 0 && input.status === 'active') {
    const {
      data: wideData,
      count: wideCount,
      error: wideError,
    } = await supabase
      .from('conversations')
      .select(inboxConversationSelect, { count: 'exact' })
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (!wideError && (wideData?.length || 0) > 0) {
      const normalizedWide = normalizeInboxConversations(wideData || []);
      const activeLike = normalizedWide.filter((conversation) => {
        const normalizedStatus = String(conversation.status || '').toLowerCase().trim();
        const isClosedLike =
          normalizedStatus === 'closed' ||
          normalizedStatus === 'resolved' ||
          normalizedStatus === 'done';
        if (conversation.is_active === true) return true;
        return !isClosedLike;
      });

      return {
        data: activeLike,
        count: wideCount || activeLike.length,
      };
    }
  }
  
  return {
    data: normalizeInboxConversations(data || []),
    count: count || (data?.length || 0)
  };
}

export async function getInboxConversationById(id: string): Promise<InboxConversation | null> {
  const { data, error } = await supabase
    .from('conversations')
    .select(inboxConversationSelect)
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeInboxConversation(data);
}

export async function listInboxMessages(
  conversationId: string,
  limit = 200
): Promise<InboxMessage[]> {
  return listInboxMessagesPage({ conversationId, limit });
}

export async function listInboxMessagesPage(input: {
  conversationId: string;
  limit?: number;
  beforeCreatedAt?: string | null;
}): Promise<InboxMessage[]> {
  const limit = input.limit || 50;
  const { data, error } = await supabase
    .from('messages')
    .select(inboxMessageSelect)
    .eq('conversation_id', input.conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)
    .lt('created_at', input.beforeCreatedAt || '9999-12-31T23:59:59.999Z');

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
  const { data, error } = await supabase
    .from('company_settings')
    .select(inboxCompanySettingsSelect)
    .limit(1)
    .single();

  if (error) throw error;
  return normalizeInboxCompanySettings(data);
}
