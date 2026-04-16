'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  useNotifications,
  AppNotification,
  ToastNotif,
} from '@/hooks/useNotifications';

interface NotificationContextValue {
  notifications: AppNotification[];
  toasts: ToastNotif[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  dismissToast: (id: string) => void;
  addToast: (toast: ToastNotif) => void;
  agentId: string | null;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  toasts: [],
  unreadCount: 0,
  markAsRead: () => {},
  markAllRead: () => {},
  dismissToast: () => {},
  addToast: () => {},
  agentId: null,
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
