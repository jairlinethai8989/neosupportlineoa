import { supabaseAdmin } from '@/lib/supabaseAdmin';
import {
  inboxConversationSelect,
  inboxConversationSelectForList,
  inboxMessageSelect,
  inboxTicketSelect,
} from '@/lib/inbox/queries';
import {
  normalizeInboxConversation,
  normalizeInboxConversations,
  normalizeInboxMessages,
  normalizeInboxTicket,
} from '@/lib/inbox/normalizers';
import type {
  InboxConversation,
  InboxMessage,
  InboxTicket,
} from '@/types/inbox';

export interface InitialInboxBootstrap {
  conversations: InboxConversation[];
  hasNextPage: boolean;
  nextCursor: { lastMessageAt: string; id: string } | null;
  scopeKey: string;
  initialSelectedChat: InboxConversation | null;
  initialSelectedMessages: InboxMessage[];
  initialSelectedTicket: InboxTicket | null;
}

const CLOSED_STATUSES = new Set([
  'closed',
  'resolved',
  'done',
  'ended',
  'end',
  'archived',
]);

function isConversationActiveLikeServer(conversation: InboxConversation): boolean {
  const status = String(conversation.status || '').toLowerCase().trim();
  if (!status) return true;
  if (CLOSED_STATUSES.has(status)) return false;

  if (conversation.ticket_data?.status) {
    const ticketStatus = String(conversation.ticket_data.status).toLowerCase().trim();
    if (['resolved', 'closed', 'canceled'].includes(ticketStatus)) {
      return false;
    }
  }

  return true;
}

async function resolveConversationByCidOrTid(
  cid: string | null,
  tid: string | null
): Promise<InboxConversation | null> {
  if (cid) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select(inboxConversationSelect)
      .eq('id', cid)
      .maybeSingle();
    if (!error && data) {
      return normalizeInboxConversation(data);
    }
    return null;
  }

  if (tid) {
    const { data: convId } = await supabaseAdmin.rpc('get_conversation_id_by_ticket_id', {
      p_ticket_id: tid,
    });
    if (convId && typeof convId === 'string') {
      const { data } = await supabaseAdmin
        .from('conversations')
        .select(inboxConversationSelect)
        .eq('id', convId)
        .maybeSingle();
      if (data) return normalizeInboxConversation(data);
    }

    const { data: directConv } = await supabaseAdmin
      .from('conversations')
      .select(inboxConversationSelect)
      .eq('current_ticket_id', tid)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();
    if (directConv) return normalizeInboxConversation(directConv);
  }

  return null;
}

export async function getInitialInboxBootstrap(input: {
  selectedProjectId: string;
  scopedProjectIds: string[] | null;
  cid?: string | null;
  tid?: string | null;
  pageSize?: number;
}): Promise<InitialInboxBootstrap> {
  const pageSize = input.pageSize || 10;
  const scopeKey = `${input.selectedProjectId}:${
    input.scopedProjectIds ? input.scopedProjectIds.join(',') : 'all'
  }`;

  if (Array.isArray(input.scopedProjectIds) && input.scopedProjectIds.length === 0) {
    return {
      conversations: [],
      hasNextPage: false,
      nextCursor: null,
      scopeKey,
      initialSelectedChat: null,
      initialSelectedMessages: [],
      initialSelectedTicket: null,
    };
  }

  let listQuery = supabaseAdmin
    .from('conversations')
    .select(inboxConversationSelectForList)
    .eq('status', 'active')
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(pageSize + 1);

  if (input.scopedProjectIds && input.scopedProjectIds.length > 0) {
    listQuery = listQuery.in('project_id', input.scopedProjectIds);
  }

  const cid = input.cid?.trim() || null;
  const tid = input.tid?.trim() || null;

  const [listRes, fetchedSelectedChat] = await Promise.all([
    listQuery,
    cid || tid ? resolveConversationByCidOrTid(cid, tid) : Promise.resolve(null),
  ]);

  const rawRows = Array.isArray(listRes.data) ? listRes.data : [];
  const normalizedList = normalizeInboxConversations(rawRows.slice(0, pageSize));
  const visibleConversations = normalizedList.filter(isConversationActiveLikeServer);
  const hasNextPage = rawRows.length > pageSize;
  const lastRow = normalizedList[normalizedList.length - 1];
  const nextCursor =
    hasNextPage && lastRow?.last_message_at
      ? { lastMessageAt: lastRow.last_message_at, id: lastRow.id }
      : null;

  const matchedFromList = cid
    ? visibleConversations.find((c) => c.id === cid) || null
    : tid
      ? visibleConversations.find((c) => c.current_ticket_id === tid) || null
      : null;

  const initialSelectedChat = matchedFromList || fetchedSelectedChat;
  let initialSelectedMessages: InboxMessage[] = [];
  let initialSelectedTicket: InboxTicket | null = null;

  if (initialSelectedChat) {
    const targetTicketId =
      tid || initialSelectedChat.current_ticket_id || initialSelectedChat.ticket_data?.id || null;

    const [msgRes, ticketRes] = await Promise.all([
      supabaseAdmin
        .from('messages')
        .select(inboxMessageSelect)
        .eq('conversation_id', initialSelectedChat.id)
        .order('created_at', { ascending: false })
        .limit(50),
      targetTicketId
        ? supabaseAdmin
            .from('tickets')
            .select(inboxTicketSelect)
            .eq('id', targetTicketId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    initialSelectedMessages = normalizeInboxMessages((msgRes.data || []).reverse());
    if (ticketRes.data) {
      initialSelectedTicket = normalizeInboxTicket(ticketRes.data);
    }
  }

  return {
    conversations: visibleConversations,
    hasNextPage,
    nextCursor,
    scopeKey,
    initialSelectedChat,
    initialSelectedMessages,
    initialSelectedTicket,
  };
}
