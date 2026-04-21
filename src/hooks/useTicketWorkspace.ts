'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { normalizeTicketWorkspaceTicket } from '@/lib/tickets/normalizers';
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

function isTicketWithinWorkspaceRange(
  ticket: Pick<TicketWorkspaceTicket, 'created_at'>,
  timeRange: TicketWorkspaceTimeRange,
  customStart: string,
  customEnd: string
) {
  if (!ticket.created_at) return false;

  const createdAtMs = new Date(ticket.created_at).getTime();
  if (Number.isNaN(createdAtMs)) return false;

  const { fromIso, toIso } = getTicketWorkspaceDateRange(timeRange, customStart, customEnd);
  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();

  return createdAtMs >= fromMs && createdAtMs <= toMs;
}

function upsertWorkspaceTicket(
  previousTickets: TicketWorkspaceTicket[],
  nextTicket: TicketWorkspaceTicket
) {
  const existingIndex = previousTickets.findIndex((ticket) => ticket.id === nextTicket.id);
  if (existingIndex === -1) {
    return [nextTicket, ...previousTickets];
  }

  return previousTickets.map((ticket, index) =>
    index === existingIndex ? nextTicket : ticket
  );
}

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
      return ticket.customers?.display_name || (ticket.assigned_agent ? `👷‍♂️ ${ticket.assigned_agent.display_name}` : '');
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

  const fetchData = useCallback(async (isSilent = false) => {
    setDebugError(null);
    if (!isSilent) setLoading(true);

    const { fromIso, toIso } = getTicketWorkspaceDateRange(timeRange, customStart, customEnd);
    const [conversationResult, ticketResult] = await Promise.allSettled([
      listTicketWorkspaceConversations(),
      listTicketWorkspaceTickets({ fromIso, toIso, limit: 300 }),
    ]);

    const errors: string[] = [];

    if (conversationResult.status === 'fulfilled') {
      setConversations(conversationResult.value);
    } else {
      console.error('Fetch conversations error:', conversationResult.reason);
      errors.push(
        conversationResult.reason instanceof Error
          ? conversationResult.reason.message
          : 'Failed to load conversations'
      );
    }

    if (ticketResult.status === 'fulfilled') {
      setTickets(ticketResult.value);
    } else {
      console.error('Fetch tickets error:', ticketResult.reason);
      errors.push(
        ticketResult.reason instanceof Error
          ? ticketResult.reason.message
          : 'Failed to load tickets'
      );
    }

    if (errors.length > 0) {
      setDebugError(errors.join(' | '));
    }

    if (!isSilent) setLoading(false);
  }, [customEnd, customStart, timeRange]);

  const syncTicketFromRealtime = useCallback(
    async (ticketId: string, fallbackValue?: unknown) => {
      // 1. Optimistic Update for instant UI feedback
      const fallbackTicket = normalizeTicketWorkspaceTicket(fallbackValue);
      // Guarantee any new realtime ticket defaults to 'New' if status is mysteriously missing
      if (fallbackTicket) {
        if (!fallbackTicket.status) fallbackTicket.status = 'New';
        setTickets((previousTickets) => upsertWorkspaceTicket(previousTickets, fallbackTicket));
      }

      // 2. Fetch full data (with relations) and retry logic for replica delays
      try {
        let latestTicket = null;
        for (let i = 0; i < 3; i++) {
          try {
            latestTicket = await getTicketWorkspaceTicketById(ticketId);
            if (latestTicket) break;
          } catch (err) {
            if (i === 2) throw err;
            await new Promise((resume) => setTimeout(resume, 1000));
          }
        }

        if (latestTicket && isTicketWithinWorkspaceRange(latestTicket, timeRange, customStart, customEnd)) {
          setTickets((previousTickets) => upsertWorkspaceTicket(previousTickets, latestTicket));
        } else if (latestTicket && !isTicketWithinWorkspaceRange(latestTicket, timeRange, customStart, customEnd)) {
          // If the real ticket is somehow out of range, remove the optimistic one
          setTickets((previousTickets) =>
            previousTickets.filter((ticket) => ticket.id !== ticketId)
          );
        }
      } catch (error) {
        console.error('Realtime ticket sync error:', error);
        setDebugError(error instanceof Error ? error.message : 'Realtime ticket sync failed');
      }
    },
    [customEnd, customStart, timeRange]
  );

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

    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDataRefresh = () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        void fetchData(true);
      }, 4000);
    };

    const channel = supabase
      .channel('workspace-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.new.id || '');
        if (!ticketId) return;

        void syncTicketFromRealtime(ticketId, payload.new);
        scheduleDataRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.new.id || payload.old.id || '');
        if (!ticketId) return;

        void syncTicketFromRealtime(ticketId, payload.new);
        scheduleDataRefresh();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.old.id || '');
        if (!ticketId) return;

        setTickets((previousTickets) =>
          previousTickets.filter((ticket) => ticket.id !== ticketId)
        );
        scheduleDataRefresh();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        scheduleDataRefresh();
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setDebugError(`Workspace realtime ${status.toLowerCase()}`);
        }
      });

    return () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchData, loadSettings, syncTicketFromRealtime]);

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
        ['active', 'open', 'new', 'pending'].includes((conversation.status || '').toLowerCase())
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
      const updatedTicket = await resolveWorkspaceTicket({
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
      
      setTickets((prev) => upsertWorkspaceTicket(prev, updatedTicket));
      
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

        const updatedTicket = await claimWorkspaceTicket(ticketId, user.id);
        
        setTickets((prev) => upsertWorkspaceTicket(prev, updatedTicket));
        
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

  const isChatActive = useMemo(() => {
    if (!resolvingTicket || !conversations.length) return false;
    return conversations.some(
      (conversation) =>
        (conversation.current_ticket_id === resolvingTicket.id ||
          conversation.customer_id === resolvingTicket.customer_id) &&
        ['active', 'open', 'new', 'pending'].includes((conversation.status || '').toLowerCase())
    );
  }, [resolvingTicket, conversations]);

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
    isChatActive,
  };
}
