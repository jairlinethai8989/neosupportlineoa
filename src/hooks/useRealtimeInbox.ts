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
      // Fetch all conversations to see if status filtering was the issue
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
        // Pure fallback: no joins, just data
        const { data: fallbackData } = await supabase
          .from('conversations')
          .select('*')
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
      .channel('public:conversations:v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          fetchInitial();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { conversations, loading };
}
