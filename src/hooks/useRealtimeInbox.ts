'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getInboxConversationById,
  listInboxConversations,
  listInboxConversationsFallback,
  listInboxConversationsV2,
} from '@/lib/inbox/queries';
import type { InboxConversation } from '@/types/inbox';

function sortConversations(items: InboxConversation[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.last_message_at || 0).getTime() -
      new Date(left.last_message_at || 0).getTime()
  );
}

function isConversationActiveLike(conversation: InboxConversation) {
  const status = String(conversation.status || '').toLowerCase().trim();
  return (
    conversation.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(status)
  );
}

function upsertConversation(
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

export function useRealtimeInbox(options: {
  page?: number;
  pageSize?: number;
} = {}) {
  const {
    page = 1,
    pageSize = 20
  } = options;

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const unmountedRef = useRef(false);
  const cursorByPageRef = useRef<Map<number, { lastMessageAt: string; id: string } | null>>(
    new Map([[1, null]])
  );

  const fetchConversations = useCallback(async (opts: { silent?: boolean } = {}) => {
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
      });

      if (data.length === 0) {
        // Last-resort fallback to avoid disappearing inbox when strict query shape/status mismatches.
        const fallback = await listInboxConversationsFallback(pageSize);
        const activeFallback = fallback.filter(isConversationActiveLike);
        if (activeFallback.length > 0) {
          setConversations(sortConversations(activeFallback));
          setHasNextPage(false);
          return;
        }
      }

      setConversations(data);
      setHasNextPage(hasNext);
      if (hasNext && nextCursor) {
        cursorByPageRef.current.set(page + 1, nextCursor);
      } else {
        cursorByPageRef.current.delete(page + 1);
      }
    } catch (error) {
      console.error('Fetch Inbox Error:', error);
      try {
        const fallback = await listInboxConversations(pageSize);
        const activeFallback = fallback.filter(isConversationActiveLike);
        setConversations(sortConversations(activeFallback));
        setHasNextPage(false);
      } catch (fallbackError) {
        console.error('Fetch Inbox Fallback Error:', fallbackError);
      }
    } finally {
      if (!opts.silent) {
        setLoading(false);
      }
    }
  }, [page, pageSize]);

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
    }
  }, [pageSize]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

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
  }, [page, pageSize, scheduleRefresh]);

  return {
    conversations,
    hasNextPage,
    loading,
    refresh: fetchConversations,
  };
}
