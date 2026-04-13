'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isSlaBreached, slaMinutesRemaining } from '@/lib/utils/slaUtils';

export type NotifType = 'sla' | 'sla_warning' | 'ticket' | 'message';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  createdAt: string;
  isRead: boolean;
  minutesRemaining?: number;
}

export interface ToastNotif {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  ticketNo?: string | number;
  ticketId?: string;
  conversationId?: string;
  duration?: number;
}

const STORAGE_KEY = 'neo_notif_read_ids_v1';
// Track which SLA warnings we've already toasted to avoid repeated firing
const WARNED_SLA_KEY = 'neo_sla_warned_ids_v1';
const MAX_TOASTS = 4;

export function useNotifications(agentId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const isFirstLoad = useRef(true);

  // ---------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------
  const recalcUnread = useCallback((notifs: AppNotification[]) => {
    setUnreadCount(notifs.filter((n) => !n.isRead).length);
  }, []);

  const getReadIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }, []);

  const getWarnedIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(WARNED_SLA_KEY) || '[]'); } catch { return []; }
  }, []);

  const saveWarnedId = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    const ids = JSON.parse(localStorage.getItem(WARNED_SLA_KEY) || '[]') as string[];
    if (!ids.includes(id)) {
      // Keep only last 100 warned IDs to avoid unbounded growth
      const next = [...ids, id].slice(-100);
      localStorage.setItem(WARNED_SLA_KEY, JSON.stringify(next));
    }
  }, []);

  // ---------------------------------------------------------------
  // Browser Push
  // ---------------------------------------------------------------
  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/logo.png' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(p => {
        if (p === 'granted') new Notification(title, { body, icon: '/logo.png' });
      });
    }
  }, []);

  // ---------------------------------------------------------------
  // Read / Dismiss
  // ---------------------------------------------------------------
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, isRead: true } : n);
      recalcUnread(next);
      if (typeof window !== 'undefined') {
        const readIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
        if (!readIds.includes(id)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds, id]));
        }
      }
      return next;
    });
  }, [recalcUnread]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, isRead: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next.map(n => n.id)));
      setUnreadCount(0);
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: ToastNotif) => {
    setToasts(prev => [toast, ...prev].slice(0, MAX_TOASTS));
    showBrowserNotification(toast.title, toast.body);
  }, [showBrowserNotification]);

  // ---------------------------------------------------------------
  // Fetch ticket_logs for this agent
  // ---------------------------------------------------------------
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
      } else if (row.action_type === 'claim') {
        title = `รับงานแล้ว — #${row.tickets?.ticket_no ?? ''}`;
      } else if (row.action_type === 'resolve') {
        title = `ปิดงาน — #${row.tickets?.ticket_no ?? ''}`;
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

  // ---------------------------------------------------------------
  // SLA Monitor — breached + warning (< 30 min)
  // ---------------------------------------------------------------
  const fetchSlaBreaches = useCallback(async () => {
    if (!agentId) return;
    const readIds = getReadIds();
    const warnedIds = getWarnedIds();

    // Fetch tickets within 2 hours of due (covers both warning + breached)
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('tickets')
      .select('id, ticket_no, subject, sla_due_at, status, priority')
      .eq('assigned_agent_id', agentId)
      .lt('sla_due_at', twoHoursFromNow)
      .not('status', 'in', '("Resolved","Closed")')
      .order('sla_due_at', { ascending: true })
      .limit(10);

    if (!data) return;

    const slaNotifs: AppNotification[] = [];

    for (const t of data) {
      const mins = slaMinutesRemaining(t);
      const breached = isSlaBreached(t);

      if (breached) {
        // --- Breached SLA Notification ---
        const id = `sla-breach-${t.id}`;
        slaNotifs.push({
          id,
          type: 'sla',
          title: `🚨 SLA เกินกำหนดแล้ว — #${t.ticket_no}`,
          body: t.subject ?? 'ใบงานนี้เกิน SLA แล้ว กรุณาจัดการด่วน',
          ticketNo: t.ticket_no,
          ticketId: t.id,
          createdAt: t.sla_due_at,
          isRead: readIds.includes(id),
          minutesRemaining: mins,
        });

        // Toast once per breach
        if (!warnedIds.includes(id) && !isFirstLoad.current) {
          addToast({
            id: `toast-${id}-${Date.now()}`,
            type: 'sla',
            title: `🚨 SLA หลุดกำหนด — #${t.ticket_no}`,
            body: t.subject ?? 'กรุณาจัดการด่วน',
            ticketId: t.id,
            ticketNo: t.ticket_no,
            duration: 8000,
          });
          saveWarnedId(id);
        }
      } else if (mins <= 30) {
        // --- SLA Warning (≤ 30 min remaining) ---
        const id = `sla-warn-${t.id}`;
        slaNotifs.push({
          id,
          type: 'sla_warning',
          title: `⚠️ SLA ใกล้หมด (${mins} นาที) — #${t.ticket_no}`,
          body: t.subject ?? `เหลือเวลาอีก ${mins} นาที`,
          ticketNo: t.ticket_no,
          ticketId: t.id,
          createdAt: t.sla_due_at,
          isRead: readIds.includes(id),
          minutesRemaining: mins,
        });

        // Toast once per warning window
        if (!warnedIds.includes(id) && !isFirstLoad.current) {
          addToast({
            id: `toast-${id}-${Date.now()}`,
            type: 'sla_warning',
            title: `⚠️ SLA ใกล้หมด เหลือ ${mins} นาที`,
            body: `#${t.ticket_no} · ${t.subject ?? ''}`,
            ticketId: t.id,
            ticketNo: t.ticket_no,
            duration: 6000,
          });
          saveWarnedId(id);
        }
      } else if (mins <= 60) {
        // --- SLA Upcoming (≤ 60 min) — add to notification list only, no toast ---
        const id = `sla-upcoming-${t.id}`;
        slaNotifs.push({
          id,
          type: 'sla_warning',
          title: `🕐 SLA เหลือ ${mins} นาที — #${t.ticket_no}`,
          body: t.subject ?? `โปรดเตรียมดำเนินการก่อน SLA หมด`,
          ticketNo: t.ticket_no,
          ticketId: t.id,
          createdAt: t.sla_due_at,
          isRead: readIds.includes(id),
          minutesRemaining: mins,
        });
      }
    }

    if (slaNotifs.length > 0) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        // Replace existing SLA notifs + add new ones at top
        const withoutOldSla = prev.filter(n => !n.id.startsWith('sla-'));
        const newOnes = slaNotifs.filter(n => !existingIds.has(n.id));
        const merged = [...slaNotifs, ...withoutOldSla.filter(n => !slaNotifs.find(s => s.id === n.id))];
        recalcUnread(merged);
        return merged;
      });
    }
  }, [agentId, getReadIds, getWarnedIds, saveWarnedId, addToast, recalcUnread]);

  // ---------------------------------------------------------------
  // Initial load + Realtime subscriptions
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!agentId) return;

    fetchLogs();
    fetchSlaBreaches();

    // Subscribe: new ticket_logs targeting this agent
    const logChannel = supabase
      .channel(`notif-logs-${agentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_logs' },
        async (payload) => {
          const row = payload.new as any;
          if (row.to_user_id !== agentId && row.performer_id !== agentId) return;
          await fetchLogs();
          if (isFirstLoad.current) return;

          let title = 'ใบงานได้รับการอัปเดต';
          if (row.action_type === 'transfer' && row.to_user_id === agentId) {
            title = '📨 มีใบงานโอนมาให้คุณ';
          } else if (row.action_type === 'resolve') {
            title = '✅ ใบงานได้รับการปิดแล้ว';
          }

          addToast({
            id: `toast-log-${Date.now()}`,
            type: 'ticket',
            title,
            body: row.note || 'ดูรายละเอียดในกล่องข้อความ',
            ticketId: row.ticket_id,
          });
        }
      )
      .subscribe();

    // Subscribe: new customer messages in all conversations
    const msgChannel = supabase
      .channel(`notif-msg-${agentId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const row = payload.new as any;
          if (row.sender_type !== 'customer') return;
          if (row.message_type === 'system') return;
          if (isFirstLoad.current) return;

          addToast({
            id: `toast-msg-${Date.now()}`,
            type: 'message',
            title: '💬 ข้อความใหม่จากลูกค้า',
            body: (row.content as string)?.slice(0, 60) ?? 'มีข้อความใหม่',
            conversationId: row.conversation_id,
          });
        }
      )
      .subscribe();

    // Subscribe: NEW tickets (global alert for all agents)
    const ticketChannel = supabase
      .channel('notif-all-tickets')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' },
        async (payload) => {
          const row = payload.new as any;
          if (row.status !== 'New') return;
          if (isFirstLoad.current) return;

          addToast({
            id: `toast-ticket-${Date.now()}`,
            type: 'ticket',
            title: '🆕 มีใบงานใหม่เข้าสู่ระบบ',
            body: row.subject || `ใบงาน #${row.ticket_no} กำลังรอการรับงาน`,
            ticketId: row.id,
            ticketNo: row.ticket_no,
          });
        }
      )
      .subscribe();

    // SLA polling every 90 seconds (more responsive than 2min)
    const slaInterval = setInterval(fetchSlaBreaches, 90_000);

    // Mark first-load done after 2.5s
    const firstLoadTimer = setTimeout(() => {
      isFirstLoad.current = false;
    }, 2500);

    return () => {
      supabase.removeChannel(logChannel);
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(ticketChannel);
      clearInterval(slaInterval);
      clearTimeout(firstLoadTimer);
    };
  }, [agentId, fetchLogs, fetchSlaBreaches, addToast]);

  return { notifications, toasts, unreadCount, markAsRead, markAllRead, dismissToast };
}
