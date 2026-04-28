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
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchConversations = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) {
      setLoading(true);
    }

    try {
      const { data, count } = await listInboxConversationsV2({
        status: 'active',
        page,
        pageSize,
        includeCount: !opts.silent,
      });

      if (data.length === 0) {
        // Last-resort fallback to avoid disappearing inbox when strict query shape/status mismatches.
        const fallback = await listInboxConversationsFallback(pageSize);
        const activeFallback = fallback.filter(isConversationActiveLike);
        if (activeFallback.length > 0) {
          setConversations(sortConversations(activeFallback));
          setTotalCount(Math.max(count, activeFallback.length));
          return;
        }
      }

      setConversations(data);
      if (!opts.silent) {
        setTotalCount(count);
      }
    } catch (error) {
      console.error('Fetch Inbox Error:', error);
      try {
        const fallback = await listInboxConversations(pageSize);
        const activeFallback = fallback.filter(isConversationActiveLike);
        setConversations(sortConversations(activeFallback));
        setTotalCount(activeFallback.length);
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
      void fetchConversations({ silent: true });
    }, delayMs);
  }, [fetchConversations]);

  useEffect(() => {
    void fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
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
            setTotalCount((current) => Math.max(current - 1, 0));
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

            if (eventType === 'INSERT' && isConversationActiveLike(latestConversation)) {
              setTotalCount((current) => current + 1);
            }

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
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [page, pageSize, scheduleRefresh]);

  return {
    conversations,
    totalCount,
    loading,
    refresh: fetchConversations,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}
