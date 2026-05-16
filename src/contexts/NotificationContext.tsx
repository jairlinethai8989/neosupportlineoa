'use client';
import React, { createContext, useContext } from 'react';
import {
  useNotifications,
  AppNotification,
  ToastNotif,
  NotificationSoundMode,
  NotificationVoiceOption,
  SoundTestResult,
  LatestTicketRealtimeEvent,
} from '@/hooks/useNotifications';
import { useStaffLocale } from './StaffLocaleContext';
import { useAppContext } from './AppContext';

export type NotifTab = 'all' | 'unread' | 'sla';

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: ToastNotif[];
  unreadCount: number;
  slaAlertCount: number;
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
  prefNewTicket: boolean;
  prefNewMessage: boolean;
  prefTransfer: boolean;
  prefSlaWarning: boolean;
  setSoundMode: (mode: NotificationSoundMode) => void;
  setSoundVoice: (voice: NotificationVoiceOption) => void;
  updatePreference: (key: string, value: boolean) => void;
  testSound: () => Promise<SoundTestResult>;
  toggleMute: () => void;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  toasts: [],
  unreadCount: 0,
  slaAlertCount: 0,
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
  prefNewTicket: true,
  prefNewMessage: true,
  prefTransfer: true,
  prefSlaWarning: true,
  setSoundMode: () => {},
  setSoundVoice: () => {},
  updatePreference: () => {},
  testSound: async () => ({ ok: false, code: 'NO_AUDIO_CONTEXT', detail: 'Not initialized', hint: '' }),
  toggleMute: () => {},
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { authUserId, userProfile } = useAppContext();
  const fallbackProfileId =
    typeof userProfile?.id === 'string' && userProfile.id !== 'profile-bypass'
      ? userProfile.id
      : null;
  const agentId = authUserId || fallbackProfileId;

  const { locale } = useStaffLocale();
  const role = userProfile?.role || null;
  const notif = useNotifications(agentId, role, locale);

  const value = React.useMemo(() => ({
    ...notif,
    agentId
  }), [notif, agentId]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  return useContext(NotificationContext);
}
