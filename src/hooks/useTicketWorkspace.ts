'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  listTicketWorkspaceConversationsByTicketIds,
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
const WORKSPACE_TICKETS_PAGE_SIZE = 150;
type TicketCursor = { createdAt: string; id: string } | null;

function getTicketStatus(
  ticket: Pick<TicketWorkspaceTicket, 'status'> | null | undefined
): string {
  return ticket?.status || '';
}

function isTicketWithinWorkspaceRange(
  ticket: Pick<TicketWorkspaceTicket, 'created_at' | 'status'>,
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

  const status = getTicketStatus(ticket);
  if (status === 'New' || status === 'Assigned' || status === 'In Progress' || status === 'Escalated' || status === 'Fix Completed' || status === 'Pending') return true;

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

function mergeWorkspaceTicketsForSilentRefresh(
  previousTickets: TicketWorkspaceTicket[],
  fetchedTickets: TicketWorkspaceTicket[],
  pendingRealtimeTicketIds: Set<string>,
  timeRange: TicketWorkspaceTimeRange,
  customStart: string,
  customEnd: string
) {
  if (pendingRealtimeTicketIds.size === 0) return fetchedTickets;

  const mergedTickets = [...fetchedTickets];
  const fetchedIds = new Set(fetchedTickets.map((ticket) => ticket.id));

  previousTickets.forEach((ticket) => {
    if (!pendingRealtimeTicketIds.has(ticket.id)) return;
    if (fetchedIds.has(ticket.id)) return;
    if (!isTicketWithinWorkspaceRange(ticket, timeRange, customStart, customEnd)) {
      const status = getTicketStatus(ticket);
      if (status !== 'New' && status !== 'Assigned' && status !== 'In Progress' && status !== 'Escalated' && status !== 'Fix Completed' && status !== 'Pending') return;
    }
    mergedTickets.unshift(ticket);
  });

  return mergedTickets;
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
    // Set to Monday of this week
    const day = from.getDay();
    const diff = from.getDate() - day + (day === 0 ? -6 : 1);
    from.setDate(diff);
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'month') {
    from = new Date();
    // Set to 1st of this month
    from.setDate(1);
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

interface TicketWorkspaceCache {
  ticketsByPage: Map<number, TicketWorkspaceTicket[]>;
  conversationsByPage: Map<number, TicketWorkspaceConversation[]>;
  hasNextPageByPage: Map<number, boolean>;
  ticketCursorByPage: Map<number, TicketCursor>;
  timeRange: TicketWorkspaceTimeRange;
  customStart: string;
  customEnd: string;
  searchTerm: string;
  sortConfig: TicketWorkspaceSortConfig;
  ticketPage: number;
  filterCustomerId: string | null;
  userProfile: TicketWorkspaceProfile | null;
  personalResTemplates: string[];
  availableModules: string[];
  availableIssueTypes: string[];
}

let ticketWorkspaceCache: TicketWorkspaceCache | null = null;

export function useTicketWorkspace(filterCustomerId: string | null) {
  const { addToast, latestTicketRealtimeEvent } = useNotificationContext();

  const getOrInitializeCache = useCallback((): TicketWorkspaceCache => {
    if (!ticketWorkspaceCache || ticketWorkspaceCache.filterCustomerId !== filterCustomerId) {
      ticketWorkspaceCache = {
        ticketsByPage: new Map(),
        conversationsByPage: new Map(),
        hasNextPageByPage: new Map(),
        ticketCursorByPage: new Map([[1, null]]),
        timeRange: 'today',
        customStart: '',
        customEnd: '',
        searchTerm: '',
        sortConfig: {
          key: 'created_at',
          direction: 'desc',
        },
        ticketPage: 1,
        filterCustomerId,
        userProfile: null,
        personalResTemplates: [],
        availableModules: [],
        availableIssueTypes: [],
      };
    }
    return ticketWorkspaceCache;
  }, [filterCustomerId]);

  const initialCache = ticketWorkspaceCache && ticketWorkspaceCache.filterCustomerId === filterCustomerId ? ticketWorkspaceCache : null;

  const [tickets, setTickets] = useState<TicketWorkspaceTicket[]>(() => {
    return initialCache?.ticketsByPage.get(initialCache.ticketPage) || [];
  });
  const [conversations, setConversations] = useState<TicketWorkspaceConversation[]>(() => {
    return initialCache?.conversationsByPage.get(initialCache.ticketPage) || [];
  });
  const [loading, setLoading] = useState(() => {
    if (!initialCache) return true;
    return !initialCache.ticketsByPage.has(initialCache.ticketPage);
  });
  const [viewModeState, setViewModeState] = useState<TicketsViewMode>('board');
  const [searchTerm, setSearchTerm] = useState(() => initialCache?.searchTerm || '');
  const [debugError, setDebugError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<TicketWorkspaceProfile | null>(() => initialCache?.userProfile || null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<TicketWorkspaceTicket | null>(null);
  const [resSummary, setResSummary] = useState('');
  const [availableModules, setAvailableModules] = useState<string[]>(() => initialCache?.availableModules || []);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>(() => initialCache?.personalResTemplates || []);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>(() => initialCache?.availableIssueTypes || []);
  const [timeRange, setTimeRange] = useState<TicketWorkspaceTimeRange>(() => initialCache?.timeRange || 'today');
  const [customStart, setCustomStart] = useState(() => initialCache?.customStart || '');
  const [customEnd, setCustomEnd] = useState(() => initialCache?.customEnd || '');
  const [sortConfig, setSortConfig] = useState<TicketWorkspaceSortConfig>(() => initialCache?.sortConfig || {
    key: 'created_at',
    direction: 'desc',
  });
  const [ticketPage, setTicketPage] = useState(() => initialCache?.ticketPage || 1);
  const [hasNextTicketPage, setHasNextTicketPage] = useState(() => {
    if (!initialCache) return false;
    return initialCache.hasNextPageByPage.get(initialCache.ticketPage) || false;
  });

  const ticketCursorByPageRef = useRef<Map<number, TicketCursor>>(
    initialCache?.ticketCursorByPage || new Map([[1, null]])
  );
  const pendingRealtimeTicketIdsRef = useRef<Map<string, number>>(new Map());

  // Sync state filters & search/sorting to cache, and clear page caches if query parameters change
  useEffect(() => {
    const cache = getOrInitializeCache();
    const filtersChanged =
      cache.timeRange !== timeRange ||
      cache.customStart !== customStart ||
      cache.customEnd !== customEnd ||
      cache.searchTerm !== searchTerm ||
      cache.sortConfig.key !== sortConfig.key ||
      cache.sortConfig.direction !== sortConfig.direction;

    if (filtersChanged) {
      cache.ticketsByPage.clear();
      cache.conversationsByPage.clear();
      cache.hasNextPageByPage.clear();
      ticketCursorByPageRef.current = new Map([[1, null]]);
      cache.ticketCursorByPage = ticketCursorByPageRef.current;
    }

    cache.timeRange = timeRange;
    cache.customStart = customStart;
    cache.customEnd = customEnd;
    cache.searchTerm = searchTerm;
    cache.sortConfig = sortConfig;
    cache.ticketPage = ticketPage;
  }, [timeRange, customStart, customEnd, searchTerm, sortConfig, ticketPage, getOrInitializeCache]);

  // Sync tickets list state to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.ticketsByPage.set(ticketPage, tickets);
  }, [tickets, ticketPage, getOrInitializeCache]);

  // Sync conversations list state to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.conversationsByPage.set(ticketPage, conversations);
  }, [conversations, ticketPage, getOrInitializeCache]);

  // Sync cursor map ref to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.ticketCursorByPage = ticketCursorByPageRef.current;
  }, [getOrInitializeCache]);

  const isViewOnly =
    userProfile?.role !== 'Administrator' &&
    userProfile?.permissions?.tickets === 'view';

  const fetchData = useCallback(async (isSilent = false) => {
    setDebugError(null);
    if (!isSilent) setLoading(true);

    const { fromIso, toIso } = getTicketWorkspaceDateRange(timeRange, customStart, customEnd);
    const cursor = ticketCursorByPageRef.current.get(ticketPage) || undefined;
    const errors: string[] = [];

    try {
      const ticketResult = await listTicketWorkspaceTickets({
        fromIso,
        toIso,
        limit: WORKSPACE_TICKETS_PAGE_SIZE + 1,
        cursorCreatedAt: cursor?.createdAt,
        cursorId: cursor?.id,
      });
      const pageTickets = ticketResult.slice(0, WORKSPACE_TICKETS_PAGE_SIZE);
      const hasNext = ticketResult.length > WORKSPACE_TICKETS_PAGE_SIZE;
      const nextCursorSource = pageTickets[pageTickets.length - 1];
      setHasNextTicketPage(hasNext);
      
      const cache = getOrInitializeCache();
      cache.hasNextPageByPage.set(ticketPage, hasNext);

      if (hasNext && nextCursorSource?.created_at) {
        ticketCursorByPageRef.current.set(ticketPage + 1, {
          createdAt: nextCursorSource.created_at,
          id: nextCursorSource.id,
        });
      } else {
        ticketCursorByPageRef.current.delete(ticketPage + 1);
      }
      cache.ticketCursorByPage = ticketCursorByPageRef.current;

      const ticketIds = pageTickets.map((ticket) => ticket.id);
      const pageConversations = await listTicketWorkspaceConversationsByTicketIds(ticketIds);
      setConversations(pageConversations);

      const now = Date.now();
      for (const [ticketId, expiresAt] of pendingRealtimeTicketIdsRef.current.entries()) {
        if (expiresAt <= now) {
          pendingRealtimeTicketIdsRef.current.delete(ticketId);
        }
      }

      if (isSilent) {
        const pendingRealtimeTicketIds = new Set(pendingRealtimeTicketIdsRef.current.keys());
        setTickets((previousTickets) =>
          mergeWorkspaceTicketsForSilentRefresh(
            previousTickets,
            pageTickets,
            pendingRealtimeTicketIds,
            timeRange,
            customStart,
            customEnd
          )
        );
      } else {
        setTickets(pageTickets);
      }
    } catch (error) {
      console.error('Fetch tickets/conversations error:', error);
      errors.push(
        error instanceof Error ? error.message : 'Failed to load tickets'
      );
    }

    if (errors.length > 0) {
      setDebugError(errors.join(' | '));
    }

    if (!isSilent) setLoading(false);
  }, [customEnd, customStart, ticketPage, timeRange, getOrInitializeCache]);

  const syncTicketFromRealtime = useCallback(
    async (ticketId: string, fallbackValue?: unknown) => {
      // 1. Optimistic Update for instant UI feedback
      const fallbackTicket = normalizeTicketWorkspaceTicket(fallbackValue);
      pendingRealtimeTicketIdsRef.current.set(ticketId, Date.now() + 15000);
      // Guarantee any new realtime ticket defaults to 'New' if status is mysteriously missing
      if (fallbackTicket && ticketPage === 1) {
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

        if (
          latestTicket &&
          ticketPage === 1 &&
          isTicketWithinWorkspaceRange(latestTicket, timeRange, customStart, customEnd)
        ) {
          pendingRealtimeTicketIdsRef.current.delete(ticketId);
          setTickets((previousTickets) => upsertWorkspaceTicket(previousTickets, latestTicket));
        } else if (
          latestTicket &&
          ticketPage === 1 &&
          !isTicketWithinWorkspaceRange(latestTicket, timeRange, customStart, customEnd)
        ) {
          // If the real ticket is somehow out of range, remove the optimistic one
          pendingRealtimeTicketIdsRef.current.delete(ticketId);
          setTickets((previousTickets) =>
            previousTickets.filter((ticket) => ticket.id !== ticketId)
          );
        }
      } catch (error) {
        console.error('Realtime ticket sync error:', error);
        setDebugError(error instanceof Error ? error.message : 'Realtime ticket sync failed');
      }
    },
    [customEnd, customStart, ticketPage, timeRange]
  );


  useEffect(() => {
    // If cache matches our current filters, do NOT reset the page to 1
    const cache = getOrInitializeCache();
    const filtersChanged =
      cache.timeRange !== timeRange ||
      cache.customStart !== customStart ||
      cache.customEnd !== customEnd;
      
    if (filtersChanged) {
      setTicketPage(1);
      setHasNextTicketPage(false);
      ticketCursorByPageRef.current = new Map([[1, null]]);
      cache.ticketCursorByPage = ticketCursorByPageRef.current;
    }
  }, [timeRange, customStart, customEnd, filterCustomerId, getOrInitializeCache]);

  // Keep active reference to syncTicketFromRealtime and fetchData to avoid resetting Supabase subscriptions
  const syncRef = useRef(syncTicketFromRealtime);
  syncRef.current = syncTicketFromRealtime;

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  // 1. Initial Load for Profile and Settings (Runs exactly ONCE on mount)
  useEffect(() => {
    async function initWorkspace() {
      const cache = getOrInitializeCache();
      if (cache.userProfile && cache.availableModules.length > 0) {
        // Already loaded once, bypass loading
        return;
      }

      try {
        const user = await getTicketWorkspaceUser();
        if (user) {
          const profile = await getTicketWorkspaceProfile(user.id);
          setUserProfile(profile);
          cache.userProfile = profile;
          if (profile?.resolution_templates) {
            setPersonalResTemplates(profile.resolution_templates);
            cache.personalResTemplates = profile.resolution_templates;
          }
        }
      } catch (error) {
        console.error('Error loading profile on mount:', error);
      }

      try {
        const companyData = await getTicketWorkspaceCompanySettings();
        const modules = companyData?.modules?.length ? companyData.modules : DEFAULT_MODULES;
        const issues = companyData?.issue_types?.length ? companyData.issue_types : [];
        setAvailableModules(modules);
        setAvailableIssueTypes(issues);
        cache.availableModules = modules;
        cache.availableIssueTypes = issues;
      } catch (error) {
        console.error('Error loading company settings on mount:', error);
        setAvailableModules(DEFAULT_MODULES);
        setAvailableIssueTypes([]);
        cache.availableModules = DEFAULT_MODULES;
        cache.availableIssueTypes = [];
      }
    }

    initWorkspace();
  }, [getOrInitializeCache]);

  // 2. Fetch Data when filters or page changes
  useEffect(() => {
    // If cache already has data for this page, trigger fetch silently to revalidate in background
    const cache = getOrInitializeCache();
    const hasCache = cache.ticketsByPage.has(ticketPage);
    void fetchDataRef.current(hasCache);
  }, [timeRange, customStart, customEnd, ticketPage, filterCustomerId, getOrInitializeCache]);

  // 3. Supabase Realtime Channel Subscription (Set up exactly ONCE on mount)
  useEffect(() => {
    let realtimeTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleDataRefresh = () => {
      if (realtimeTimer) clearTimeout(realtimeTimer);
      realtimeTimer = setTimeout(() => {
        void fetchDataRef.current(true);
      }, 4000);
    };

    const channel = supabase
      .channel('workspace-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.new.id || '');
        if (!ticketId) return;

        void syncRef.current(ticketId, payload.new);
        scheduleDataRefresh();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.new.id || payload.old.id || '');
        if (!ticketId) return;

        void syncRef.current(ticketId, payload.new);
        scheduleDataRefresh();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, (payload) => {
        const ticketId = String(payload.old.id || '');
        if (!ticketId) return;

        pendingRealtimeTicketIdsRef.current.delete(ticketId);
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
  }, []);

  useEffect(() => {
    if (userProfile?.user_id) {
      const savedMode = localStorage.getItem(`neo_ticket_viewMode_${userProfile.user_id}`);
      if (savedMode === 'table' || savedMode === 'board') {
        setViewModeState(savedMode);
      }
    }
  }, [userProfile?.user_id]);

  const setViewMode = useCallback((mode: TicketsViewMode) => {
    setViewModeState(mode);
    if (userProfile?.user_id) {
      localStorage.setItem(`neo_ticket_viewMode_${userProfile.user_id}`, mode);
    }
  }, [userProfile?.user_id]);

  useEffect(() => {
    if (!latestTicketRealtimeEvent?.ticketId) return;
    void syncTicketFromRealtime(
      latestTicketRealtimeEvent.ticketId,
      latestTicketRealtimeEvent.payload
    );
  }, [latestTicketRealtimeEvent, syncTicketFromRealtime]);

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

    // Priority pin: In Progress, Escalated, Pending always float to top (0 = pinned, 1 = normal)
    const STATUS_PRIORITY: Record<string, number> = {
      'fix completed': 0, // NEW: Fixed jobs go first so owner closes them
      'in progress': 1,
      'escalated': 1,
      'pending': 1,
    };
    const getPriority = (ticket: TicketWorkspaceTicket) =>
      STATUS_PRIORITY[String(ticket.status || '').toLowerCase()] ?? 1;

    result.sort((left, right) => {
      // 1. Pinned group first
      const priorityDiff = getPriority(left) - getPriority(right);
      if (priorityDiff !== 0) return priorityDiff;

      // 2. Within same group, apply the user's chosen sort
      if (!sortConfig.key) return 0;
      const leftValue = getTicketWorkspaceSortValue(left, sortConfig.key);
      const rightValue = getTicketWorkspaceSortValue(right, sortConfig.key);

      if (leftValue < rightValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (leftValue > rightValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [filterCustomerId, searchTerm, sortConfig, tickets]);

  const conversationByTicketId = useMemo(() => {
    const map = new Map<string, TicketWorkspaceConversation>();
    for (const conversation of conversations) {
      if (conversation.current_ticket_id) {
        map.set(conversation.current_ticket_id, conversation);
      }
    }
    return map;
  }, [conversations]);

  const activeConversationByCustomerId = useMemo(() => {
    const map = new Map<string, TicketWorkspaceConversation>();
    for (const conversation of conversations) {
      if (!conversation.customer_id) continue;
      const normalizedStatus = String(conversation.status || '').toLowerCase();
      const isActiveLike = ['active', 'open', 'new', 'pending'].includes(normalizedStatus);
      if (!isActiveLike) continue;
      if (!conversation.current_ticket_id) {
        map.set(conversation.customer_id, conversation);
      }
    }
    return map;
  }, [conversations]);

  const getConvId = useCallback(
    (ticket: TicketWorkspaceTicket) => {
      const linked = conversationByTicketId.get(ticket.id);
      if (linked) return linked.id;

      if (!ticket.customer_id) return undefined;
      const activeForCustomerOnly = activeConversationByCustomerId.get(ticket.customer_id);
      if (activeForCustomerOnly) return activeForCustomerOnly.id;

      return undefined;
    },
    [activeConversationByCustomerId, conversationByTicketId]
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
        void fetchData(true); // Refresh conversations to pick up the new linked conversation
        
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

  const goToNextTicketPage = useCallback(() => {
    if (!hasNextTicketPage) return;
    setTicketPage((current) => current + 1);
  }, [hasNextTicketPage]);

  const goToPreviousTicketPage = useCallback(() => {
    setTicketPage((current) => Math.max(1, current - 1));
  }, []);

  const isChatActive = useMemo(() => {
    if (!resolvingTicket) return false;
    if (conversationByTicketId.has(resolvingTicket.id)) return true;
    if (!resolvingTicket.customer_id) return false;
    return activeConversationByCustomerId.has(resolvingTicket.customer_id);
  }, [activeConversationByCustomerId, conversationByTicketId, resolvingTicket]);

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
    viewMode: viewModeState,
    isChatActive,
    ticketPage,
    hasNextTicketPage,
    goToNextTicketPage,
    goToPreviousTicketPage,
  };
}
