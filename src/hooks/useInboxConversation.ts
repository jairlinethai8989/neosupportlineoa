import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { normalizeInboxMessage } from '@/lib/inbox/normalizers';
import {
  claimInboxTicket,
  closeInboxConversation,
  linkConversationToTicket,
  resolveInboxTicket,
  sendInboxAgentMessage,
} from '@/lib/inbox/mutations';
import {
  getInboxTicketById,
  getLatestInboxTicketForConversation,
  listInboxMessagesPage,
} from '@/lib/inbox/queries';
import {
  getInboxActionFailedMessage,
  getInboxClaimSuccessToast,
  getInboxCloseSuccessToast,
  getInboxClosedTicketMessage,
  getInboxErrorToast,
  getInboxResolveSuccessToast,
  getInboxWarningToast,
  type InboxToastInput,
} from '@/lib/inbox/feedback';
import type { InboxAgent, InboxConversation, InboxMessage, InboxTicket } from '@/types/inbox';

interface UseInboxConversationOptions {
  selectedChat: InboxConversation | null;
  setSelectedChat: Dispatch<SetStateAction<InboxConversation | null>>;
  agent: InboxAgent | null;
  addToast: (toast: InboxToastInput) => void;
}

const MESSAGE_PAGE_SIZE = 50;
const MAX_CACHED_THREADS = 20;
const PREFETCH_FRESH_MS = 8_000;

interface CachedInboxThread {
  messages: InboxMessage[];
  ticket: InboxTicket | null;
  hasMore: boolean;
  oldestCursor: string | null;
  fetchedAt: number;
}

const inboxThreadCache = new Map<string, CachedInboxThread>();
const inflightThreadPrefetches = new Map<string, Promise<void>>();

function writeThreadCache(conversationId: string, entry: CachedInboxThread) {
  if (inboxThreadCache.has(conversationId)) {
    inboxThreadCache.delete(conversationId);
  } else if (inboxThreadCache.size >= MAX_CACHED_THREADS) {
    const oldestKey = inboxThreadCache.keys().next().value;
    if (oldestKey) inboxThreadCache.delete(oldestKey);
  }
  inboxThreadCache.set(conversationId, entry);
}

export function seedInboxThreadCache(input: {
  conversationId: string;
  messages: InboxMessage[];
  ticket: InboxTicket | null;
}) {
  writeThreadCache(input.conversationId, {
    messages: input.messages,
    ticket: input.ticket,
    hasMore: input.messages.length === MESSAGE_PAGE_SIZE,
    oldestCursor: input.messages.length > 0 ? input.messages[0].created_at : null,
    fetchedAt: Date.now(),
  });
}

export function prefetchInboxThread(conversation: InboxConversation) {
  const existing = inboxThreadCache.get(conversation.id);
  if (existing && Date.now() - existing.fetchedAt < PREFETCH_FRESH_MS) return;
  if (inflightThreadPrefetches.has(conversation.id)) return;

  const ticketId = conversation.current_ticket_id || conversation.ticket_data?.id || null;
  const task = Promise.all([
    listInboxMessagesPage({
      conversationId: conversation.id,
      ticketId,
      limit: MESSAGE_PAGE_SIZE,
    }),
    ticketId
      ? getInboxTicketById(ticketId).catch(() => null)
      : getLatestInboxTicketForConversation(conversation.id).catch(() => null),
  ])
    .then(([msgs, tkt]) => {
      writeThreadCache(conversation.id, {
        messages: msgs,
        ticket: tkt,
        hasMore: msgs.length === MESSAGE_PAGE_SIZE,
        oldestCursor: msgs.length > 0 ? msgs[0].created_at : null,
        fetchedAt: Date.now(),
      });
    })
    .catch(() => {})
    .finally(() => {
      inflightThreadPrefetches.delete(conversation.id);
    });

  inflightThreadPrefetches.set(conversation.id, task);
}

export function useInboxConversation({
  selectedChat,
  setSelectedChat,
  agent,
  addToast,
}: UseInboxConversationOptions) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isInternalMode, setIsInternalMode] = useState(false);
  const [currentTicket, setCurrentTicket] = useState<InboxTicket | null>(null);
  const [sending, setSending] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const oldestMessageCursorRef = useRef<string | null>(null);
  const lastRenderedMessageIdRef = useRef<string | null>(null);

  const getThreadTicketId = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.get('tid') ||
      selectedChat?.current_ticket_id ||
      selectedChat?.ticket_data?.id ||
      null
    );
  }, [selectedChat?.current_ticket_id, selectedChat?.ticket_data?.id]);

  useEffect(() => {
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (lastMessageId && lastMessageId !== lastRenderedMessageIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastRenderedMessageIdRef.current = lastMessageId;
  }, [messages]);

  const selectedChatRef = useRef<InboxConversation | null>(selectedChat);
  selectedChatRef.current = selectedChat;
  const agentRef = useRef<InboxAgent | null>(agent);
  agentRef.current = agent;
  const selectedConversationId = selectedChat?.id || null;
  const selectedTicketId = selectedChat?.current_ticket_id || selectedChat?.ticket_data?.id || null;

  useEffect(() => {
    const activeChat = selectedChatRef.current;
    if (!selectedConversationId || !activeChat) {
      setMessages([]);
      setCurrentTicket(null);
      setHasMoreMessages(false);
      oldestMessageCursorRef.current = null;
      return;
    }

    let cancelled = false;
    const cached = inboxThreadCache.get(selectedConversationId);
    if (cached) {
      setMessages(cached.messages);
      setCurrentTicket(cached.ticket);
      setHasMoreMessages(cached.hasMore);
      oldestMessageCursorRef.current = cached.oldestCursor;
    }

    async function fetchConversationState() {
      const chatSnapshot = selectedChatRef.current;
      if (!chatSnapshot || !selectedConversationId) return;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTicketId = urlParams.get('tid');
        const urlConversationId = urlParams.get('cid');
        const threadTicketId =
          urlTicketId ||
          chatSnapshot.current_ticket_id ||
          chatSnapshot.ticket_data?.id ||
          null;

        const optimisticClaim = urlParams.get('oc') === '1';
        const shouldUseUrlTicket =
          Boolean(urlTicketId) &&
          (!urlConversationId || urlConversationId === selectedConversationId);
        const prefetchedTicketId =
          (shouldUseUrlTicket ? urlTicketId : null) ||
          chatSnapshot.current_ticket_id ||
          chatSnapshot.ticket_data?.id ||
          null;

        // If freshly cached/SSR-hydrated (< PREFETCH_FRESH_MS), skip duplicate initial round-trip
        const existingCache = inboxThreadCache.get(selectedConversationId);
        if (
          existingCache &&
          Date.now() - existingCache.fetchedAt < PREFETCH_FRESH_MS &&
          !optimisticClaim &&
          (!prefetchedTicketId || existingCache.ticket?.id === prefetchedTicketId)
        ) {
          return;
        }

        const [initialPage, prefetchedTicket] = await Promise.all([
          listInboxMessagesPage({
            conversationId: selectedConversationId,
            ticketId: threadTicketId,
            limit: MESSAGE_PAGE_SIZE,
          }),
          prefetchedTicketId
            ? getInboxTicketById(prefetchedTicketId).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        const oldestCursor =
          initialPage.length > 0 ? initialPage[0].created_at : null;
        const hasMore = initialPage.length === MESSAGE_PAGE_SIZE;

        setMessages(initialPage);
        oldestMessageCursorRef.current = oldestCursor;
        setHasMoreMessages(hasMore);

        const latestMessageTicketId =
          [...initialPage]
            .reverse()
            .find((message) => Boolean(message.ticket_id))
            ?.ticket_id || null;

        let targetTicketId: string | null = null;
        let targetTicketData: InboxConversation['ticket_data'] = null;

        if (shouldUseUrlTicket && urlTicketId) {
          targetTicketId = urlTicketId;
        } else if (latestMessageTicketId) {
          targetTicketId = latestMessageTicketId;
        } else if (chatSnapshot.ticket_data) {
          targetTicketData = chatSnapshot.ticket_data;
        } else if (chatSnapshot.current_ticket_id) {
          targetTicketId = chatSnapshot.current_ticket_id;
        }

        let resolvedTicket: InboxTicket | null = null;

        if (targetTicketId) {
          const ticket =
            targetTicketId === prefetchedTicketId && prefetchedTicket
              ? prefetchedTicket
              : await getInboxTicketById(targetTicketId);
          if (cancelled) return;
          if (ticket) {
            const activeAgent = agentRef.current;
            if (
              optimisticClaim &&
              activeAgent &&
              (targetTicketId === urlTicketId || targetTicketId === latestMessageTicketId)
            ) {
              ticket.assigned_agent_id = activeAgent.id;
              ticket.status = 'In Progress';
            }
            resolvedTicket = ticket;
          }
        } else if (targetTicketData) {
          resolvedTicket = {
            id: targetTicketData.id,
            ticket_no: targetTicketData.ticket_no,
            subject: targetTicketData.subject,
            customer_id: chatSnapshot.customer_id,
            status: 'In Progress',
            assigned_agent_id: null,
            module: null,
            issue_type: null,
            description: null,
          };
        } else {
          const conversationTicket = await getLatestInboxTicketForConversation(selectedConversationId);
          if (cancelled) return;
          resolvedTicket = conversationTicket || null;
        }

        setCurrentTicket(resolvedTicket);
        writeThreadCache(selectedConversationId, {
          messages: initialPage,
          ticket: resolvedTicket,
          hasMore,
          oldestCursor,
          fetchedAt: Date.now(),
        });
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to fetch inbox conversation state:', error);
          setCurrentTicket(null);
        }
      }
    }

    void fetchConversationState();

    const appendIncomingMessage = (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
      const normalizedMessage = normalizeInboxMessage(payload.new);
      if (!normalizedMessage) return;

      setMessages((prev) => {
        if (prev.some((message) => message.id === normalizedMessage.id)) {
          return prev;
        }

        // Reconcile optimistic agent message to prevent ghost duplicates.
        const optimisticIndex = prev.findIndex((message) => {
          if (!message.id.startsWith('temp-')) return false;
          if (message.sender_type !== 'agent') return false;
          if (normalizedMessage.sender_type !== 'agent') return false;
          if (message.staff_id !== normalizedMessage.staff_id) return false;
          if ((message.content || '').trim() !== (normalizedMessage.content || '').trim()) return false;

          const optimisticAt = new Date(message.created_at).getTime();
          const serverAt = new Date(normalizedMessage.created_at).getTime();
          return Math.abs(serverAt - optimisticAt) <= 30_000;
        });

        if (optimisticIndex >= 0) {
          const next = [...prev];
          next[optimisticIndex] = normalizedMessage;
          return next;
        }

        return [...prev, normalizedMessage];
      });
    };

    const updateIncomingMessage = (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
      const normalizedMessage = normalizeInboxMessage(payload.new);
      if (!normalizedMessage) return;

      setMessages((prev) =>
        prev.map((message) =>
          message.id === normalizedMessage.id ? normalizedMessage : message
        )
      );
    };

    const deleteIncomingMessage = (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
      setMessages((prev) => prev.filter((message) => message.id !== (payload.old as InboxMessage).id));
    };

    const threadTicketId = getThreadTicketId();
    const channel = supabase
      .channel(`chat_realtime_${selectedConversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        appendIncomingMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        updateIncomingMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        deleteIncomingMessage
      );

    if (threadTicketId) {
      channel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `ticket_id=eq.${threadTicketId}`,
          },
          appendIncomingMessage
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `ticket_id=eq.${threadTicketId}`,
          },
          updateIncomingMessage
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'messages',
            filter: `ticket_id=eq.${threadTicketId}`,
          },
          deleteIncomingMessage
        );
    }

    channel.subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [getThreadTicketId, selectedConversationId, selectedTicketId]);

  useEffect(() => {
    if (!selectedConversationId || messages.length === 0) return;
    const existing = inboxThreadCache.get(selectedConversationId);
    writeThreadCache(selectedConversationId, {
      messages,
      ticket: currentTicket,
      hasMore: hasMoreMessages,
      oldestCursor: oldestMessageCursorRef.current,
      fetchedAt: existing?.fetchedAt || Date.now(),
    });
  }, [selectedConversationId, messages, currentTicket, hasMoreMessages]);

  async function handleLoadOlderMessages() {
    if (!selectedChat || !hasMoreMessages || loadingMoreMessages) return;

    setLoadingMoreMessages(true);
    try {
      const olderPage = await listInboxMessagesPage({
        conversationId: selectedChat.id,
        ticketId: currentTicket?.id || selectedChat.current_ticket_id || selectedChat.ticket_data?.id || null,
        limit: MESSAGE_PAGE_SIZE,
        beforeCreatedAt: oldestMessageCursorRef.current,
      });

      if (olderPage.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      oldestMessageCursorRef.current = olderPage[0].created_at;
      setHasMoreMessages(olderPage.length === MESSAGE_PAGE_SIZE);

      setMessages((prev) => {
        const prevIds = new Set(prev.map((message) => message.id));
        const filteredOlder = olderPage.filter((message) => !prevIds.has(message.id));
        if (filteredOlder.length === 0) return prev;
        return [...filteredOlder, ...prev];
      });
    } finally {
      setLoadingMoreMessages(false);
    }
  }

  async function handleSendMessage(event: FormEvent) {
    event.preventDefault();

    if (!newMessage.trim() || !selectedChat || !agent) return;

    const statusLower = currentTicket?.status?.toLowerCase();
    if (!isInternalMode && (statusLower === 'resolved' || statusLower === 'closed' || statusLower === 'fix completed')) {
      addToast(getInboxWarningToast('ไม่สามารถส่งข้อความได้', getInboxClosedTicketMessage()));
      return;
    }

    const optimisticMessage: InboxMessage = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      sender_type: 'agent',
      staff_id: agent.id,
      conversation_id: selectedChat.id,
      ticket_id: currentTicket?.id || selectedChat.current_ticket_id || null,
      message_type: 'text',
      is_internal: isInternalMode,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      await sendInboxAgentMessage({
        conversationId: selectedChat.id,
        ticketId: currentTicket?.id || selectedChat.current_ticket_id || null,
        staffId: agent.id,
        content: optimisticMessage.content || '',
        messageType: 'text',
        isInternal: isInternalMode,
      });
    } catch (error: unknown) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      addToast(getInboxErrorToast('ส่งข้อความไม่สำเร็จ', getInboxActionFailedMessage('Failed', error)));
    } finally {
      setSending(false);
    }
  }

  async function handleClaim() {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !agent) return;

    setCurrentTicket((prev) =>
      prev
        ? {
            ...prev,
            assigned_agent_id: agent.id,
            status: 'In Progress',
          }
        : prev
    );

    try {
      const claimedTicket = await claimInboxTicket(ticketId, agent.id);
      setCurrentTicket(claimedTicket);
      addToast(getInboxClaimSuccessToast(claimedTicket));
    } catch (error: unknown) {
      addToast(getInboxErrorToast('รับงานไม่สำเร็จ', getInboxActionFailedMessage('Failed to claim', error)));
    }
  }

  function handleResolve() {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !agent) return;

    setResSummary('');
    setSelectedModule(currentTicket?.module || '');
    setSelectedIssueType(currentTicket?.issue_type || '');
    setShowResolveModal(true);
  }

  async function handleExecuteResolve() {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !selectedModule || !resSummary.trim() || !selectedChat) return;

    setSending(true);
    const closingConversationId = selectedChat.id;
    const markConversationClosedLocally = () => {
      setSelectedChat((prev) => {
        if (!prev || prev.id !== closingConversationId) return prev;
        return {
          ...prev,
          status: 'closed',
          is_active: false,
          current_ticket_id: null,
        };
      });
    };

    try {
      const resolvedTicket = await resolveInboxTicket({
        ticketId,
        agentId: agent?.id,
        resolutionSummary: resSummary,
        module: selectedModule,
        issueType: selectedIssueType,
        conversationId: selectedChat.id
      });

      setCurrentTicket(resolvedTicket);
      if (resolvedTicket?.status !== 'Fix Completed') {
        markConversationClosedLocally();
      }
      setShowResolveModal(false);
      addToast(getInboxResolveSuccessToast(resolvedTicket?.status === 'Fix Completed'));
    } catch (error: unknown) {
      // Network can fail after server successfully commits resolve.
      // Re-check ticket state once before showing failure.
      const refreshedTicket = await getInboxTicketById(ticketId);
      const refreshedStatusLower = refreshedTicket?.status?.toLowerCase();
      const isActuallyResolved =
        refreshedStatusLower === 'resolved' ||
        refreshedStatusLower === 'closed' ||
        refreshedStatusLower === 'fix completed';

      if (isActuallyResolved && refreshedTicket) {
        setCurrentTicket(refreshedTicket);
        if (refreshedStatusLower !== 'fix completed') {
          markConversationClosedLocally();
        }
        setShowResolveModal(false);
        addToast(getInboxResolveSuccessToast(refreshedTicket?.status === 'Fix Completed'));
      } else {
        addToast(getInboxErrorToast('ปิดงานไม่สำเร็จ', getInboxActionFailedMessage('Failed', error)));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCloseSession() {
    if (!selectedChat) return;

    try {
      await closeInboxConversation(selectedChat.id);
      setSelectedChat((prev) => (prev ? { ...prev, status: 'closed', is_active: false } : null));
      addToast(getInboxCloseSuccessToast());
    } catch (error: unknown) {
      addToast(getInboxErrorToast('จบการสนทนาไม่สำเร็จ', getInboxActionFailedMessage('Failed', error)));
    }
  }

  return {
    messages,
    setMessages,
    newMessage,
    setNewMessage,
    isInternalMode,
    setIsInternalMode,
    currentTicket,
    setCurrentTicket,
    sending,
    setSending,
    showResolveModal,
    setShowResolveModal,
    resSummary,
    setResSummary,
    selectedModule,
    setSelectedModule,
    selectedIssueType,
    setSelectedIssueType,
    hasMoreMessages,
    loadingMoreMessages,
    messagesEndRef,
    handleSendMessage,
    handleLoadOlderMessages,
    handleClaim,
    handleResolve,
    handleExecuteResolve,
    handleCloseSession,
  };
}


