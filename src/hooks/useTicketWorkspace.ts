'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import {
  getTicketWorkspaceActiveConversationToast,
  getTicketWorkspaceClaimFailToast,
  getTicketWorkspaceClaimSuccessToast,
  getTicketWorkspaceClaimViewOnlyToast,
  getTicketWorkspaceLoginRequiredToast,
  getTicketWorkspaceResolveFailToast,
  getTicketWorkspaceResolveSuccessToast,
} from '@/lib/tickets/feedback';
import { claimWorkspaceTicket, resolveWorkspaceTicket } from '@/lib/tickets/mutations';
import {
  getTicketWorkspaceConversationById,
  getTicketWorkspaceCompanySettings,
  getTicketWorkspaceProfile,
  getTicketWorkspaceTicketById,
  getTicketWorkspaceUser,
  listTicketWorkspaceConversations,
  listTicketWorkspaceTickets,
} from '@/lib/tickets/queries';
import type {
  TicketWorkspaceConversation,
  TicketWorkspaceProfile,
  TicketWorkspaceSortConfig,
  TicketWorkspaceTicket,
  TicketWorkspaceTimeRange,
  TicketsViewMode,
} from '@/types/tickets';

const DEFAULT_MODULES = [
  'Doctor Office',
  'Nurse Station',
  'Inpatient Pharmacy',
  'Medical Records',
  'Operating Room',
  'Anesthesia',
  'Consultation',
  'All',
];

function getTicketWorkspaceDateRange(
  timeRange: TicketWorkspaceTimeRange,
  customStart: string,
  customEnd: string
) {
  let from: Date | null = null;
  let to = new Date();
  to.setHours(23, 59, 59, 999);

  if (timeRange === 'today') {
    from = new Date();
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'week') {
    from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'month') {
    from = new Date();
    from.setDate(from.getDate() - 31);
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'custom') {
    from = customStart ? new Date(customStart) : new Date();
    to = customEnd ? new Date(customEnd) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  }

  return {
    fromIso: from ? from.toISOString() : '2000-01-01T00:00:00Z',
    toIso: to.toISOString(),
  };
}

function getTicketWorkspaceSortValue(ticket: TicketWorkspaceTicket, key: string): number | string {
  switch (key) {
    case 'ticket_no':
      return ticket.ticket_no || '';
    case 'subject':
      return ticket.subject || '';
    case 'hospital':
      return ticket.hospitals?.name || '';
    case 'customer':
      return ticket.customers?.display_name || '';
    case 'agent':
      return ticket.assigned_agent?.display_name || '';
    case 'status':
      return ticket.status || '';
    case 'created_at':
      return ticket.created_at ? new Date(ticket.created_at).getTime() : 0;
    default:
      return '';
  }
}

export function useTicketWorkspace(filterCustomerId: string | null) {
  const { addToast } = useNotificationContext();
  const [tickets, setTickets] = useState<TicketWorkspaceTicket[]>([]);
  const [conversations, setConversations] = useState<TicketWorkspaceConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<TicketsViewMode>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [debugError, setDebugError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<TicketWorkspaceProfile | null>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<TicketWorkspaceTicket | null>(null);
  const [resSummary, setResSummary] = useState('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState<TicketWorkspaceTimeRange>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [sortConfig, setSortConfig] = useState<TicketWorkspaceSortConfig>({
    key: 'created_at',
    direction: 'desc',
  });

  const isViewOnly =
    userProfile?.role !== 'Administrator' &&
    userProfile?.permissions?.tickets === 'view';

  const fetchData = useCallback(async () => {
    setDebugError(null);

    try {
      const { fromIso, toIso } = getTicketWorkspaceDateRange(timeRange, customStart, customEnd);
      const [conversationData, ticketData] = await Promise.all([
        listTicketWorkspaceConversations(),
        listTicketWorkspaceTickets({ fromIso, toIso, limit: 300 }),
      ]);

      setTickets(ticketData);
      setConversations(conversationData);
    } catch (error) {
      console.error('Fetch tickets error:', error);
      setDebugError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [customEnd, customStart, timeRange]);

  const loadSettings = useCallback(async () => {
    if (settingsLoaded) return;
    try {
      const companyData = await getTicketWorkspaceCompanySettings();
      setAvailableModules(companyData?.modules?.length ? companyData.modules : DEFAULT_MODULES);
      setAvailableIssueTypes(companyData?.issue_types?.length ? companyData.issue_types : []);
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Load ticket workspace settings error:', error);
      setAvailableModules(DEFAULT_MODULES);
      setAvailableIssueTypes([]);
      setSettingsLoaded(true);
    }
  }, [settingsLoaded]);

  useEffect(() => {
    async function fetchUserProfile() {
      const user = await getTicketWorkspaceUser();
      if (!user) return;

      const profile = await getTicketWorkspaceProfile(user.id);
      setUserProfile(profile);
      if (profile?.resolution_templates) {
        setPersonalResTemplates(profile.resolution_templates);
      }
    }

    fetchUserProfile();
    fetchData();
    loadSettings();

    const pendingTicketIds = new Set<string>();
    const pendingConversationIds = new Set<string>();
    let ticketFlushTimer: ReturnType<typeof setTimeout> | null = null;
    let conversationFlushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushTickets = async () => {
      const ids = Array.from(pendingTicketIds);
      pendingTicketIds.clear();
      ticketFlushTimer = null;
      if (ids.length === 0) return;

      const updatedRows = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getTicketWorkspaceTicketById(id);
          } catch {
            return null;
          }
        })
      );

      const normalizedRows = updatedRows.filter((row): row is TicketWorkspaceTicket => Boolean(row));
      if (normalizedRows.length === 0) return;

      setTickets((prev) => {
        const next = [...prev];
        for (const row of normalizedRows) {
          const index = next.findIndex((item) => item.id === row.id);
          if (index >= 0) {
            next[index] = row;
          } else {
            next.unshift(row);
          }
        }
        return next;
      });
    };

    const flushConversations = async () => {
      const ids = Array.from(pendingConversationIds);
      pendingConversationIds.clear();
      conversationFlushTimer = null;
      if (ids.length === 0) return;

      const updatedRows = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getTicketWorkspaceConversationById(id);
          } catch {
            return null;
          }
        })
      );

      const normalizedRows = updatedRows.filter(
        (row): row is TicketWorkspaceConversation => Boolean(row)
      );
      if (normalizedRows.length === 0) return;

      setConversations((prev) => {
        const next = [...prev];
        for (const row of normalizedRows) {
          const index = next.findIndex((item) => item.id === row.id);
          if (index >= 0) {
            next[index] = row;
          } else {
            next.unshift(row);
          }
        }
        return next;
      });
    };

    const scheduleTicketFlush = (id: string) => {
      pendingTicketIds.add(id);
      if (ticketFlushTimer) return;
      ticketFlushTimer = setTimeout(() => {
        void flushTickets();
      }, 120);
    };

    const scheduleConversationFlush = (id: string) => {
      pendingConversationIds.add(id);
      if (conversationFlushTimer) return;
      conversationFlushTimer = setTimeout(() => {
        void flushConversations();
      }, 120);
    };

    const channel = supabase
      .channel('workspace-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setTickets((prev) => prev.filter((ticket) => ticket.id !== payload.old.id));
          return;
        }
        scheduleTicketFlush(payload.new.id);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (payload) => {
        if (payload.eventType === 'DELETE') {
          setConversations((prev) =>
            prev.filter((conversation) => conversation.id !== payload.old.id)
          );
          return;
        }
        scheduleConversationFlush(payload.new.id);
      })
      .subscribe();

    return () => {
      if (ticketFlushTimer) clearTimeout(ticketFlushTimer);
      if (conversationFlushTimer) clearTimeout(conversationFlushTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData, loadSettings]);

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (filterCustomerId) {
      result = result.filter((ticket) => ticket.customer_id === filterCustomerId);
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter((ticket) => {
        const ticketNo = String(ticket.ticket_no || '').toLowerCase();
        const subject = String(ticket.subject || '').toLowerCase();
        const customer = String(ticket.customers?.display_name || '').toLowerCase();
        return ticketNo.includes(query) || subject.includes(query) || customer.includes(query);
      });
    }

    if (!sortConfig.key) return result;

    result.sort((left, right) => {
      const leftValue = getTicketWorkspaceSortValue(left, sortConfig.key);
      const rightValue = getTicketWorkspaceSortValue(right, sortConfig.key);

      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filterCustomerId, searchTerm, sortConfig, tickets]);

  const getConvId = useCallback(
    (ticket: TicketWorkspaceTicket) => {
      const linked = conversations.find((conversation) => conversation.current_ticket_id === ticket.id);
      if (linked) return linked.id;

      const active = conversations.find(
        (conversation) =>
          conversation.customer_id === ticket.customer_id &&
          conversation.status === 'active'
      );
      if (active) return active.id;

      return conversations.find((conversation) => conversation.customer_id === ticket.customer_id)?.id;
    },
    [conversations]
  );

  const openResolveModal = useCallback((ticket: TicketWorkspaceTicket) => {
    setResolvingTicket(ticket);
    setResSummary('');
    setSelectedModule('');
    setSelectedIssueType('');
    setShowResolveModal(true);
  }, []);

  const closeResolveModal = useCallback(() => {
    setShowResolveModal(false);
  }, []);

  const handleExecuteResolve = useCallback(async () => {
    if (!resolvingTicket || !resSummary.trim()) return;

    const activeConv = conversations.find(
      (conversation) =>
        (conversation.current_ticket_id === resolvingTicket.id ||
          conversation.customer_id === resolvingTicket.customer_id) &&
        conversation.status === 'active'
    );

    if (activeConv) {
      addToast(getTicketWorkspaceActiveConversationToast());
      return;
    }

    try {
      setLoading(true);
      const user = await getTicketWorkspaceUser();
      if (!user) {
        addToast(getTicketWorkspaceLoginRequiredToast());
        return;
      }

      const resolvedTicket = resolvingTicket;
      await resolveWorkspaceTicket({
        ticketId: resolvedTicket.id,
        agentId: user.id,
        resolutionSummary: resSummary,
        module: selectedModule,
        issueType: selectedIssueType,
      });

      setShowResolveModal(false);
      setResolvingTicket(null);
      setResSummary('');
      setSelectedModule('');
      setSelectedIssueType('');
      await fetchData();
      addToast(getTicketWorkspaceResolveSuccessToast(resolvedTicket));
    } catch (error) {
      addToast(getTicketWorkspaceResolveFailToast(error));
    } finally {
      setLoading(false);
    }
  }, [
    addToast,
    conversations,
    fetchData,
    resSummary,
    resolvingTicket,
    selectedIssueType,
    selectedModule,
  ]);

  const handleClaim = useCallback(
    async (ticketId: string) => {
      if (isViewOnly) {
        addToast(getTicketWorkspaceClaimViewOnlyToast());
        return;
      }

      setClaimingId(ticketId);
      try {
        const user = await getTicketWorkspaceUser();
        if (!user) {
          addToast(getTicketWorkspaceLoginRequiredToast());
          return;
        }

        await claimWorkspaceTicket(ticketId, user.id);
        await fetchData();
        addToast(getTicketWorkspaceClaimSuccessToast(ticketId));
      } catch (error) {
        console.error('Claim Error:', error);
        addToast(getTicketWorkspaceClaimFailToast(error));
      } finally {
        setClaimingId(null);
      }
    },
    [addToast, fetchData, isViewOnly]
  );

  const handleSort = useCallback(
    (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
        direction = 'desc';
      }
      setSortConfig({ key, direction });
    },
    [sortConfig.direction, sortConfig.key]
  );

  return {
    availableIssueTypes,
    availableModules,
    claimingId,
    closeResolveModal,
    customEnd,
    customStart,
    debugError,
    filteredTickets,
    getConvId,
    handleClaim,
    handleExecuteResolve,
    handleSort,
    isViewOnly,
    loading,
    openResolveModal,
    personalResTemplates,
    resSummary,
    resolvingTicket,
    searchTerm,
    selectedIssueType,
    selectedModule,
    setCustomEnd,
    setCustomStart,
    setResSummary,
    setSearchTerm,
    setSelectedIssueType,
    setSelectedModule,
    setTimeRange,
    setViewMode,
    showResolveModal,
    sortConfig,
    timeRange,
    userProfile,
    viewMode,
  };
}
