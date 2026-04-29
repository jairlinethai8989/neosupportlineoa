import {
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
  getInboxResolveSuccessToast,
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

export function useInboxConversation({
  selectedChat,
  setSelectedChat,
  agent,
  addToast,
}: UseInboxConversationOptions) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
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

  const getThreadTicketId = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return (
      urlParams.get('tid') ||
      selectedChat?.current_ticket_id ||
      selectedChat?.ticket_data?.id ||
      null
    );
  };

  useEffect(() => {
    const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;
    if (lastMessageId && lastMessageId !== lastRenderedMessageIdRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastRenderedMessageIdRef.current = lastMessageId;
  }, [messages]);

  useEffect(() => {
    if (!selectedChat) {
      setMessages([]);
      setCurrentTicket(null);
      setHasMoreMessages(false);
      oldestMessageCursorRef.current = null;
      return;
    }

    async function fetchConversationState() {
      try {
      const safeLinkConversationToTicket = async (conversationId: string, ticketId: string) => {
        try {
          await linkConversationToTicket(conversationId, ticketId);
        } catch (linkError) {
          // Link failure should not block displaying existing thread messages.
          console.warn('Skipped conversation-ticket relink:', linkError);
        }
      };

      const urlParams = new URLSearchParams(window.location.search);
      const urlTicketId = urlParams.get('tid');
      const urlConversationId = urlParams.get('cid');
      const threadTicketId =
        urlTicketId ||
        selectedChat!.current_ticket_id ||
        selectedChat!.ticket_data?.id ||
        null;

      const initialPage = await listInboxMessagesPage({
        conversationId: selectedChat!.id,
        ticketId: threadTicketId,
        limit: MESSAGE_PAGE_SIZE,
      });

      setMessages(initialPage);
      oldestMessageCursorRef.current =
        initialPage.length > 0 ? initialPage[0].created_at : null;
      setHasMoreMessages(initialPage.length === MESSAGE_PAGE_SIZE);

      const latestMessageTicketId =
        [...initialPage]
          .reverse()
          .find((message) => Boolean(message.ticket_id))
          ?.ticket_id || null;

      // 1. Prioritize Ticket ID from URL (Deep Link)
      const shouldUseUrlTicket =
        Boolean(urlTicketId) &&
        (!urlConversationId || urlConversationId === selectedChat!.id);

      if (shouldUseUrlTicket && urlTicketId) {
        const ticket = await getInboxTicketById(urlTicketId);
        if (ticket) {
          setCurrentTicket(ticket);
          // Auto-link if needed
          if (selectedChat!.current_ticket_id !== urlTicketId) {
            await safeLinkConversationToTicket(selectedChat!.id, urlTicketId);
          }
          return;
        }
      }

      // 2. Prefer ticket bound to this conversation's message stream.
      if (latestMessageTicketId) {
        const messageTicket = await getInboxTicketById(latestMessageTicketId);
        if (messageTicket) {
          setCurrentTicket(messageTicket);
          if (selectedChat!.current_ticket_id !== messageTicket.id) {
            await safeLinkConversationToTicket(selectedChat!.id, messageTicket.id);
          }
          return;
        }
      }

      // 3. Use Metadata if available from query
      if (selectedChat!.ticket_data) {
        setCurrentTicket({
          id: selectedChat!.ticket_data.id,
          ticket_no: selectedChat!.ticket_data.ticket_no,
          subject: selectedChat!.ticket_data.subject,
          customer_id: selectedChat!.customer_id,
          status: 'In Progress',
          assigned_agent_id: null,
          module: null,
          issue_type: null,
          description: null,
        });
        return;
      }

      // 4. Fallback to current_ticket_id on record
      if (selectedChat!.current_ticket_id) {
        setCurrentTicket(await getInboxTicketById(selectedChat!.current_ticket_id));
        return;
      }

      // 5. Safe fallback: derive ticket only from messages inside this conversation.
      // Never link by customer-level "latest open ticket", because it can cross-link
      // different chats of the same customer to a single ticket.
      const conversationTicket = await getLatestInboxTicketForConversation(selectedChat!.id);
      if (conversationTicket) {
        setCurrentTicket(conversationTicket);
        if (selectedChat!.current_ticket_id !== conversationTicket.id) {
          await safeLinkConversationToTicket(selectedChat!.id, conversationTicket.id);
        }
      } else {
        setCurrentTicket(null);
      }
      } catch (error) {
        console.error('Failed to fetch inbox conversation state:', error);
        setCurrentTicket(null);
      }
    }

    fetchConversationState();

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
      .channel(`chat_realtime_${selectedChat!.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat!.id}`,
        },
        appendIncomingMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat!.id}`,
        },
        updateIncomingMessage
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat!.id}`,
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
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

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

    if (currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed') {
      alert(getInboxClosedTicketMessage());
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
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      await sendInboxAgentMessage({
        conversationId: selectedChat.id,
        ticketId: currentTicket?.id || selectedChat.current_ticket_id || null,
        content: optimisticMessage.content || '',
        messageType: 'text',
      });
    } catch (error: unknown) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      alert(getInboxActionFailedMessage('Failed', error));
    } finally {
      setSending(false);
    }
  }

  async function handleClaim() {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !agent) return;

    try {
      const claimedTicket = await claimInboxTicket(ticketId, agent.id);
      setCurrentTicket(claimedTicket);
      addToast(getInboxClaimSuccessToast(claimedTicket));
    } catch (error: unknown) {
      alert(getInboxActionFailedMessage('Failed to claim', error));
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
      const surveyLink = `${window.location.origin}/survey/${ticketId}`;
      
      const resolvedTicket = await resolveInboxTicket({
        ticketId,
        agentId: agent?.id,
        resolutionSummary: resSummary,
        module: selectedModule,
        issueType: selectedIssueType,
        conversationId: selectedChat.id,
        surveyLink
      });

      setCurrentTicket(resolvedTicket);
      markConversationClosedLocally();
      setShowResolveModal(false);
      addToast(getInboxResolveSuccessToast());
    } catch (error: unknown) {
      // Network can fail after server successfully commits resolve.
      // Re-check ticket state once before showing failure.
      const refreshedTicket = await getInboxTicketById(ticketId);
      const isActuallyResolved =
        refreshedTicket?.status === 'Resolved' || refreshedTicket?.status === 'Closed';

      if (isActuallyResolved && refreshedTicket) {
        setCurrentTicket(refreshedTicket);
        markConversationClosedLocally();
        setShowResolveModal(false);
        addToast(getInboxResolveSuccessToast());
      } else {
        alert(getInboxActionFailedMessage('Failed', error));
      }
    } finally {
      setSending(false);
    }
  }

  async function handleCloseSession() {
    if (!selectedChat || !confirm('คุณต้องการจบการสนทนานี้ใช่หรือไม่?')) return;

    try {
      await closeInboxConversation(selectedChat.id);
      setSelectedChat((prev) => (prev ? { ...prev, status: 'closed', is_active: false } : null));
      addToast(getInboxCloseSuccessToast());
    } catch (error: unknown) {
      alert(getInboxActionFailedMessage('Failed', error));
    }
  }

  return {
    messages,
    setMessages,
    newMessage,
    setNewMessage,
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
