'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import {
  getInboxConversationById,
  listInboxConversations,
  listInboxConversationsV2,
} from '@/lib/inbox/queries';
import type { InboxConversation } from '@/types/inbox';

export function sortConversations(items: InboxConversation[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.last_message_at || 0).getTime() -
      new Date(left.last_message_at || 0).getTime()
  );
}

export function isConversationActiveLike(conversation: InboxConversation) {
  const status = String(conversation.status || '').toLowerCase().trim();
  if (!status) return true;
  const closedLike = ['closed', 'resolved', 'done', 'ended', 'end', 'archived'];
  if (closedLike.includes(status)) return false;

  // Filter out conversations where the current/associated ticket has been closed, resolved, or canceled
  if (conversation.ticket_data?.status) {
    const ticketStatus = String(conversation.ticket_data.status).toLowerCase().trim();
    if (['resolved', 'closed', 'canceled'].includes(ticketStatus)) {
      return false;
    }
  }

  return (
    conversation.is_active === true ||
    [
      'active',
      'open',
      'new',
      'in progress',
      'in_progress',
      'pending',
      'escalated',
      'claimed',
      'claim',
      'ongoing',
      'on_going',
    ].includes(status) ||
    !closedLike.includes(status)
  );
}

export function upsertConversation(
  current: InboxConversation[],
  incoming: InboxConversation,
  maxItems: number
) {
  const existingIndex = current.findIndex((conversation) => conversation.id === incoming.id);
  const next =
    existingIndex === -1
      ? [incoming, ...current]
      : current.map((conversation, index) => (index === existingIndex ? incoming : conversation));

  return sortConversations(next).slice(0, Math.max(maxItems, 1));
}

interface InboxWorkspaceCache {
  conversationsByPage: Map<number, InboxConversation[]>;
  hasNextPageByPage: Map<number, boolean>;
  cursorByPage: Map<number, { lastMessageAt: string; id: string } | null>;
  page: number;
  pageSize: number;
  scopeKey: string;
}

let inboxWorkspaceCache: InboxWorkspaceCache | null = null;

export function useRealtimeInbox(options: {
  page?: number;
  pageSize?: number;
} = {}) {
  const {
    page = 1,
    pageSize = 10
  } = options;
  const { effectiveProjectIds, selectedProjectId, projectsLoaded } = useAppContext();
  const scopeKey = `${selectedProjectId}:${effectiveProjectIds ? effectiveProjectIds.join(',') : 'all'}`;

  const getOrInitializeCache = useCallback((): InboxWorkspaceCache => {
    if (!inboxWorkspaceCache) {
      inboxWorkspaceCache = {
        conversationsByPage: new Map(),
        hasNextPageByPage: new Map(),
        cursorByPage: new Map([[1, null]]),
        page,
        pageSize,
        scopeKey,
      };
    }
    return inboxWorkspaceCache;
  }, [page, pageSize, scopeKey]);

  const initialCache = inboxWorkspaceCache;

  const [conversations, setConversations] = useState<InboxConversation[]>(() => {
    return initialCache?.conversationsByPage.get(page) || [];
  });
  const [hasNextPage, setHasNextPage] = useState<boolean>(() => {
    return initialCache?.hasNextPageByPage.get(page) || false;
  });
  const [loading, setLoading] = useState(() => {
    if (!initialCache) return true;
    return !initialCache.conversationsByPage.has(page);
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const unmountedRef = useRef(false);
  const cursorByPageRef = useRef<Map<number, { lastMessageAt: string; id: string } | null>>(
    initialCache?.cursorByPage || new Map([[1, null]])
  );
  const abortControllerRef = useRef<AbortController | null>(null);

  // loading state auto-timeout fallback
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      console.warn('Realtime Inbox loading timed out after 15s');
      setLoading(false);
    }, 15000);
    return () => clearTimeout(timer);
  }, [loading]);

  // Sync state filters & page config to cache, and clear page caches if query parameters or project scope change
  useEffect(() => {
    const cache = getOrInitializeCache();
    const configChanged = cache.pageSize !== pageSize || cache.scopeKey !== scopeKey;

    if (configChanged) {
      cache.conversationsByPage.clear();
      cache.hasNextPageByPage.clear();
      cursorByPageRef.current = new Map([[1, null]]);
      cache.cursorByPage = cursorByPageRef.current;
    }

    cache.pageSize = pageSize;
    cache.page = page;
    cache.scopeKey = scopeKey;
  }, [page, pageSize, scopeKey, getOrInitializeCache]);

  // Sync conversations list state to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.conversationsByPage.set(page, conversations);
  }, [conversations, page, getOrInitializeCache]);

  // Sync hasNextPage state to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.hasNextPageByPage.set(page, hasNextPage);
  }, [hasNextPage, page, getOrInitializeCache]);

  // Sync cursor map ref to cache
  useEffect(() => {
    const cache = getOrInitializeCache();
    cache.cursorByPage = cursorByPageRef.current;
  }, [getOrInitializeCache]);

  const fetchConversations = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!projectsLoaded) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!opts.silent) {
      setLoading(true);
    }

    try {
      const cursor = cursorByPageRef.current.get(page) || undefined;
      const { data, hasNext, nextCursor } = await listInboxConversationsV2({
        status: 'active',
        pageSize,
        cursorLastMessageAt: cursor?.lastMessageAt || null,
        cursorId: cursor?.id || null,
        projectIds: effectiveProjectIds,
      });

      if (controller.signal.aborted) return;

      const visibleData = data.filter(isConversationActiveLike);
      setConversations(visibleData);
      setHasNextPage(hasNext);
      if (hasNext && nextCursor) {
        cursorByPageRef.current.set(page + 1, nextCursor);
      } else {
        cursorByPageRef.current.delete(page + 1);
      }
    } catch (error) {
      if ((error instanceof Error && error.name === 'AbortError') || controller.signal.aborted) {
        return;
      }
      console.error('Fetch Inbox Error:', error);
      try {
        const fallback = await listInboxConversations(pageSize, effectiveProjectIds);
        if (controller.signal.aborted) return;
        const activeFallback = fallback.filter(isConversationActiveLike);
        setConversations(sortConversations(activeFallback));
        setHasNextPage(false);
      } catch (fallbackError) {
        console.error('Fetch Inbox Fallback Error:', fallbackError);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [effectiveProjectIds, page, pageSize, projectsLoaded]);

  const scheduleRefresh = useCallback((delayMs = 250) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      if (unmountedRef.current) return;
      if (refreshInFlightRef.current) {
        refreshQueuedRef.current = true;
        return;
      }
      refreshInFlightRef.current = true;
      void fetchConversations({ silent: true }).finally(() => {
        refreshInFlightRef.current = false;
        if (refreshQueuedRef.current && !unmountedRef.current) {
          refreshQueuedRef.current = false;
          scheduleRefresh(120);
        }
      });
    }, delayMs);
  }, [fetchConversations]);

  useEffect(() => {
    if (page === 1 && cursorByPageRef.current.get(1) !== null) {
      cursorByPageRef.current = new Map([[1, null]]);
      const cache = getOrInitializeCache();
      cache.cursorByPage = cursorByPageRef.current;
    }
  }, [page, pageSize, getOrInitializeCache]);

  useEffect(() => {
    const cache = getOrInitializeCache();
    const hasCache = cache.conversationsByPage.has(page);
    void fetchConversations({ silent: hasCache });
  }, [page, pageSize, fetchConversations, getOrInitializeCache]);

  useEffect(() => {
    unmountedRef.current = false;
    const channel = supabase
      .channel('inbox-realtime-v6')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async (payload) => {
          if (page !== 1) {
            scheduleRefresh(300);
            return;
          }

          const eventType = payload.eventType;
          const rowId = String((payload.new as { id?: string })?.id || (payload.old as { id?: string })?.id || '');
          if (!rowId) {
            scheduleRefresh(300);
            return;
          }

          if (eventType === 'DELETE') {
            setConversations((current) => current.filter((conversation) => conversation.id !== rowId));
            scheduleRefresh(1200);
            return;
          }

          try {
            const latestConversation = await getInboxConversationById(rowId);
            if (!latestConversation) {
              scheduleRefresh(300);
              return;
            }

            setConversations((current) => {
              if (
                effectiveProjectIds &&
                latestConversation.project_id &&
                !effectiveProjectIds.includes(latestConversation.project_id)
              ) {
                return current.filter((conversation) => conversation.id !== rowId);
              }
              if (!isConversationActiveLike(latestConversation)) {
                return current.filter((conversation) => conversation.id !== rowId);
              }
              return upsertConversation(current, latestConversation, pageSize);
            });

            // Reconcile pagination counts and ordering from server state.
            scheduleRefresh(1200);
          } catch (error) {
            console.error('Inbox realtime patch error:', error);
            scheduleRefresh(350);
          }
        }
      )
      .subscribe();

    return () => {
      unmountedRef.current = true;
      refreshQueuedRef.current = false;
      refreshInFlightRef.current = false;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [effectiveProjectIds, page, pageSize, scheduleRefresh]);

  return {
    conversations,
    hasNextPage,
    loading,
    refresh: fetchConversations,
  };
}
