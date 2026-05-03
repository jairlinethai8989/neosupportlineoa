'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  useNotifications,
  AppNotification,
  ToastNotif,
  NotificationSoundMode,
  NotificationVoiceOption,
  SoundTestResult,
  LatestTicketRealtimeEvent,
} from '@/hooks/useNotifications';

export type NotifTab = 'all' | 'unread' | 'sla';

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: ToastNotif[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  dismissToast: (id: string) => void;
  addToast: (toast: ToastNotif) => void;
  agentId: string | null;
  newTicketsCount: number;
  latestTicketRealtimeEvent: LatestTicketRealtimeEvent | null;
  isMuted: boolean;
  soundMode: NotificationSoundMode;
  soundVoice: NotificationVoiceOption;
  setSoundMode: (mode: NotificationSoundMode) => void;
  setSoundVoice: (voice: NotificationVoiceOption) => void;
  testSound: () => Promise<SoundTestResult>;
  toggleMute: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  toasts: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
  clearNotifications: () => {},
  dismissToast: () => {},
  addToast: () => {},
  agentId: null,
  newTicketsCount: 0,
  latestTicketRealtimeEvent: null,
  isMuted: true,
  soundMode: 'beep',
  soundVoice: 'female',
  setSoundMode: () => {},
  setSoundVoice: () => {},
  testSound: async () => ({ ok: false, code: 'NO_AUDIO_CONTEXT', detail: 'Not initialized', hint: '' }),
  toggleMute: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [agentId, setAgentId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setAgentId(data.user?.id ?? null);
    });
  }, []);

  const notif = useNotifications(agentId);

  return (
    <NotificationContext.Provider value={{ ...notif, agentId }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  return useContext(NotificationContext);
}
