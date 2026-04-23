'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { isSlaBreached, slaMinutesRemaining } from '@/lib/utils/slaUtils';

import type { 
  NotifType, 
  AppNotification, 
  ToastNotif 
} from '@/types/notifications';

export type { NotifType, AppNotification, ToastNotif };

const STORAGE_KEY = 'neo_notif_read_ids_v1';
const CLEAR_BEFORE_KEY = 'neo_notif_clear_before_ms_v1';
// Track which SLA warnings we've already toasted to avoid repeated firing
const WARNED_SLA_KEY = 'neo_sla_warned_ids_v1';
const SOUND_MODE_KEY = 'neo_notif_sound_mode_v1';
const SOUND_VOICE_KEY = 'neo_notif_voice_v1';
const MAX_TOASTS = 4;
const VOICE_AUDIO_SRC = {
  female: '/audio/new-ticket-female.mp3',
  male: '/audio/new-ticket-male.mp3',
} as const;

export type NotificationSoundMode = 'beep' | 'voice';
export type NotificationVoiceOption = 'female' | 'male';

export type SoundTestFailureCode =
  | 'NO_AUDIO_CONTEXT'
  | 'AUDIO_RESUME_BLOCKED'
  | 'AUDIO_PLAYBACK_FAILED';

export type SoundTestResult =
  | { ok: true; hint: string }
  | { ok: false; code: SoundTestFailureCode; detail: string; hint: string };

export interface LatestTicketRealtimeEvent {
  ticketId: string;
  payload: unknown;
  occurredAt: number;
}

export function useNotifications(agentId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newTicketsCount, setNewTicketsCount] = useState(0);
  const [latestTicketRealtimeEvent, setLatestTicketRealtimeEvent] = useState<LatestTicketRealtimeEvent | null>(null);
  const [isMuted, setIsMuted] = useState(true); // Default to muted (browser policy friendly)
  const [soundMode, setSoundModeState] = useState<NotificationSoundMode>('beep');
  const [soundVoice, setSoundVoiceState] = useState<NotificationVoiceOption>('female');
  const isFirstLoad = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPrimedRef = useRef(false);
  const voiceAudioRef = useRef<Record<NotificationVoiceOption, HTMLAudioElement | null>>({
    female: null,
    male: null,
  });

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;

    const AnyWindow = window as unknown as {
      AudioContext?: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };

    const Ctx = AnyWindow.AudioContext ?? AnyWindow.webkitAudioContext;
    if (!Ctx) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new Ctx();
    }

    return audioContextRef.current;
  }, []);

  const primeAudio = useCallback(async () => {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      await ctx.resume();
    }

    if (typeof window !== 'undefined') {
      (Object.keys(VOICE_AUDIO_SRC) as NotificationVoiceOption[]).forEach((voice) => {
        if (!voiceAudioRef.current[voice]) {
          const audio = new Audio(VOICE_AUDIO_SRC[voice]);
          audio.preload = 'auto';
          voiceAudioRef.current[voice] = audio;
        }
      });
    }

    if (audioPrimedRef.current) return;

    const primeVoiceClip = async (voice: NotificationVoiceOption) => {
      const audio = voiceAudioRef.current[voice];
      if (!audio) return;

      try {
        audio.muted = true;
        audio.currentTime = 0;
        await audio.play();
        audio.pause();
      } catch {
        // Ignore: some browsers may still block until a stronger user gesture.
      } finally {
        audio.currentTime = 0;
        audio.muted = false;
      }
    };

    await Promise.all((Object.keys(VOICE_AUDIO_SRC) as NotificationVoiceOption[]).map(primeVoiceClip));
    audioPrimedRef.current = true;
  }, [getAudioContext]);

  const playBeep = useCallback(
    async (pattern: 'confirm' | 'newTicket') => {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state !== 'running') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(1, now);
      masterGain.connect(ctx.destination);

      const playTone = (
        start: number,
        duration: number,
        frequency: number,
        type: OscillatorType,
        peakGain: number
      ) => {
        const osc = ctx.createOscillator();
        const toneGain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, start);
        osc.connect(toneGain);
        toneGain.connect(masterGain);

        toneGain.gain.setValueAtTime(0.0001, start);
        toneGain.gain.exponentialRampToValueAtTime(peakGain, start + 0.015);
        toneGain.gain.exponentialRampToValueAtTime(peakGain * 0.65, start + duration * 0.45);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.start(start);
        osc.stop(start + duration + 0.02);
      };

      if (pattern === 'confirm') {
        playTone(now + 0.02, 0.22, 987.77, 'triangle', 0.1);
        playTone(now + 0.035, 0.18, 1975.53, 'sine', 0.035);
        return;
      }

      playTone(now + 0.02, 0.24, 1046.5, 'triangle', 0.12);
      playTone(now + 0.035, 0.2, 2093, 'sine', 0.04);
      playTone(now + 0.28, 0.34, 783.99, 'triangle', 0.11);
      playTone(now + 0.3, 0.26, 1567.98, 'sine', 0.03);
    },
    [getAudioContext]
  );

  const setSoundMode = useCallback((next: NotificationSoundMode) => {
    setSoundModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MODE_KEY, next);
    }
  }, []);

  const setSoundVoice = useCallback((next: NotificationVoiceOption) => {
    setSoundVoiceState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_VOICE_KEY, next);
    }
  }, []);

  const playVoiceClip = useCallback(async (voice: NotificationVoiceOption) => {
    if (typeof window === 'undefined') {
      throw new Error('Voice playback requires a browser environment');
    }

    let template = voiceAudioRef.current[voice];
    if (!template) {
      template = new Audio(VOICE_AUDIO_SRC[voice]);
      template.preload = 'auto';
      voiceAudioRef.current[voice] = template;
    }

    template.pause();
    template.currentTime = 0;
    template.volume = 1;
    await template.play();
  }, []);

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

  const getClearBeforeMs = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(CLEAR_BEFORE_KEY);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
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

  const clearNotifications = useCallback(() => {
    const currentIds = notifications.map((notification) => notification.id);
    setNotifications([]);
    setToasts([]);
    setUnreadCount(0);

    if (typeof window !== 'undefined') {
      const existingReadIds = getReadIds();
      const mergedReadIds = Array.from(new Set([...existingReadIds, ...currentIds]));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedReadIds.slice(-1000)));
      localStorage.setItem(CLEAR_BEFORE_KEY, String(Date.now()));
    }
  }, [getReadIds, notifications]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback((toast: ToastNotif) => {
    setToasts(prev => [toast, ...prev].slice(0, MAX_TOASTS));
    
    // Skip browser notification for certain types as requested
    // Specifically disabling taskbar notification for new messages
    if (toast.type === 'message') return;
    
    showBrowserNotification(toast.title, toast.body);
  }, [showBrowserNotification]);

  const playNewTicketSound = useCallback(() => {
    if (isMuted) return;
    if (soundMode === 'voice') {
      void playVoiceClip(soundVoice).catch(() => {
        void playBeep('newTicket');
      });
      return;
    }
    void playBeep('newTicket');
  }, [isMuted, playBeep, playVoiceClip, soundMode, soundVoice]);

  const announceMuteState = useCallback((muted: boolean) => {
    if (muted) return;
    void playBeep('confirm');
  }, [playBeep]);

  const testSound = useCallback(async (): Promise<SoundTestResult> => {
    const hint =
      'ถ้าไม่ได้ยิน ให้ตรวจว่าแท็บ/เว็บไม่ถูก Mute และ Site settings > Sound เป็น Allow รวมถึงเสียงของเครื่อง (Volume mixer / output device)';

    if (soundMode === 'voice') {
      try {
        await playVoiceClip(soundVoice);
        const voiceLabel = soundVoice === 'female' ? 'เสียงผู้หญิง' : 'เสียงผู้ชาย';
        return { ok: true, hint: `กำลังใช้ ${voiceLabel} จากไฟล์ MP3 ในระบบ • ${hint}` };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          code: 'AUDIO_PLAYBACK_FAILED',
          detail: `เล่นไฟล์เสียงแจ้งเตือนไม่สำเร็จ (${msg})`,
          hint,
        };
      }
    }

    const ctx = getAudioContext();
    if (!ctx) {
      return {
        ok: false,
        code: 'NO_AUDIO_CONTEXT',
        detail: 'เบราว์เซอร์/อุปกรณ์นี้ไม่รองรับการเล่นเสียงผ่าน WebAudio',
        hint,
      };
    }

    try {
      await playBeep('newTicket');
      return { ok: true, hint };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        code: 'AUDIO_RESUME_BLOCKED',
        detail: `เบราว์เซอร์บล็อกการเล่นเสียงชั่วคราว (${msg})`,
        hint,
      };
    }
  }, [getAudioContext, playBeep, playVoiceClip, soundMode, soundVoice]);

  // ---------------------------------------------------------------
  // Fetch ticket_logs for this agent
  // ---------------------------------------------------------------
  const fetchLogs = useCallback(async () => {
    if (!agentId) return;
    const readIds = getReadIds();
    const clearBeforeMs = getClearBeforeMs();

    const { data } = await supabase
      .from('ticket_logs')
      .select('*, tickets(ticket_no, subject)')
      .or(`to_user_id.eq.${agentId},performer_id.eq.${agentId}`)
      .order('created_at', { ascending: false })
      .limit(30);

    if (!data) return;

    const notifs: AppNotification[] = data
      .filter((row) => {
        if (!clearBeforeMs) return true;
        const createdAtMs = new Date(row.created_at).getTime();
        return Number.isFinite(createdAtMs) && createdAtMs > clearBeforeMs;
      })
      .map((row) => {
      const id = row.id?.toString() ?? `${row.ticket_id}-${row.created_at}`;
      const isRead = readIds.includes(id);

      let title = 'อัปเดตใบงาน';
      const type: NotifType = 'ticket';

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
  }, [agentId, getClearBeforeMs, getReadIds, recalcUnread]);

  const fetchNewTicketsCount = useCallback(async () => {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .or('status.ilike.new,status.ilike.New');
    if (count !== null) setNewTicketsCount(count);
  }, []);

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
          title: `🕰️ SLA เหลือ ${mins} นาที — #${t.ticket_no}`,
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
        // Replace existing SLA notifs + add new ones at top
        const withoutOldSla = prev.filter(n => !n.id.startsWith('sla-'));
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

    // Defer initial state updates to avoid setState-in-effect lint rule.
    setTimeout(() => {
      void fetchLogs();
      void fetchSlaBreaches();
      void fetchNewTicketsCount();
    }, 0);

    // Load mute state
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('neo_notif_muted');
      if (stored !== null) {
        setTimeout(() => setIsMuted(stored === 'true'), 0);
      }

      const storedMode = localStorage.getItem(SOUND_MODE_KEY);
      if (storedMode === 'beep' || storedMode === 'voice') {
        setTimeout(() => setSoundModeState(storedMode), 0);
      }

      const storedVoice = localStorage.getItem(SOUND_VOICE_KEY);
      if (storedVoice === 'female' || storedVoice === 'male') {
        setTimeout(() => setSoundVoiceState(storedVoice), 0);
      }
    }

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
          await fetchNewTicketsCount();
          const normalizedStatus = (row.status || '').toLowerCase();
          if (normalizedStatus !== 'new') return;
          if (isFirstLoad.current) return;

          setLatestTicketRealtimeEvent({
            ticketId: String(row.id || ''),
            payload: row,
            occurredAt: Date.now(),
          });

          addToast({
            id: `toast-ticket-${Date.now()}`,
            type: 'ticket',
            title: '🆕 มีใบงานใหม่เข้าสู่ระบบ',
            body: row.subject || `ใบงาน #${row.ticket_no} กำลังรอการรับงาน`,
            ticketId: row.id,
            ticketNo: row.ticket_no,
          });

          playNewTicketSound();
        }
      )
      // Also listen to updates to capture status changes (e.g., ticket claimed)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, 
        async () => {
          await fetchNewTicketsCount();
        }
      )
      // Also listen to deletes
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, 
        async () => {
          await fetchNewTicketsCount();
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
  }, [agentId, fetchLogs, fetchNewTicketsCount, fetchSlaBreaches, addToast, playNewTicketSound]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlockAudio = () => {
      void primeAudio().catch(() => {});
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
    };
  }, [primeAudio]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('neo_notif_muted', String(next));
      if (!next) {
        void primeAudio().then(() => announceMuteState(false)).catch(() => {});
      }
      return next;
    });
  }, [announceMuteState, primeAudio]);

  return { 
    notifications, 
    toasts, 
    unreadCount, 
    newTicketsCount,
    latestTicketRealtimeEvent,
    isMuted,
    soundMode,
    soundVoice,
    setSoundMode,
    setSoundVoice,
    testSound,
    toggleMute,
    markAsRead, 
    markAllRead, 
    clearNotifications,
    dismissToast, 
    addToast 
  };
}

