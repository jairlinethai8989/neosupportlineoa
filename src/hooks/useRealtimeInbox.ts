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
      setConversations(data);
      setTotalCount(count);
    } catch (error) {
      console.error('Fetch Inbox Error:', error);
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
