'use client';
import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getInboxConversationById,
  listInboxConversations,
  listInboxConversationsFallback,
  listInboxConversationsV2
} from '@/lib/inbox/queries';
import type { InboxConversation } from '@/types/inbox';

function sortConversations(items: InboxConversation[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.last_message_at || 0).getTime() -
      new Date(left.last_message_at || 0).getTime()
  );
}

export function useRealtimeInbox(options: {
  status?: 'active' | 'closed';
  page?: number;
  pageSize?: number;
  startDate?: string | null;
  endDate?: string | null;
} = {}) {
  const { 
    status = 'active', 
    page = 1, 
    pageSize = 20, 
    startDate = null, 
    endDate = null 
  } = options;

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data, count } = await listInboxConversationsV2({
        status,
        page,
        pageSize,
        startDate,
        endDate
      });
      setConversations(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Fetch Inbox V2 Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [status, page, pageSize, startDate, endDate]);

  useEffect(() => {
    // Only subscribe to real-time for Active tab or when status-changing events occur
    const pendingConversationIds = new Set<string>();
    let flushTimer: ReturnType<typeof setTimeout> | null = null;

    const flushPendingConversations = async () => {
      const ids = Array.from(pendingConversationIds);
      pendingConversationIds.clear();
      flushTimer = null;
      if (ids.length === 0) return;

      const rows = await Promise.all(
        ids.map(async (id) => {
          try {
            return await getInboxConversationById(id);
          } catch {
            return null;
          }
        })
      );

      const normalizedRows = rows.filter((row): row is InboxConversation => Boolean(row));
      if (normalizedRows.length === 0) return;

      setConversations((prev) => {
        const next = [...prev];
        let hasChanges = false;

        for (const conversation of normalizedRows) {
          // If we are in 'active' tab and item is 'closed', remove it
          if (status === 'active' && conversation.is_active === false) {
             const idx = next.findIndex(item => item.id === conversation.id);
             if (idx >= 0) {
               next.splice(idx, 1);
               hasChanges = true;
             }
             continue;
          }

          // If we are in 'active' tab and item is 'active', upsert it
          if (status === 'active' && conversation.is_active === true) {
            const index = next.findIndex((item) => item.id === conversation.id);
            if (index >= 0) {
              next[index] = conversation;
            } else if (page === 1) { // Only unshift if we are on page 1
              next.unshift(conversation);
            }
            hasChanges = true;
          }

          // Note: Realtime for 'closed' tab is handled by manual refresh or filter change
          // to keep the list stable during search/audit.
        }
        return hasChanges ? sortConversations(next).slice(0, pageSize) : prev;
      });
    };

    const scheduleConversationFlush = (conversationId: string) => {
      pendingConversationIds.add(conversationId);
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        void flushPendingConversations();
      }, 200);
    };

    const channel = supabase
      .channel('inbox-realtime-v4')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        async (payload: RealtimePostgresChangesPayload<{ id: string }>) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            scheduleConversationFlush(payload.new.id);
          } else if (payload.eventType === 'DELETE') {
            setConversations((prev) =>
              prev.filter((conversation) => conversation.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      if (flushTimer) clearTimeout(flushTimer);
      supabase.removeChannel(channel);
    };
  }, [status, page, pageSize]); // Add page to deps to ensure subscription interacts with current page state correctly

  return { 
    conversations, 
    totalCount, 
    loading, 
    refresh: fetchConversations,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}
