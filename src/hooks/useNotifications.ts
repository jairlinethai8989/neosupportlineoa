'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isSlaBreached } from '@/lib/utils/slaUtils';
import type { TicketLog } from '@/types';

export type NotifType = 'sla' | 'ticket' | 'message';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  conversationId?: string;
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

const STORAGE_KEY = 'neo_notif_seen_v2';
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

  // --- Load saved read timestamp ---
  const getLastSeen = useCallback((): Date | null => {
    if (typeof window === 'undefined') return null;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? new Date(saved) : null;
  }, []);

  // --- Mark all read ---
  const markAllRead = useCallback(() => {
    const now = new Date().toISOString();
    if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, now);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
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
  }, []);

  // --- Fetch ticket_logs for this agent ---
  const fetchLogs = useCallback(async () => {
    if (!agentId) return;
    const lastSeen = getLastSeen();

    const { data } = await supabase
      .from('ticket_logs')
      .select('*, tickets(ticket_no, subject)')
      .or(`to_user_id.eq.${agentId},performer_id.eq.${agentId}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data) return;

    const notifs: AppNotification[] = (data as TicketLog[]).map((row) => {
      const isRead = lastSeen ? new Date(row.created_at) <= lastSeen : false;
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
        id: row.id ?? `${row.ticket_id}-${row.created_at}`,
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
  }, [agentId, getLastSeen, recalcUnread]);

  // --- Fetch SLA breached tickets assigned to this agent ---
  const fetchSlaBreaches = useCallback(async () => {
    if (!agentId) return;
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
      isRead: false,
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
  }, [agentId, recalcUnread]);

  // --- Initial load + subscriptions ---
  useEffect(() => {
    if (!agentId) return;

    const initTimer = setTimeout(() => {
      void fetchLogs();
      void fetchSlaBreaches();
    }, 0);

    // Subscribe: new ticket_logs targeting this agent
    const logChannel = supabase
      .channel(`notif-logs-${agentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ticket_logs' },
        async (payload) => {
          const row = payload.new as TicketLog;
          // Only care if this agent is the target or performer
          if (row.to_user_id !== agentId && row.performer_id !== agentId) return;

          await fetchLogs();

          // Don't show toast on first load
          if (isFirstLoad.current) return;

          let title = 'ใบงานได้รับการอัปเดต';
          if (row.action_type === 'transfer' && row.to_user_id === agentId) {
            title = 'มีใบงานโอนมาให้คุณ';
          }

          addToast({
            id: `toast-${Date.now()}`,
            type: 'ticket',
            title,
            body: `คลิกเพื่อดูรายละเอียดใบงาน`,
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
          const row = payload.new as { sender_type: string; content: string | null; conversation_id?: string };
          // Only inbound messages (from customer)
          if (row.sender_type !== 'customer') return;
          if (isFirstLoad.current) return;

          addToast({
            id: `toast-msg-${Date.now()}`,
            type: 'message',
            title: 'ข้อความใหม่จากลูกค้า',
            body: row.content?.slice(0, 60) ?? 'มีข้อความใหม่',
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
      clearTimeout(initTimer);
      supabase.removeChannel(logChannel);
      supabase.removeChannel(msgChannel);
      clearInterval(slaInterval);
      clearTimeout(firstLoadTimer);
    };
  }, [agentId, fetchLogs, fetchSlaBreaches, addToast]);

  return { notifications, toasts, unreadCount, markAllRead, dismissToast };
}
