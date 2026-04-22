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
// Track which SLA warnings we've already toasted to avoid repeated firing
const WARNED_SLA_KEY = 'neo_sla_warned_ids_v1';
const SOUND_MODE_KEY = 'neo_notif_sound_mode_v1';
const MAX_TOASTS = 4;

export type NotificationSoundMode = 'beep' | 'voice';

export type SoundTestFailureCode =
  | 'NO_AUDIO_CONTEXT'
  | 'AUDIO_RESUME_BLOCKED'
  | 'VOICE_UNAVAILABLE'
  | 'TTS_START_TIMEOUT';

export type SoundTestResult =
  | { ok: true; hint: string }
  | { ok: false; code: SoundTestFailureCode; detail: string; hint: string };

export function useNotifications(agentId: string | null) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [newTicketsCount, setNewTicketsCount] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Default to muted (browser policy friendly)
  const [soundMode, setSoundModeState] = useState<NotificationSoundMode>('beep');
  const isFirstLoad = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);

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
  }, [getAudioContext]);

  const playBeep = useCallback(
    async (pattern: 'confirm' | 'newTicket') => {
      const ctx = getAudioContext();
      if (!ctx) return;
      if (ctx.state !== 'running') {
        await ctx.resume();
      }

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.connect(ctx.destination);

      const beepOnce = (start: number, duration: number, frequency: number) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, start);
        osc.connect(gain);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.12, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.start(start);
        osc.stop(start + duration + 0.02);
      };

      if (pattern === 'confirm') {
        beepOnce(now + 0.02, 0.10, 880);
        return;
      }

      beepOnce(now + 0.02, 0.12, 784);
      beepOnce(now + 0.20, 0.12, 988);
    },
    [getAudioContext]
  );

  const waitForVoices = useCallback(async (timeoutMs: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return [];
    const synth = window.speechSynthesis;

    const initial = synth.getVoices();
    if (initial.length > 0) return initial;

    // Some browsers populate voices asynchronously; wait for voiceschanged or timeout.
    return await new Promise<SpeechSynthesisVoice[]>((resolve) => {
      let done = false;
      const finish = (voices: SpeechSynthesisVoice[]) => {
        if (done) return;
        done = true;
        resolve(voices);
      };

      const onVoicesChanged = () => finish(synth.getVoices());
      synth.addEventListener?.('voiceschanged', onVoicesChanged as any);

      setTimeout(() => {
        synth.removeEventListener?.('voiceschanged', onVoicesChanged as any);
        finish(synth.getVoices());
      }, timeoutMs);
    });
  }, []);

  const trySpeakChecked = useCallback(
    async (
      text: string,
      startTimeoutMs: number
    ): Promise<
      | { ok: true; usedFallbackVoice: boolean; voiceLang: string | null }
      | { ok: false; code: SoundTestFailureCode; detail: string }
    > => {
      if (typeof window === 'undefined' || !window.speechSynthesis) {
        return { ok: false, code: 'VOICE_UNAVAILABLE', detail: 'เบราว์เซอร์ไม่รองรับเสียงพูด (speechSynthesis)' };
      }

      try {
        const synth = window.speechSynthesis;
        synth.cancel();

        const voices = await waitForVoices(800);
        const thaiVoice = voices.find((voice) => voice.lang?.toLowerCase().startsWith('th'));
        const selectedVoice = thaiVoice ?? voices[0] ?? null;
        const usedFallbackVoice = !thaiVoice;
        const voiceLang = selectedVoice?.lang ?? null;
        if (!selectedVoice) {
          return { ok: false, code: 'VOICE_UNAVAILABLE', detail: 'ไม่พบเสียงพูดที่ใช้งานได้ในเบราว์เซอร์ (voices ว่างเปล่า)' };
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'th-TH';
        utterance.rate = 1.05;
        utterance.pitch = 1.0;
        utterance.voice = selectedVoice;

        const started = await new Promise<boolean>((resolve) => {
          let done = false;
          const finish = (value: boolean) => {
            if (done) return;
            done = true;
            resolve(value);
          };

          utterance.onstart = () => finish(true);
          utterance.onerror = () => finish(false);
          // If the browser never fires onstart/onerror, treat as failure.
          setTimeout(() => finish(false), startTimeoutMs);

          synth.speak(utterance);
        });

        if (!started) {
          return { ok: false, code: 'TTS_START_TIMEOUT', detail: 'สั่งพูดแล้วแต่ระบบไม่เริ่มเล่นเสียงพูด (อาจถูกบล็อก/เงียบ)' };
        }

        return { ok: true, usedFallbackVoice, voiceLang };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, code: 'VOICE_UNAVAILABLE', detail: `ไม่สามารถเริ่มเสียงพูดได้ (${msg})` };
      }
    },
    [waitForVoices]
  );

  const setSoundMode = useCallback((next: NotificationSoundMode) => {
    setSoundModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MODE_KEY, next);
    }
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
    
    // Skip browser notification for certain types as requested
    // Specifically disabling taskbar notification for new messages
    if (toast.type === 'message') return;
    
    showBrowserNotification(toast.title, toast.body);
  }, [showBrowserNotification]);

  const playNewTicketSound = useCallback(() => {
    if (isMuted) return;
    if (soundMode === 'voice') {
      void trySpeakChecked('มีใบงานใหม่', 900).then((res) => {
        if (res.ok) return;
        // Fallback to beep if voice is not available.
        void playBeep('newTicket');
      });
      return;
    }
    void playBeep('newTicket');
  }, [isMuted, playBeep, soundMode, trySpeakChecked]);

  const announceMuteState = useCallback((muted: boolean) => {
    if (muted) return;
    if (soundMode === 'voice') {
      void trySpeakChecked('เปิดเสียงแจ้งเตือนแล้ว', 900).then((res) => {
        if (res.ok) return;
        void playBeep('confirm');
      });
      return;
    }
    void playBeep('confirm');
  }, [playBeep, soundMode, trySpeakChecked]);

  const testSound = useCallback(async (): Promise<SoundTestResult> => {
    const hint =
      'ถ้าไม่ได้ยิน ให้ตรวจว่าแท็บ/เว็บไม่ถูก Mute และ Site settings > Sound เป็น Allow รวมถึงเสียงของเครื่อง (Volume mixer / output device)';

    if (soundMode === 'voice') {
      const res = await trySpeakChecked('มีใบงานใหม่', 1200);
      if (res.ok) {
        const voiceNote = res.usedFallbackVoice
          ? 'ไม่พบเสียงไทยในเบราว์เซอร์ จึงใช้เสียงเริ่มต้นของเครื่องแทน (ยังควรได้ยินเสียงพูด)'
          : 'ใช้เสียงไทยของเครื่อง';
        const extraHint = `${voiceNote} • ถ้าเพิ่งติดตั้งเสียง แนะนำปิดและเปิดเบราว์เซอร์ใหม่ 1 ครั้ง`;
        return { ok: true, hint: `${extraHint} • ${hint}` };
      }
      return { ok: false, code: res.code, detail: res.detail, hint };
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
  }, [getAudioContext, playBeep, soundMode, trySpeakChecked]);

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

      let title = 'à¸­à¸±à¸›à¹€à¸”à¸•à¹ƒà¸šà¸‡à¸²à¸™';
      const type: NotifType = 'ticket';

      if (row.action_type === 'transfer' && row.to_user_id === agentId) {
        title = `à¹‚à¸­à¸™à¸‡à¸²à¸™à¸¡à¸²à¹ƒà¸«à¹‰à¸„à¸¸à¸“ â€” #${row.tickets?.ticket_no ?? ''}`;
      } else if (row.action_type === 'claim') {
        title = `à¸£à¸±à¸šà¸‡à¸²à¸™à¹à¸¥à¹‰à¸§ â€” #${row.tickets?.ticket_no ?? ''}`;
      } else if (row.action_type === 'resolve') {
        title = `à¸›à¸´à¸”à¸‡à¸²à¸™ â€” #${row.tickets?.ticket_no ?? ''}`;
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

  const fetchNewTicketsCount = useCallback(async () => {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .or('status.ilike.new,status.ilike.New');
    if (count !== null) setNewTicketsCount(count);
  }, []);

  // ---------------------------------------------------------------
  // SLA Monitor â€” breached + warning (< 30 min)
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
          title: `ðŸš¨ SLA à¹€à¸à¸´à¸™à¸à¸³à¸«à¸™à¸”à¹à¸¥à¹‰à¸§ â€” #${t.ticket_no}`,
          body: t.subject ?? 'à¹ƒà¸šà¸‡à¸²à¸™à¸™à¸µà¹‰à¹€à¸à¸´à¸™ SLA à¹à¸¥à¹‰à¸§ à¸à¸£à¸¸à¸“à¸²à¸ˆà¸±à¸”à¸à¸²à¸£à¸”à¹ˆà¸§à¸™',
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
            title: `ðŸš¨ SLA à¸«à¸¥à¸¸à¸”à¸à¸³à¸«à¸™à¸” â€” #${t.ticket_no}`,
            body: t.subject ?? 'à¸à¸£à¸¸à¸“à¸²à¸ˆà¸±à¸”à¸à¸²à¸£à¸”à¹ˆà¸§à¸™',
            ticketId: t.id,
            ticketNo: t.ticket_no,
            duration: 8000,
          });
          saveWarnedId(id);
        }
      } else if (mins <= 30) {
        // --- SLA Warning (â‰¤ 30 min remaining) ---
        const id = `sla-warn-${t.id}`;
        slaNotifs.push({
          id,
          type: 'sla_warning',
          title: `âš ï¸ SLA à¹ƒà¸à¸¥à¹‰à¸«à¸¡à¸” (${mins} à¸™à¸²à¸—à¸µ) â€” #${t.ticket_no}`,
          body: t.subject ?? `à¹€à¸«à¸¥à¸·à¸­à¹€à¸§à¸¥à¸²à¸­à¸µà¸ ${mins} à¸™à¸²à¸—à¸µ`,
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
            title: `âš ï¸ SLA à¹ƒà¸à¸¥à¹‰à¸«à¸¡à¸” à¹€à¸«à¸¥à¸·à¸­ ${mins} à¸™à¸²à¸—à¸µ`,
            body: `#${t.ticket_no} Â· ${t.subject ?? ''}`,
            ticketId: t.id,
            ticketNo: t.ticket_no,
            duration: 6000,
          });
          saveWarnedId(id);
        }
      } else if (mins <= 60) {
        // --- SLA Upcoming (â‰¤ 60 min) â€” add to notification list only, no toast ---
        const id = `sla-upcoming-${t.id}`;
        slaNotifs.push({
          id,
          type: 'sla_warning',
          title: `ðŸ• SLA à¹€à¸«à¸¥à¸·à¸­ ${mins} à¸™à¸²à¸—à¸µ â€” #${t.ticket_no}`,
          body: t.subject ?? `à¹‚à¸›à¸£à¸”à¹€à¸•à¸£à¸µà¸¢à¸¡à¸”à¸³à¹€à¸™à¸´à¸™à¸à¸²à¸£à¸à¹ˆà¸­à¸™ SLA à¸«à¸¡à¸”`,
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

          let title = 'à¹ƒà¸šà¸‡à¸²à¸™à¹„à¸”à¹‰à¸£à¸±à¸šà¸à¸²à¸£à¸­à¸±à¸›à¹€à¸”à¸•';
          if (row.action_type === 'transfer' && row.to_user_id === agentId) {
            title = 'ðŸ“¨ à¸¡à¸µà¹ƒà¸šà¸‡à¸²à¸™à¹‚à¸­à¸™à¸¡à¸²à¹ƒà¸«à¹‰à¸„à¸¸à¸“';
          } else if (row.action_type === 'resolve') {
            title = 'âœ… à¹ƒà¸šà¸‡à¸²à¸™à¹„à¸”à¹‰à¸£à¸±à¸šà¸à¸²à¸£à¸›à¸´à¸”à¹à¸¥à¹‰à¸§';
          }

          addToast({
            id: `toast-log-${Date.now()}`,
            type: 'ticket',
            title,
            body: row.note || 'à¸”à¸¹à¸£à¸²à¸¢à¸¥à¸°à¹€à¸­à¸µà¸¢à¸”à¹ƒà¸™à¸à¸¥à¹ˆà¸­à¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡',
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
            title: 'ðŸ’¬ à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹ƒà¸«à¸¡à¹ˆà¸ˆà¸²à¸à¸¥à¸¹à¸à¸„à¹‰à¸²',
            body: (row.content as string)?.slice(0, 60) ?? 'à¸¡à¸µà¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡à¹ƒà¸«à¸¡à¹ˆ',
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

          addToast({
            id: `toast-ticket-${Date.now()}`,
            type: 'ticket',
            title: 'ðŸ†• à¸¡à¸µà¹ƒà¸šà¸‡à¸²à¸™à¹ƒà¸«à¸¡à¹ˆà¹€à¸‚à¹‰à¸²à¸ªà¸¹à¹ˆà¸£à¸°à¸šà¸š',
            body: row.subject || `à¹ƒà¸šà¸‡à¸²à¸™ #${row.ticket_no} à¸à¸³à¸¥à¸±à¸‡à¸£à¸­à¸à¸²à¸£à¸£à¸±à¸šà¸‡à¸²à¸™`,
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
    isMuted,
    soundMode,
    setSoundMode,
    testSound,
    toggleMute,
    markAsRead, 
    markAllRead, 
    dismissToast, 
    addToast 
  };
}

