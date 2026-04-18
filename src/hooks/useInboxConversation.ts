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
  sendInboxSystemMessage,
} from '@/lib/inbox/mutations';
import {
  getInboxTicketById,
  getLatestOpenInboxTicketForCustomer,
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
      const initialPage = await listInboxMessagesPage({
        conversationId: selectedChat!.id,
        limit: MESSAGE_PAGE_SIZE,
      });

      setMessages(initialPage);
      oldestMessageCursorRef.current =
        initialPage.length > 0 ? initialPage[0].created_at : null;
      setHasMoreMessages(initialPage.length === MESSAGE_PAGE_SIZE);

      if (selectedChat!.current_ticket_id) {
        setCurrentTicket(await getInboxTicketById(selectedChat!.current_ticket_id));
        return;
      }

      const recentTicket = await getLatestOpenInboxTicketForCustomer(selectedChat!.customer_id);

      if (recentTicket) {
        await linkConversationToTicket(selectedChat!.id, recentTicket.id);
        setCurrentTicket(recentTicket);
      } else {
        setCurrentTicket(null);
      }
    }

    fetchConversationState();

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
        (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
          const normalizedMessage = normalizeInboxMessage(payload.new);
          if (!normalizedMessage) return;

          setMessages((prev) => {
            if (prev.some((message) => message.id === normalizedMessage.id)) {
              return prev;
            }
            return [...prev, normalizedMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat!.id}`,
        },
        (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
          const normalizedMessage = normalizeInboxMessage(payload.new);
          if (!normalizedMessage) return;

          setMessages((prev) =>
            prev.map((message) =>
              message.id === normalizedMessage.id ? normalizedMessage : message
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${selectedChat!.id}`,
        },
        (payload: RealtimePostgresChangesPayload<InboxMessage>) => {
          setMessages((prev) => prev.filter((message) => message.id !== (payload.old as InboxMessage).id));
        }
      )
      .subscribe();

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
      ticket_id: selectedChat.current_ticket_id || null,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      await sendInboxAgentMessage({
        conversationId: selectedChat.id,
        ticketId: selectedChat.current_ticket_id || null,
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
    const ticketId = selectedChat?.current_ticket_id || currentTicket?.id;
    if (!ticketId || !agent) return;

    setResSummary('');
    setSelectedModule(currentTicket?.module || '');
    setSelectedIssueType(currentTicket?.issue_type || '');
    setShowResolveModal(true);
  }

  async function handleExecuteResolve() {
    const ticketId = selectedChat?.current_ticket_id || currentTicket?.id;
    if (!ticketId || !selectedModule || !resSummary.trim() || !selectedChat) return;

    setSending(true);

    try {
      const resolvedTicket = await resolveInboxTicket({
        ticketId,
        agentId: agent?.id,
        resolutionSummary: resSummary,
        module: selectedModule,
        issueType: selectedIssueType,
      });

      const surveyLink = `${window.location.origin}/survey/${ticketId}`;
      await sendInboxSystemMessage(
        selectedChat.id,
        `[SYSTEM] งานได้รับการแก้ไขแล้ว: ${resSummary}\nโมดูล: ${selectedModule}\nแบบประเมิน: ${surveyLink}`
      );

      setCurrentTicket(resolvedTicket);
      setShowResolveModal(false);
      setSelectedChat(null);
      addToast(getInboxResolveSuccessToast());
    } catch (error: unknown) {
      alert(getInboxActionFailedMessage('Failed', error));
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
