'use client';
import { useEffect, useState } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  getInboxConversationById,
  listInboxConversations,
  listInboxConversationsFallback,
} from '@/lib/inbox/queries';
import type { InboxConversation } from '@/types/inbox';

function sortConversations(items: InboxConversation[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.last_message_at || 0).getTime() -
      new Date(left.last_message_at || 0).getTime()
  );
}

export function useRealtimeInbox() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInitial() {
      try {
        setConversations(await listInboxConversations(100));
      } catch (error) {
        console.error('Fetch Inbox Error:', error);
        try {
          setConversations(await listInboxConversationsFallback(100));
        } catch (fallbackError) {
          console.error('Fallback Inbox Error:', fallbackError);
        }
      }
      setLoading(false);
    }

    fetchInitial();

    // Set up real-time subscription
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
        for (const conversation of normalizedRows) {
          const index = next.findIndex((item) => item.id === conversation.id);
          if (index >= 0) {
            next[index] = conversation;
          } else {
            next.unshift(conversation);
          }
        }
        return sortConversations(next);
      });
    };

    const scheduleConversationFlush = (conversationId: string) => {
      pendingConversationIds.add(conversationId);
      if (flushTimer) return;
      flushTimer = setTimeout(() => {
        void flushPendingConversations();
      }, 200); // Increased slightly for better reliability in distant regions
    };

    const channel = supabase
      .channel('inbox-realtime-v3')
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
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Realtime Inbox subscribed successfully');
        }
      });

    return () => {
      if (flushTimer) {
        clearTimeout(flushTimer);
      }
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading };
}
