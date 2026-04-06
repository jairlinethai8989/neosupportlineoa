'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isSlaBreached } from '@/lib/utils/slaUtils';

export type NotifType = 'sla' | 'ticket' | 'message';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  createdAt: string;
  isRead: boolean;
}

export interface ToastNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  conversationId?: string;
}

const STORAGE_KEY = 'neo_notif_read_ids_v1';
const MAX_TOASTS = 3;

export function useNotifications(agentId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  // --- derive unread count from notifications ---
  const recalcUnread = useCallback((notifs: AppNotification[]) => {
    setUnreadCount(notifs.filter((n) => !n.isRead).length);
  }, []);

  // --- Load saved read IDs ---
  const getReadIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem(STORAGE_KEY);
    try {
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  // --- Browser Push Notification ---
  const showBrowserNotification = useCallback((title: string, body: string, data?: any) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification(title, { body, icon: '/logo.png' });
        }
      });
    }
  }, []);

  // --- Mark individual as read ---
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
      recalcUnread(next);
      
      // Persist
      if (typeof window !== 'undefined') {
        const readIds = getReadIds();
        if (!readIds.includes(id)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds, id]));
        }
      }
      return next;
    });
  }, [getReadIds, recalcUnread]);

  // --- Mark all read ---
  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, isRead: true }));
      const allIds = next.map(n => n.id);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
      }
      setUnreadCount(0);
      return next;
    });
  }, []);

  // --- Dismiss a toast ---
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- Add toast (capped at MAX_TOASTS) ---
  const addToast = useCallback((toast: ToastNotif) => {
    setToasts((prev) => {
      const next = [toast, ...prev].slice(0, MAX_TOASTS);
      return next;
    });
    showBrowserNotification(toast.title, toast.body);
  }, [showBrowserNotification]);

  // --- Fetch ticket_logs for this agent ---
  const fetchLogs = useCallback(async () => {
    if (!agentId) return;
    const readIds = getReadIds();

    const { data } = await supabase
      .from('ticket_logs')
      .select('*, tickets(ticket_no, subject)')
      .or(`to_user_id.eq.${agentId},performer_id.eq.${agentId}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data) return;

    const notifs: AppNotification[] = data.map((row) => {
      const id = row.id?.toString() ?? `${row.ticket_id}-${row.created_at}`;
      const isRead = readIds.includes(id);
      
      let title = 'อัปเดตใบงาน';
      let type: NotifType = 'ticket';

      if (row.action_type === 'transfer' && row.to_user_id === agentId) {
        title = `โอนงานมาให้คุณ — #${row.tickets?.ticket_no ?? ''}`;
        type = 'ticket';
      } else if (row.action_type === 'claim') {
        title = `รับงานแล้ว — #${row.tickets?.ticket_no ?? ''}`;
        type = 'ticket';
      } else if (row.action_type === 'resolve') {
        title = `ปิดงาน — #${row.tickets?.ticket_no ?? ''}`;
        type = 'ticket';
      }

      return {
        id,
        type,
        title,
        body: row.tickets?.subject ?? row.note ?? '-',
        ticketNo: row.tickets?.ticket_no,
        ticketId: row.ticket_id,
        createdAt: row.created_at,
        isRead,
      };
    });

    setNotifications(notifs);
    recalcUnread(notifs);
  }, [agentId, getReadIds, recalcUnread]);

  // --- Fetch SLA breached tickets assigned to this agent ---
  const fetchSlaBreaches = useCallback(async () => {
    if (!agentId) return;
    const readIds = getReadIds();
    const now = new Date().toISOString();

    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_no, subject, sla_due_at, status')
      .eq('assigned_agent_id', agentId)
      .lt('sla_due_at', now)
      .not('status', 'in', '("Resolved","Closed")')
      .order('sla_due_at', { ascending: true })
      .limit(5);

    if (!data) return;

    // Add SLA notifications at the top
    const slaNotifs: AppNotification[] = data.filter(isSlaBreached).map((t) => ({
      id: `sla-${t.id}`,
      type: 'sla' as NotifType,
      title: `⚠️ SLA เกินกำหนด — #${t.ticket_no}`,
      body: t.subject ?? 'ใบงานนี้เกิน SLA แล้ว',
      ticketNo: t.ticket_no,
      ticketId: t.id,
      createdAt: t.sla_due_at,
      isRead: readIds.includes(`sla-${t.id}`),
    }));

    if (slaNotifs.length > 0) {
      setNotifications((prev) => {
        const ids = new Set(prev.map((n) => n.id));
        const newOnes = slaNotifs.filter((n) => !ids.has(n.id));
        const merged = [...newOnes, ...prev];
        recalcUnread(merged);
        return merged;
      });
    }
  }, [agentId, getReadIds, recalcUnread]);

  // --- Initial load + subscriptions ---
  useEffect(() => {
    if (!agentId) return;

    fetchLogs();
    fetchSlaBreaches();

    // Subscribe: new ticket_logs targeting this agent
    const logChannel = supabase
      .channel(`notif-logs-${agentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_logs' },
        async (payload) => {
          const row = payload.new as any;
          if (row.to_user_id !== agentId && row.performer_id !== agentId) return;

          await fetchLogs();

          if (isFirstLoad.current) return;

          let title = 'ใบงานได้รับการอัปเดต';
          if (row.action_type === 'transfer' && row.to_user_id === agentId) {
            title = 'มีใบงานโอนมาให้คุณ';
          }

          addToast({
            id: `toast-${Date.now()}`,
            type: 'ticket',
            title,
            body: `ดูรายละเอียดในกล่องข้อความ`,
            ticketId: row.ticket_id,
          });
        }
      )
      .subscribe();

    // Subscribe: new messages in conversations this agent handles
    const msgChannel = supabase
      .channel(`notif-msg-${agentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const row = payload.new as any;
          if (row.sender_type !== 'customer') return;
          if (isFirstLoad.current) return;

          addToast({
            id: `toast-msg-${Date.now()}`,
            type: 'message',
            title: 'ข้อความใหม่จากลูกค้า',
            body: (row.content as string)?.slice(0, 60) ?? 'มีข้อความใหม่',
            conversationId: row.conversation_id,
          });
        }
      )
      .subscribe();

    // SLA polling every 2 minutes
    const slaInterval = setInterval(fetchSlaBreaches, 120_000);

    // Mark first load done after 2s
    const firstLoadTimer = setTimeout(() => {
      isFirstLoad.current = false;
    }, 2000);

    return () => {
      supabase.removeChannel(logChannel);
      supabase.removeChannel(msgChannel);
      clearInterval(slaInterval);
      clearTimeout(firstLoadTimer);
    };
  }, [agentId, fetchLogs, fetchSlaBreaches, addToast]);

  return { notifications, toasts, unreadCount, markAsRead, markAllRead, dismissToast };
}
