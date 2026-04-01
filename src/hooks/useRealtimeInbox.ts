'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeInbox() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInitial() {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          status,
          last_message_at,
          customer_id,
          customers (id, display_name, line_user_id)
        `)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('Fetch Inbox Error:', error);
        // Fallback: fetch without nested customers to see if RLS is the issue
        const { data: fallbackData } = await supabase
          .from('conversations')
          .select('id, status, last_message_at, customer_id')
          .order('last_message_at', { ascending: false });
        
        if (fallbackData) {
          setConversations(fallbackData);
        }
      } else if (data) {
        setConversations(data);
      }
      setLoading(false);
    }

    fetchInitial();

    // Set up real-time subscription
    const channel = supabase
      .channel('public:conversations')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('Conversation update received:', payload);
          fetchInitial(); // Re-fetch to get nested objects (customers) for simplicity
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading };
}
