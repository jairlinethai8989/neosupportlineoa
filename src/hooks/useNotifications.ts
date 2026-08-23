'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  getActiveInboxCountAction,
  getNewTicketCountAction,
  getNotificationActivityAction,
  getSlaNotificationTicketsAction,
  getTicketLogNotificationsAction,
} from '@/app/actions/notificationActions';
import { type StaffLocale, getStaffMessage } from '@/lib/i18n/staff';
import { isSlaBreached, slaMinutesRemaining } from '@/lib/utils/slaUtils';
import { updateOwnProfile } from '@/lib/profiles/updateOwnProfile';

import type { 
  NotifType, 
  AppNotification, 
  ToastNotif 
} from '@/types/notifications';

export type { NotifType, AppNotification, ToastNotif };

// Track which SLA warnings we've already toasted to avoid repeated firing
const SOUND_MODE_KEY = 'neo_notif_sound_mode_v1';
const SOUND_VOICE_KEY = 'neo_notif_voice_v1';
const MAX_TOASTS = 4;
const VOICE_AUDIO_SRC = {
  female: '/audio/new-ticket-female.mp3',
  male: '/audio/new-ticket-male.mp3',
} as const;

export type NotificationSoundMode = 'beep' | 'beep-retro' | 'beep-cosmic' | 'beep-digital' | 'beep-alert' | 'voice';
export type NotificationVoiceOption = 'female' | 'male';

export type SoundTestFailureCode =
  | 'NO_AUDIO_CONTEXT'
  | 'AUDIO_RESUME_BLOCKED'
  | 'AUDIO_PLAYBACK_FAILED';

export type SoundTestResult =
  | { ok: true; hint: string }
  | { ok: false; code: SoundTestFailureCode; detail: string; hint: string };

export interface RealtimeDbEvent {
  table: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  payload: unknown;
  occurredAt: number;
}

export function useNotifications(
  agentId: string | null,
  role: string | null = null,
  locale: StaffLocale = 'th',
  userProfile: any = null
) {
  // User-specific localStorage keys to isolate notification clear/read state between users
  const userStorageKey = useMemo(() => agentId ? `neo_notif_read_ids_v1_${agentId}` : 'neo_notif_read_ids_v1', [agentId]);
  const userClearBeforeKey = useMemo(() => agentId ? `neo_notif_clear_before_ms_v1_${agentId}` : 'neo_notif_clear_before_ms_v1', [agentId]);
  const userWarnedSlaKey = useMemo(() => agentId ? `neo_sla_warned_ids_v1_${agentId}` : 'neo_sla_warned_ids_v1', [agentId]);

  // --- States ---
  const [logNotifs, setLogNotifs] = useState<AppNotification[]>([]);
  const [slaNotifs, setSlaNotifs] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<ToastNotif[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [slaAlertCount, setSlaAlertCount] = useState(0);
  const [newTicketsCount, setNewTicketsCount] = useState(0);
  const [inboxCount, setInboxCount] = useState(0);
  const [lastDbEvent, setLastDbEvent] = useState<RealtimeDbEvent | null>(null);

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
  const activityCursorRef = useRef<string | null>(null);
  const activityPollingRef = useRef(false);

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

      // Check current soundMode to determine Beep style
      switch (soundMode) {
        case 'beep-retro':
          // Retro 8-bit arpeggio sound
          playTone(now + 0.02, 0.08, 523.25, 'square', 0.07); // C5
          playTone(now + 0.10, 0.08, 659.25, 'square', 0.07); // E5
          playTone(now + 0.18, 0.08, 783.99, 'square', 0.07); // G5
          playTone(now + 0.26, 0.22, 1046.50, 'square', 0.07); // C6
          break;
        case 'beep-cosmic':
          // Cosmic echo sweeping sound
          playTone(now + 0.02, 0.4, 880.00, 'sine', 0.08); // A5
          playTone(now + 0.12, 0.35, 1109.73, 'triangle', 0.04); // C#6 (Subtle harmony)
          playTone(now + 0.22, 0.3, 1318.51, 'sine', 0.03); // E6
          break;
        case 'beep-digital':
          // Fast digital double chime pulse
          playTone(now + 0.02, 0.12, 1200, 'sine', 0.1);
          playTone(now + 0.14, 0.18, 1600, 'sine', 0.08);
          break;
        case 'beep-alert':
          // Urgent support notification alert
          playTone(now + 0.02, 0.15, 880.00, 'sawtooth', 0.05); // Dual sawtooth C6/A5 tone
          playTone(now + 0.02, 0.15, 1046.50, 'triangle', 0.1); 
          playTone(now + 0.20, 0.25, 880.00, 'sawtooth', 0.05);
          playTone(now + 0.20, 0.25, 1046.50, 'triangle', 0.1);
          break;
        case 'beep':
        default:
          // Standard classic beep
          playTone(now + 0.02, 0.24, 1046.5, 'triangle', 0.12);
          playTone(now + 0.035, 0.2, 2093, 'sine', 0.04);
          playTone(now + 0.28, 0.34, 783.99, 'triangle', 0.11);
          playTone(now + 0.3, 0.26, 1567.98, 'sine', 0.03);
          break;
      }
    },
    [getAudioContext, soundMode]
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
        void updateOwnProfile({ notif_sound_enabled: !next });
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
      void updateOwnProfile({ notif_sound_mode: next });
    }
  }, [agentId]);

  const setSoundVoice = useCallback((next: NotificationVoiceOption) => {
    setSoundVoiceState(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SOUND_VOICE_KEY, next);
    }
    if (agentId) {
      void updateOwnProfile({ notif_sound_voice: next });
    }
  }, [agentId]);

  const updatePreference = useCallback(async (key: string, value: boolean) => {
    if (!agentId) return;
    if (key === 'new_ticket') setPrefNewTicket(value);
    if (key === 'new_message') setPrefNewMessage(value);
    if (key === 'transfer') setPrefTransfer(value);
    if (key === 'sla_warning') setPrefSlaWarning(value);
    const updateByPreference = {
      new_ticket: { notif_event_new_ticket: value },
      new_message: { notif_event_new_message: value },
      transfer: { notif_event_transfer: value },
      sla_warning: { notif_event_sla_warning: value },
    } as const;
    await updateOwnProfile(updateByPreference[key as keyof typeof updateByPreference]);
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

  const getReadIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(userStorageKey) || '[]'); } catch { return []; }
  }, [userStorageKey]);

  const getClearBeforeMs = useCallback((): number => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(userClearBeforeKey);
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [userClearBeforeKey]);

  const getWarnedIds = useCallback((): string[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(userWarnedSlaKey) || '[]'); } catch { return []; }
  }, [userWarnedSlaKey]);

  const saveWarnedId = useCallback((id: string) => {
    if (typeof window === 'undefined') return;
    const ids = JSON.parse(localStorage.getItem(userWarnedSlaKey) || '[]') as string[];
    if (!ids.includes(id)) {
      const next = [...ids, id].slice(-100);
      localStorage.setItem(userWarnedSlaKey, JSON.stringify(next));
    }
  }, [userWarnedSlaKey]);

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
      const readIds = JSON.parse(localStorage.getItem(userStorageKey) || '[]') as string[];
      if (!readIds.includes(id)) {
        localStorage.setItem(userStorageKey, JSON.stringify([...readIds, id]));
      }
    }
  }, [userStorageKey]);

  const markAllRead = useCallback(() => {
    const update = (list: AppNotification[]) => list.map(n => ({ ...n, isRead: true }));
    setLogNotifs(prev => update(prev));
    setSlaNotifs(prev => update(prev));

    if (typeof window !== 'undefined') {
      const allIds = [...logNotifs, ...slaNotifs].map(n => n.id);
      localStorage.setItem(userStorageKey, JSON.stringify(allIds));
    }
  }, [logNotifs, slaNotifs, userStorageKey]);

  const clearNotifications = useCallback(() => {
    const currentIds = [...logNotifs, ...slaNotifs].map(n => n.id);
    setLogNotifs([]);
    setSlaNotifs([]);
    setToasts([]);
    if (typeof window !== 'undefined') {
      const existingReadIds = getReadIds();
      const mergedReadIds = Array.from(new Set([...existingReadIds, ...currentIds]));
      localStorage.setItem(userStorageKey, JSON.stringify(mergedReadIds.slice(-1000)));
      localStorage.setItem(userClearBeforeKey, String(Date.now()));
    }
  }, [getReadIds, logNotifs, slaNotifs, userStorageKey, userClearBeforeKey]);

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
    const data = await getTicketLogNotificationsAction();
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
  }, [agentId, getClearBeforeMs, getReadIds, locale]);

  const fetchNewTicketsCount = useCallback(async () => {
    setNewTicketsCount(await getNewTicketCountAction());
  }, []);

  const fetchInboxCount = useCallback(async () => {
    setInboxCount(await getActiveInboxCountAction());
  }, []);

  const fetchSlaBreaches = useCallback(async () => {
    const data = await getSlaNotificationTicketsAction();
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

  const scheduleFetchInboxCount = useCallback((delayMs = 800) => {
    setTimeout(() => { void fetchInboxCount(); }, delayMs);
  }, [fetchInboxCount]);

  const scheduleFetchSlaBreaches = useCallback((delayMs = 1200) => {
    if (slaRefreshTimerRef.current) clearTimeout(slaRefreshTimerRef.current);
    slaRefreshTimerRef.current = setTimeout(() => { void fetchSlaBreaches(); }, delayMs);
  }, [fetchSlaBreaches]);

  // Create stable refs for callbacks and dynamic preferences to prevent realtime re-subscription loops
  const prefNewMessageRef = useRef(prefNewMessage);
  const addToastRef = useRef(addToast);
  const playNewTicketSoundRef = useRef(playNewTicketSound);
  const fetchLogsRef = useRef(fetchLogs);
  const fetchNewTicketsCountRef = useRef(fetchNewTicketsCount);
  const fetchInboxCountRef = useRef(fetchInboxCount);
  const scheduleFetchLogsRef = useRef(scheduleFetchLogs);
  const scheduleFetchNewTicketsCountRef = useRef(scheduleFetchNewTicketsCount);
  const scheduleFetchInboxCountRef = useRef(scheduleFetchInboxCount);
  const scheduleFetchSlaBreachesRef = useRef(scheduleFetchSlaBreaches);

  // Sync refs with the latest state values on render
  useEffect(() => { prefNewMessageRef.current = prefNewMessage; }, [prefNewMessage]);
  useEffect(() => { addToastRef.current = addToast; }, [addToast]);
  useEffect(() => { playNewTicketSoundRef.current = playNewTicketSound; }, [playNewTicketSound]);
  useEffect(() => { fetchLogsRef.current = fetchLogs; }, [fetchLogs]);
  useEffect(() => { fetchNewTicketsCountRef.current = fetchNewTicketsCount; }, [fetchNewTicketsCount]);
  useEffect(() => { fetchInboxCountRef.current = fetchInboxCount; }, [fetchInboxCount]);
  useEffect(() => { scheduleFetchLogsRef.current = scheduleFetchLogs; }, [scheduleFetchLogs]);
  useEffect(() => { scheduleFetchNewTicketsCountRef.current = scheduleFetchNewTicketsCount; }, [scheduleFetchNewTicketsCount]);
  useEffect(() => { scheduleFetchInboxCountRef.current = scheduleFetchInboxCount; }, [scheduleFetchInboxCount]);
  useEffect(() => { scheduleFetchSlaBreachesRef.current = scheduleFetchSlaBreaches; }, [scheduleFetchSlaBreaches]);

  // --- 6. Effects ---
  
  // Effect 1: Load configuration and profile settings once on mount or when userProfile changes
  useEffect(() => {
    if (!agentId) return;
    
    if (typeof window !== 'undefined') {
      const m = localStorage.getItem('neo_notif_muted'); if (m !== null) setIsMuted(m === 'true');
      const mode = localStorage.getItem(SOUND_MODE_KEY); if (mode === 'beep' || mode === 'voice') setSoundModeState(mode as any);
      const voice = localStorage.getItem(SOUND_VOICE_KEY); if (voice === 'female' || voice === 'male') setSoundVoiceState(voice as any);
    }

    if (userProfile) {
      if (userProfile.notif_sound_enabled !== undefined) setIsMuted(!userProfile.notif_sound_enabled);
      if (userProfile.notif_sound_mode) setSoundModeState(userProfile.notif_sound_mode);
      if (userProfile.notif_sound_voice) setSoundVoiceState(userProfile.notif_sound_voice);
      if (userProfile.notif_event_new_ticket !== undefined) setPrefNewTicket(userProfile.notif_event_new_ticket);
      if (userProfile.notif_event_new_message !== undefined) setPrefNewMessage(userProfile.notif_event_new_message);
      if (userProfile.notif_event_transfer !== undefined) setPrefTransfer(userProfile.notif_event_transfer);
      if (userProfile.notif_event_sla_warning !== undefined) setPrefSlaWarning(userProfile.notif_event_sla_warning);
    }
  }, [agentId, userProfile]);

  // Effect 2: Poll sanitized server DTOs and initialize log/SLA fetching.
  // Database Realtime payloads intentionally stay off the browser security boundary.
  useEffect(() => {
    if (!agentId) return;
    activityCursorRef.current = new Date().toISOString();
    
    setTimeout(() => { 
      void fetchLogsRef.current(); 
      void fetchNewTicketsCountRef.current(); 
      void fetchInboxCountRef.current();
      scheduleFetchSlaBreachesRef.current(1600); 
    }, 2000);

    const pollActivity = async () => {
      const cursor = activityCursorRef.current;
      if (!cursor || activityPollingRef.current) return;
      activityPollingRef.current = true;
      try {
        const activity = await getNotificationActivityAction(cursor);
        activityCursorRef.current = activity.serverTime;
        let nextDbEvent: RealtimeDbEvent | null = null;

        if (activity.ticketLogs.length > 0) {
          const latest = activity.ticketLogs[activity.ticketLogs.length - 1];
          nextDbEvent = { table: 'ticket_logs', action: 'INSERT', payload: { id: latest.id }, occurredAt: Date.now() };
          scheduleFetchLogsRef.current(0);
          scheduleFetchSlaBreachesRef.current(500);
        }
        if (activity.tickets.length > 0) {
          const latest = activity.tickets[activity.tickets.length - 1];
          nextDbEvent = { table: 'tickets', action: 'UPDATE', payload: { new: latest }, occurredAt: Date.now() };
          scheduleFetchNewTicketsCountRef.current(0);
          const newTickets = activity.tickets.filter((row) =>
            String(row.status).toLowerCase() === 'new' && Date.parse(row.created_at) > Date.parse(cursor)
          );
          for (const row of newTickets) {
            addToastRef.current({ id: `t-tkt-${row.id}`, type: 'ticket', title: getStaffMessage(locale, 'notificationsHub.alerts.newTicketTitle'), body: row.subject || '', ticketId: row.id, ticketNo: row.ticket_no });
            playNewTicketSoundRef.current();
          }
        }
        for (const row of activity.messages) {
          if (!prefNewMessageRef.current) break;
          addToastRef.current({ id: `t-msg-${row.id}`, type: 'message', title: getStaffMessage(locale, 'notificationsHub.alerts.newMessageTitle'), body: (row.content || '').slice(0, 60), conversationId: row.conversation_id || undefined });
        }
        if (activity.conversations.length > 0) {
          const latest = activity.conversations[activity.conversations.length - 1];
          nextDbEvent ||= { table: 'conversations', action: 'UPDATE', payload: { new: latest }, occurredAt: Date.now() };
          scheduleFetchInboxCountRef.current(0);
        }
        if (nextDbEvent) setLastDbEvent(nextDbEvent);
      } catch {
        // Keep the previous cursor so a transient failure can be retried within the bounded window.
      } finally {
        activityPollingRef.current = false;
      }
    };

    const slaInterval = setInterval(() => { scheduleFetchSlaBreachesRef.current(0); }, 120_000);
    const activityInterval = setInterval(() => { void pollActivity(); }, 10_000);
    const firstLoadTimer = setTimeout(() => { isFirstLoad.current = false; }, 2500);

    return () => {
      clearInterval(activityInterval); clearInterval(slaInterval); clearTimeout(firstLoadTimer);
      activityCursorRef.current = null;
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
    notifications, toasts, unreadCount, slaAlertCount, newTicketsCount, inboxCount, lastDbEvent, isMuted, soundMode, soundVoice,
    prefNewTicket, prefNewMessage, prefTransfer, prefSlaWarning, setSoundMode, setSoundVoice, updatePreference, testSound, toggleMute,
    markAsRead, markAllRead, clearNotifications, dismissToast, addToast
  }), [
    notifications, toasts, unreadCount, slaAlertCount, newTicketsCount, inboxCount, lastDbEvent, isMuted, soundMode, soundVoice,
    prefNewTicket, prefNewMessage, prefTransfer, prefSlaWarning, setSoundMode, setSoundVoice, updatePreference, testSound, toggleMute,
    markAsRead, markAllRead, clearNotifications, dismissToast, addToast
  ]);
}
