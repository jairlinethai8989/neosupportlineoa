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
  customers (id, display_name, line_user_id, avatar_url)
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
  issue_type
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
    .select('*')
    .order('last_message_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return normalizeInboxConversations(data || []);
}

export async function listInboxConversationsV2({
  status = 'active',
  page = 1,
  pageSize = 20,
  startDate,
  endDate,
  search
}: {
  status?: 'active' | 'closed';
  page?: number;
  pageSize?: number;
  startDate?: string | null;
  endDate?: string | null;
  search?: string;
}): Promise<{ data: InboxConversation[]; count: number }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('conversations')
    .select(inboxConversationSelect, { count: 'exact' });

  // Status Filter - Most inclusive logic: Active = not is_active:false
  if (status === 'active') {
    query = query.or('is_active.eq.true,is_active.is.null');
  } else {
    query = query.eq('is_active', false);
  }

  // Apply filters only if provided
  if (startDate) query = query.gte('last_message_at', startDate);
  if (endDate) query = query.lte('last_message_at', endDate);

  // Simplified and more robust query execution
  const { data, error, count } = await query
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .range(from, to);

  if (error) {
    console.error('Supabase Query Error:', error);
    throw error;
  }
  
  return {
    data: normalizeInboxConversations(data || []),
    count: count ?? (data?.length || 0)
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

export async function getLatestOpenInboxTicketForCustomer(
  customerId: string | null
): Promise<InboxTicket | null> {
  if (!customerId) return null;

  const { data, error } = await supabase
    .from('tickets')
    .select(inboxTicketSelect)
    .eq('customer_id', customerId)
    .not('status', 'in', '("Resolved","Closed")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return normalizeInboxTicket(data);
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
