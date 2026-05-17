'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { type StaffLocale, getStaffMessage } from '@/lib/i18n/staff';
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

export function useNotifications(agentId: string | null, role: string | null = null, locale: StaffLocale = 'th') {
  // --- States ---
  const [logNotifs, setLogNotifs] = useState<AppNotification[]>([]);
  const [slaNotifs, setSlaNotifs] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [slaAlertCount, setSlaAlertCount] = useState(0);
  const [newTicketsCount, setNewTicketsCount] = useState(0);
  const [latestTicketRealtimeEvent, setLatestTicketRealtimeEvent] = useState<LatestTicketRealtimeEvent | null>(null);

  const notifications = useMemo(() => {
    return [...slaNotifs, ...logNotifs].sort((a, b) => {
      // SLA breached first, then warning, then by date
      const priority = (n: AppNotification) => n.type === 'sla' ? 0 : n.type === 'sla_warning' ? 1 : 2;
      if (priority(a) !== priority(b)) return priority(a) - priority(b);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [logNotifs, slaNotifs]);
  
  // Notification Preferences (Per User)
  const [prefNewTicket, setPrefNewTicket] = useState(true);
  const [prefNewMessage, setPrefNewMessage] = useState(true);
  const [prefTransfer, setPrefTransfer] = useState(true);
  const [prefSlaWarning, setPrefSlaWarning] = useState(true);

  const [isMuted, setIsMuted] = useState(true); // Default to muted (browser policy friendly)
  const [soundMode, setSoundModeState] = useState<NotificationSoundMode>('beep');
  const [soundVoice, setSoundVoiceState] = useState<NotificationVoiceOption>('female');

  // --- Refs ---
  const isFirstLoad = useRef(true);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPrimedRef = useRef(false);
  const voiceAudioRef = useRef<Record<NotificationVoiceOption, HTMLAudioElement | null>>({
    female: null,
    male: null,
  });
  const logsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slaRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newTicketsCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. Basic Audio Helpers ---
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
        // Ignore
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

  const announceMuteState = useCallback((muted: boolean) => {
    if (muted) return;
    void playBeep('confirm');
  }, [playBeep]);

  // --- 2. Action Helpers ---
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

  const playNewTicketSound = useCallback(() => {
    if (isMuted || !prefNewTicket) return;
    if (soundMode === 'voice') {
      void playVoiceClip(soundVoice).catch(() => {
        void playBeep('newTicket');
      });
      return;
    }
    void playBeep('newTicket');
  }, [isMuted, playBeep, playVoiceClip, soundMode, soundVoice, prefNewTicket]);

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

  // --- 3. Preferences & Settings ---
  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem('neo_notif_muted', String(next));
      if (agentId) {
        void supabase.from('profiles').update({ notif_sound_enabled: !next }).eq('id', agentId);
      }
      if (!next) {
        void primeAudio().then(() => announceMuteState(false)).catch(() => {});
      }
      return next;
    });
  }, [agentId, announceMuteState, primeAudio]);

  const setSoundMode = useCallback((next: NotificationSoundMode) => {
    setSoundModeState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_MODE_KEY, next);
    }
    if (agentId) {
      void supabase.from('profiles').update({ notif_sound_mode: next }).eq('id', agentId);
    }
  }, [agentId]);

  const setSoundVoice = useCallback((next: NotificationVoiceOption) => {
    setSoundVoiceState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_VOICE_KEY, next);
    }
    if (agentId) {
      void supabase.from('profiles').update({ notif_sound_voice: next }).eq('id', agentId);
    }
  }, [agentId]);

  const updatePreference = useCallback(async (key: string, value: boolean) => {
    if (!agentId) return;
    if (key === 'new_ticket') setPrefNewTicket(value);
    if (key === 'new_message') setPrefNewMessage(value);
    if (key === 'transfer') setPrefTransfer(value);
    if (key === 'sla_warning') setPrefSlaWarning(value);
    const dbKey = `notif_event_${key}`;
    await supabase.from('profiles').update({ [dbKey]: value }).eq('id', agentId);
  }, [agentId]);

  const testSound = useCallback(async (): Promise<SoundTestResult> => {
    const hint = 'ถ้าไม่ได้ยิน ให้ตรวจว่าแท็บ/เว็บไม่ถูก Mute และ Site settings > Sound เป็น Allow';
    if (soundMode === 'voice') {
      try {
        await playVoiceClip(soundVoice);
        const voiceLabel = soundVoice === 'female' 
          ? getStaffMessage(locale, 'notificationsHub.alerts.voiceFemale') 
          : getStaffMessage(locale, 'notificationsHub.alerts.voiceMale');
        return { ok: true, hint: `กำลังใช้ ${voiceLabel} • ${hint}` };
      } catch (err) {
        return { ok: false, code: 'AUDIO_PLAYBACK_FAILED', detail: String(err), hint };
      }
    }
    try {
      await playBeep('newTicket');
      return { ok: true, hint };
    } catch (err) {
      return { ok: false, code: 'AUDIO_RESUME_BLOCKED', detail: String(err), hint };
    }
  }, [playBeep, playVoiceClip, soundMode, soundVoice, locale]);

  // --- 4. Notification Helpers ---
  const recalcUnread = useCallback((notifs: AppNotification[]) => {
    setUnreadCount(notifs.filter((n) => !n.isRead).length);
    setSlaAlertCount(notifs.filter((n) => (n.type === 'sla' || n.type === 'sla_warning') && !n.isRead).length);
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
      const next = [...ids, id].slice(-100);
      localStorage.setItem(WARNED_SLA_KEY, JSON.stringify(next));
    }
  }, []);

  const addToast = useCallback((toast: ToastNotif) => {
    if (toast.type === 'message' && !prefNewMessage) return;
    if (toast.type === 'ticket' && !prefNewTicket) return;
    if ((toast.type === 'sla' || toast.type === 'sla_warning') && !prefSlaWarning) return;
    
    setToasts(prev => [toast, ...prev].slice(0, MAX_TOASTS));
    showBrowserNotification(toast.title, toast.body);
  }, [showBrowserNotification, prefNewMessage, prefNewTicket, prefSlaWarning]);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const markAsRead = useCallback((id: string) => {
    const update = (list: AppNotification[]) => list.map(n => n.id === id ? { ...n, isRead: true } : n);
    setLogNotifs(prev => update(prev));
    setSlaNotifs(prev => update(prev));

    if (typeof window !== 'undefined') {
      const readIds = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[];
      if (!readIds.includes(id)) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...readIds, id]));
      }
    }
  }, []);

  const markAllRead = useCallback(() => {
    const update = (list: AppNotification[]) => list.map(n => ({ ...n, isRead: true }));
    setLogNotifs(prev => update(prev));
    setSlaNotifs(prev => update(prev));

    if (typeof window !== 'undefined') {
      const allIds = [...logNotifs, ...slaNotifs].map(n => n.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(allIds));
    }
  }, [logNotifs, slaNotifs]);

  const clearNotifications = useCallback(() => {
    const currentIds = [...logNotifs, ...slaNotifs].map(n => n.id);
    setLogNotifs([]);
    setSlaNotifs([]);
    setToasts([]);
    if (typeof window !== 'undefined') {
      const existingReadIds = getReadIds();
      const mergedReadIds = Array.from(new Set([...existingReadIds, ...currentIds]));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mergedReadIds.slice(-1000)));
      localStorage.setItem(CLEAR_BEFORE_KEY, String(Date.now()));
    }
  }, [getReadIds, logNotifs, slaNotifs]);

  // Effect to sync unread counts whenever notifications change
  useEffect(() => {
    setUnreadCount(notifications.filter((n: AppNotification) => !n.isRead).length);
    setSlaAlertCount(notifications.filter((n: AppNotification) => (n.type === 'sla' || n.type === 'sla_warning') && !n.isRead).length);
  }, [notifications]);

  // --- 5. Data Fetching ---
  const fetchLogs = useCallback(async () => {
    if (!agentId) return;
    const readIds = getReadIds();
    const clearBeforeMs = getClearBeforeMs();
    const isAdmin = role === 'Administrator';
    let query = supabase
      .from('ticket_logs')
      .select('*, tickets(ticket_no, subject)')
      .order('created_at', { ascending: false })
      .limit(30);

    if (!isAdmin) {
      query = query.or(`to_user_id.eq.${agentId},performer_id.eq.${agentId}`);
    }

    const { data } = await query;
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
        let title = getStaffMessage(locale, 'notificationsHub.alerts.updateTitle');
        if (row.action_type === 'transfer' && row.to_user_id === agentId) {
          title = getStaffMessage(locale, 'notificationsHub.alerts.transferBody').replace('#{no}', `#${row.tickets?.ticket_no ?? ''}`);
        } else if (row.action_type === 'claim') {
          title = getStaffMessage(locale, 'notificationsHub.alerts.claimBody').replace('#{no}', `#${row.tickets?.ticket_no ?? ''}`);
        } else if (row.action_type === 'resolve') {
          title = getStaffMessage(locale, 'notificationsHub.alerts.resolveBody').replace('#{no}', `#${row.tickets?.ticket_no ?? ''}`);
        }
        return { id, type: 'ticket', title, body: row.tickets?.subject ?? row.note ?? '-', ticketNo: row.tickets?.ticket_no, ticketId: row.ticket_id, createdAt: row.created_at, isRead };
      });
    setLogNotifs(notifs);
  }, [agentId, role, getClearBeforeMs, getReadIds, locale]);

  const fetchNewTicketsCount = useCallback(async () => {
    const { count } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .or('status.ilike.new,status.ilike.New');
    if (count !== null) setNewTicketsCount(count);
  }, []);

  const fetchSlaBreaches = useCallback(async () => {
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    
    // Everyone sees all SLA breaches by default (as requested)
    let query = supabase
      .from('tickets')
      .select('id, ticket_no, subject, sla_due_at, status, priority')
      .lt('sla_due_at', twoHoursFromNow)
      .not('status', 'in', '("Resolved","Closed")')
      .order('sla_due_at', { ascending: true })
      .limit(20);

    const { data } = await query;
    if (!data) return;
    const readIds = getReadIds();
    const warnedIds = getWarnedIds();
    const slaNotifs: AppNotification[] = [];
    for (const t of data) {
      const mins = slaMinutesRemaining(t);
      const breached = isSlaBreached(t);
      if (breached) {
        const id = `sla-breach-${t.id}`;
        slaNotifs.push({ id, type: 'sla', title: getStaffMessage(locale, 'notificationsHub.alerts.slaBreachedTitle').replace('#{no}', `#${t.ticket_no}`), body: getStaffMessage(locale, 'notificationsHub.alerts.slaBreachedBody'), ticketNo: t.ticket_no, ticketId: t.id, createdAt: t.sla_due_at, isRead: readIds.includes(id), minutesRemaining: mins });
        if (!warnedIds.includes(id) && !isFirstLoad.current) {
          addToast({ id: `toast-${id}-${Date.now()}`, type: 'sla', title: getStaffMessage(locale, 'notificationsHub.alerts.slaBreachedTitle').replace('#{no}', `#${t.ticket_no}`), body: t.subject || getStaffMessage(locale, 'notificationsHub.alerts.slaBreachedBody'), ticketId: t.id, ticketNo: t.ticket_no, duration: 8000 });
          if (prefSlaWarning && !isMuted) void playBeep('newTicket');
          saveWarnedId(id);
        }
      } else if (mins <= 30) {
        const id = `sla-warn-${t.id}`;
        slaNotifs.push({ id, type: 'sla_warning', title: getStaffMessage(locale, 'notificationsHub.alerts.slaWarningTitle').replace('{mins}', String(mins)).replace('#{no}', `#${t.ticket_no}`), body: t.subject || getStaffMessage(locale, 'notificationsHub.alerts.slaWarningBody').replace('{mins}', String(mins)), ticketNo: t.ticket_no, ticketId: t.id, createdAt: t.sla_due_at, isRead: readIds.includes(id), minutesRemaining: mins });
        if (!warnedIds.includes(id) && !isFirstLoad.current) {
          addToast({ id: `toast-${id}-${Date.now()}`, type: 'sla_warning', title: getStaffMessage(locale, 'notificationsHub.alerts.slaWarningTitle').replace('{mins}', String(mins)).replace('#{no}', `#${t.ticket_no}`), body: `#${t.ticket_no} · ${t.subject ?? ''}`, ticketId: t.id, ticketNo: t.ticket_no, duration: 6000 });
          if (prefSlaWarning && !isMuted) void playBeep('newTicket');
          saveWarnedId(id);
        }
      }
    }
    if (slaNotifs.length > 0) {
      setSlaNotifs(slaNotifs);
    }
  }, [getReadIds, getWarnedIds, saveWarnedId, addToast, locale, isMuted, playBeep, prefSlaWarning]);

  const scheduleFetchLogs = useCallback((delayMs = 300) => {
    if (logsRefreshTimerRef.current) clearTimeout(logsRefreshTimerRef.current);
    logsRefreshTimerRef.current = setTimeout(() => { void fetchLogs(); }, delayMs);
  }, [fetchLogs]);

  const scheduleFetchNewTicketsCount = useCallback((delayMs = 800) => {
    if (newTicketsCountTimerRef.current) clearTimeout(newTicketsCountTimerRef.current);
    newTicketsCountTimerRef.current = setTimeout(() => { void fetchNewTicketsCount(); }, delayMs);
  }, [fetchNewTicketsCount]);

  const scheduleFetchSlaBreaches = useCallback((delayMs = 1200) => {
    if (slaRefreshTimerRef.current) clearTimeout(slaRefreshTimerRef.current);
    slaRefreshTimerRef.current = setTimeout(() => { void fetchSlaBreaches(); }, delayMs);
  }, [fetchSlaBreaches]);

  // Create stable refs for callbacks and dynamic preferences to prevent realtime re-subscription loops
  const prefTransferRef = useRef(prefTransfer);
  const prefNewMessageRef = useRef(prefNewMessage);
  const addToastRef = useRef(addToast);
  const playNewTicketSoundRef = useRef(playNewTicketSound);
  const fetchLogsRef = useRef(fetchLogs);
  const fetchNewTicketsCountRef = useRef(fetchNewTicketsCount);
  const scheduleFetchLogsRef = useRef(scheduleFetchLogs);
  const scheduleFetchNewTicketsCountRef = useRef(scheduleFetchNewTicketsCount);
  const scheduleFetchSlaBreachesRef = useRef(scheduleFetchSlaBreaches);

  // Sync refs with the latest state values on render
  useEffect(() => { prefTransferRef.current = prefTransfer; }, [prefTransfer]);
  useEffect(() => { prefNewMessageRef.current = prefNewMessage; }, [prefNewMessage]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  useEffect(() => { playNewTicketSoundRef.current = playNewTicketSound; }, [playNewTicketSound]);
  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);
  useEffect(() => { fetchNewTicketsCountRef.current = fetchNewTicketsCount; }, [fetchNewTicketsCount]);
  useEffect(() => { scheduleFetchLogsRef.current = scheduleFetchLogs; }, [scheduleFetchLogs]);
  useEffect(() => { scheduleFetchNewTicketsCountRef.current = scheduleFetchNewTicketsCount; }, [scheduleFetchNewTicketsCount]);
  useEffect(() => { scheduleFetchSlaBreachesRef.current = scheduleFetchSlaBreaches; }, [scheduleFetchSlaBreaches]);

  // --- 6. Effects ---
  
  // Effect 1: Load configuration and profile settings once on mount or when agentId changes
  useEffect(() => {
    if (!agentId) return;
    
    if (typeof window !== 'undefined') {
      const m = localStorage.getItem('neo_notif_muted'); if (m !== null) setIsMuted(m === 'true');
      const mode = localStorage.getItem(SOUND_MODE_KEY); if (mode === 'beep' || mode === 'voice') setSoundModeState(mode as any);
      const voice = localStorage.getItem(SOUND_VOICE_KEY); if (voice === 'female' || voice === 'male') setSoundVoiceState(voice as any);
    }

    const loadFromProfile = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', agentId).maybeSingle();
      if (!data) return;
      if (data.notif_sound_enabled !== undefined) setIsMuted(!data.notif_sound_enabled);
      if (data.notif_sound_mode) setSoundModeState(data.notif_sound_mode);
      if (data.notif_sound_voice) setSoundVoiceState(data.notif_sound_voice);
      if (data.notif_event_new_ticket !== undefined) setPrefNewTicket(data.notif_event_new_ticket);
      if (data.notif_event_new_message !== undefined) setPrefNewMessage(data.notif_event_new_message);
      if (data.notif_event_transfer !== undefined) setPrefTransfer(data.notif_event_transfer);
      if (data.notif_event_sla_warning !== undefined) setPrefSlaWarning(data.notif_event_sla_warning);
    };
    void loadFromProfile();
  }, [agentId]);

  // Effect 2: Setup real-time subscriptions and initialize log/SLA fetching
  useEffect(() => {
    if (!agentId) return;
    
    setTimeout(() => { 
      void fetchLogsRef.current(); 
      void fetchNewTicketsCountRef.current(); 
      scheduleFetchSlaBreachesRef.current(1600); 
    }, 0);

    const logChannel = supabase.channel(`logs-${agentId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ticket_logs' }, (p) => {
      const row = p.new as any; if (row.to_user_id !== agentId && row.performer_id !== agentId) return;
      scheduleFetchLogsRef.current(250); scheduleFetchSlaBreachesRef.current(900);
      if (isFirstLoad.current || !prefTransferRef.current) return;
      addToastRef.current({ id: `t-log-${Date.now()}`, type: 'ticket', title: 'ใบงานได้รับการอัปเดต', body: row.note || 'ดูรายละเอียดในกล่องข้อความ', ticketId: row.ticket_id });
    }).subscribe();

    const msgChannel = supabase.channel(`msgs-${agentId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
      const row = p.new as any; if (row.sender_type !== 'customer' || row.message_type === 'system') return;
      if (isFirstLoad.current || !prefNewMessageRef.current) return;
      addToastRef.current({ id: `t-msg-${Date.now()}`, type: 'message', title: getStaffMessage(locale, 'notificationsHub.alerts.newMessageTitle'), body: (row.content as string)?.slice(0, 60), conversationId: row.conversation_id });
    }).subscribe();

    const ticketChannel = supabase.channel('tickets').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tickets' }, (p) => {
      const row = p.new as any; scheduleFetchNewTicketsCountRef.current(400);
      if ((row.status || '').toLowerCase() !== 'new' || isFirstLoad.current) return;
      setLatestTicketRealtimeEvent({ ticketId: String(row.id), payload: row, occurredAt: Date.now() });
      addToastRef.current({ id: `t-tkt-${Date.now()}`, type: 'ticket', title: getStaffMessage(locale, 'notificationsHub.alerts.newTicketTitle'), body: row.subject, ticketId: row.id, ticketNo: row.ticket_no });
      playNewTicketSoundRef.current();
    }).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets' }, (p) => {
      const ns = String((p.new as any).status).toLowerCase();
      const ps = String((p.old as any).status).toLowerCase();
      if (ns === 'new' || ps === 'new') scheduleFetchNewTicketsCountRef.current(450);
    }).on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tickets' }, () => { scheduleFetchNewTicketsCountRef.current(450); }).subscribe();

    const slaInterval = setInterval(() => { scheduleFetchSlaBreachesRef.current(0); }, 120_000);
    const firstLoadTimer = setTimeout(() => { isFirstLoad.current = false; }, 2500);

    return () => {
      supabase.removeChannel(logChannel); supabase.removeChannel(msgChannel); supabase.removeChannel(ticketChannel);
      clearInterval(slaInterval); clearTimeout(firstLoadTimer);
      if (logsRefreshTimerRef.current) clearTimeout(logsRefreshTimerRef.current);
      if (slaRefreshTimerRef.current) clearTimeout(slaRefreshTimerRef.current);
      if (newTicketsCountTimerRef.current) clearTimeout(newTicketsCountTimerRef.current);
    };
  }, [agentId, role, locale]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const unlockAudio = () => { void primeAudio().catch(() => {}); };
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);
    return () => { window.removeEventListener('pointerdown', unlockAudio); window.removeEventListener('keydown', unlockAudio); };
  }, [primeAudio]);

  return useMemo(() => ({
    notifications, toasts, unreadCount, slaAlertCount, newTicketsCount, latestTicketRealtimeEvent, isMuted, soundMode, soundVoice,
    prefNewTicket, prefNewMessage, prefTransfer, prefSlaWarning, setSoundMode, setSoundVoice, updatePreference, testSound, toggleMute,
    markAsRead, markAllRead, clearNotifications, dismissToast, addToast
  }), [
    notifications, toasts, unreadCount, slaAlertCount, newTicketsCount, latestTicketRealtimeEvent, isMuted, soundMode, soundVoice,
    prefNewTicket, prefNewMessage, prefTransfer, prefSlaWarning, setSoundMode, setSoundVoice, updatePreference, testSound, toggleMute,
    markAsRead, markAllRead, clearNotifications, dismissToast, addToast
  ]);
}
