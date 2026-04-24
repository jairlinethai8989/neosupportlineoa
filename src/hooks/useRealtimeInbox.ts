'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
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

function isConversationActiveLike(conversation: InboxConversation) {
  const status = String(conversation.status || '').toLowerCase().trim();
  return (
    conversation.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(status)
  );
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

  const fetchConversations = async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }
    try {
      const { data, count } = await listInboxConversationsV2({
        status: 'active',
        page,
        pageSize
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
      setTotalCount(count);
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
      if (!options.silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [page, pageSize]);

  useEffect(() => {
    const channel = supabase
      .channel('inbox-realtime-v5')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => {
          // Simplest approach: full refresh on any change to avoid state logic errors
          void fetchConversations({ silent: true });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, pageSize]); // Add page to deps to ensure subscription interacts with current page state correctly

  return { 
    conversations, 
    totalCount, 
    loading, 
    refresh: fetchConversations,
    totalPages: Math.ceil(totalCount / pageSize)
  };
}
