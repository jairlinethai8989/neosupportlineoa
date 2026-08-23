import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import {
  claimInboxTicket,
  closeInboxConversation,
  resolveInboxTicket,
  sendInboxAgentMessage,
} from '@/lib/inbox/mutations';
import {
  getInboxTicketByIdAction,
  getLatestInboxTicketForConversationAction,
  listInboxMessagesPageAction,
} from '@/app/actions/inboxReadActions';
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
      const urlParams = new URLSearchParams(window.location.search);
      const urlTicketId = urlParams.get('tid');
      const urlConversationId = urlParams.get('cid');
      const threadTicketId =
        urlTicketId ||
        selectedChat!.current_ticket_id ||
        selectedChat!.ticket_data?.id ||
        null;

      const initialPage = await listInboxMessagesPageAction({
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

      const optimisticClaim = urlParams.get('oc') === '1';

      let targetTicketId: string | null = null;
      let targetTicketData: InboxConversation['ticket_data'] = null;

      const shouldUseUrlTicket =
        Boolean(urlTicketId) &&
        (!urlConversationId || urlConversationId === selectedChat!.id);

      if (shouldUseUrlTicket && urlTicketId) {
        targetTicketId = urlTicketId;
      } else if (latestMessageTicketId) {
        targetTicketId = latestMessageTicketId;
      } else if (selectedChat!.ticket_data) {
        targetTicketData = selectedChat!.ticket_data;
      } else if (selectedChat!.current_ticket_id) {
        targetTicketId = selectedChat!.current_ticket_id;
      }

      if (targetTicketId) {
        const ticket = await getInboxTicketByIdAction(targetTicketId);
        if (ticket) {
          if (optimisticClaim && agent && (targetTicketId === urlTicketId || targetTicketId === latestMessageTicketId)) {
            ticket.assigned_agent_id = agent.id;
            ticket.status = 'In Progress';
          }
          setCurrentTicket(ticket);
          return;
        }
      }

      if (targetTicketData) {
        setCurrentTicket({
          id: targetTicketData.id,
          ticket_no: targetTicketData.ticket_no,
          subject: targetTicketData.subject,
          customer_id: selectedChat!.customer_id,
          status: 'In Progress',
          assigned_agent_id: null,
          module: null,
          issue_type: null,
          description: null,
        });
        return;
      }

      const conversationTicket = await getLatestInboxTicketForConversationAction(selectedChat!.id);
      if (conversationTicket) {
        setCurrentTicket(conversationTicket);
      } else {
        setCurrentTicket(null);
      }
      } catch (error) {
        console.error('Failed to fetch inbox conversation state:', error);
        setCurrentTicket(null);
      }
    }

    fetchConversationState();

    const threadTicketId = getThreadTicketId();
    let polling = false;
    const refreshLatestMessages = async () => {
      if (polling) return;
      polling = true;
      try {
        const latest = await listInboxMessagesPageAction({
          conversationId: selectedChat!.id,
          ticketId: threadTicketId,
          limit: MESSAGE_PAGE_SIZE,
        });
        setMessages((previous) => {
          const firstLatestAt = latest[0]?.created_at;
          const latestIds = new Set(latest.map((message) => message.id));
          const older = firstLatestAt
            ? previous.filter((message) => !message.id.startsWith('temp-') && message.created_at < firstLatestAt)
            : [];
          const optimistic = previous.filter((message) => {
            if (!message.id.startsWith('temp-')) return false;
            return !latest.some((serverMessage) =>
              serverMessage.sender_type === 'agent' &&
              serverMessage.staff_id === message.staff_id &&
              (serverMessage.content || '').trim() === (message.content || '').trim() &&
              Math.abs(Date.parse(serverMessage.created_at) - Date.parse(message.created_at)) <= 30_000
            );
          });
          const merged = [...older, ...latest, ...optimistic];
          return merged.filter((message, index) =>
            message.id.startsWith('temp-') || latestIds.has(message.id) ||
            merged.findIndex((candidate) => candidate.id === message.id) === index
          ).sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
        });
      } catch {
        // Retain the current thread during transient polling failures.
      } finally {
        polling = false;
      }
    };
    const pollingInterval = setInterval(() => { void refreshLatestMessages(); }, 5_000);

    return () => {
      clearInterval(pollingInterval);
    };
  }, [getThreadTicketId, selectedChat, setSelectedChat, addToast, agent]);

  async function handleLoadOlderMessages() {
    if (!selectedChat || !hasMoreMessages || loadingMoreMessages) return;

    setLoadingMoreMessages(true);
    try {
      const olderPage = await listInboxMessagesPageAction({
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
    if (statusLower === 'resolved' || statusLower === 'closed' || statusLower === 'fix completed') {
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
      markConversationClosedLocally();
      setShowResolveModal(false);
      addToast(getInboxResolveSuccessToast(resolvedTicket?.status === 'Fix Completed'));
    } catch (error: unknown) {
      // Network can fail after server successfully commits resolve.
      // Re-check ticket state once before showing failure.
      const refreshedTicket = await getInboxTicketByIdAction(ticketId);
      const refreshedStatusLower = refreshedTicket?.status?.toLowerCase();
      const isActuallyResolved =
        refreshedStatusLower === 'resolved' || 
        refreshedStatusLower === 'closed' || 
        refreshedStatusLower === 'fix completed';

      if (isActuallyResolved && refreshedTicket) {
        setCurrentTicket(refreshedTicket);
        markConversationClosedLocally();
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


