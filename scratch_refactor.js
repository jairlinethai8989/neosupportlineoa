const fs = require('fs');
const layoutPath = 'd:/Project APP/AntiGravity/neo_line_oa/src/app/(dashboard)/layout.tsx';
let content = fs.readFileSync(layoutPath, 'utf8');

// Extract TopBar piece
const headerStart = content.indexOf('<header className="top-bar">');
const headerEnd = content.indexOf('</header>') + '</header>'.length;
const headerJSX = content.substring(headerStart, headerEnd);

const topBarContent = `'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext, NotifTab, AppNotification } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
  Menu,
  Languages,
  Bell,
  Volume2,
  VolumeX,
  CheckCheck,
  CheckCircle2,
  LogOut,
  ChevronDown,
  Monitor,
  Moon,
  Sun,
  Palette,
  Ticket,
  AlertCircle,
  MessageSquare,
  System
} from 'lucide-react';
import { TopBarClock } from '@/components/layout/TopBarClock';

const ACTION_ICONS: Record<string, any> = {
  ticket: Ticket,
  sla: AlertCircle,
  sla_warning: AlertCircle,
  message: MessageSquare,
  system: AlertCircle, // Replaced System with AlertCircle since System might not be imported correctly if it's not used originally
};

const ACTION_COLORS: Record<string, string> = {
  ticket: 'var(--primary)',
  sla: 'var(--danger)',
  sla_warning: 'var(--warning)',
  message: 'var(--success)',
  system: 'var(--text-muted)',
};

function timeAgo(dateString: string, t: (key: string) => string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return t('common.timeAgo.justNow');
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return \`\${diffInMinutes} \${t('common.timeAgo.minutesAgo')}\`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return \`\${diffInHours} \${t('common.timeAgo.hoursAgo')}\`;
  const diffInDays = Math.floor(diffInHours / 24);
  return \`\${diffInDays} \${t('common.timeAgo.daysAgo')}\`;
}

interface TopBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
}

export function TopBar({ isSidebarOpen, setIsSidebarOpen, isSidebarCollapsed, setIsSidebarCollapsed }: TopBarProps) {
  const router = useRouter();
  const { userProfile: agent } = useAppContext();
  const { notifications, unreadCount, markAllRead, markAsRead, isMuted, toggleMute } = useNotificationContext();
  const { locale, toggleLocale, t } = useStaffLocale();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('theme') || 'light';
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleNotifClick = (notif: AppNotification) => {
    setShowNotifications(false);
    markAsRead(notif.id);

    if (notif.type === 'sla' || notif.type === 'sla_warning' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(\`/tickets/\${notif.ticketId}\`);
      return;
    }

    if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  const filteredNotifs = notifications.filter((notif) => {
    if (activeTab === 'unread') return !notif.isRead;
    if (activeTab === 'sla') return notif.type === 'sla' || notif.type === 'sla_warning';
    return true;
  });

  return (
    ${headerJSX}
  );
}
\`;

fs.writeFileSync('d:/Project APP/AntiGravity/neo_line_oa/src/components/layout/TopBar.tsx', topBarContent);

// NOW REFACTOR layout.tsx
let newLayoutContent = content.substring(0, headerStart) + '<TopBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed} />' + content.substring(headerEnd);

// Also remove ACTION_ICONS, ACTION_COLORS, timeAgo, and the unused imports if we want, but the priority is to remove useNotificationContext
newLayoutContent = newLayoutContent.replace('import { TopBarClock } from \\'@/components/layout/TopBarClock\\';', 'import { TopBar } from \\'@/components/layout/TopBar\\';\\nimport { TopBarClock } from \\'@/components/layout/TopBarClock\\';');

// Let's remove useNotificationContext from DashboardInner
const contextToRemove = \`  const {
    notifications,
    unreadCount,
    markAllRead,
    markAsRead,
    isMuted,
    toggleMute,
  } = useNotificationContext();\`;
newLayoutContent = newLayoutContent.replace(contextToRemove, '');

// Also remove the states and refs from DashboardInner
const statesToRemove = \`  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('theme') || 'light';
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);\`;
newLayoutContent = newLayoutContent.replace(statesToRemove, '');

const useEffectToRemoveStart = newLayoutContent.indexOf('useEffect(() => {\\n    function handleClick(event: MouseEvent)');
if (useEffectToRemoveStart !== -1) {
  const useEffectToRemoveEnd = newLayoutContent.indexOf('}, []);', useEffectToRemoveStart) + '}, []);'.length;
  newLayoutContent = newLayoutContent.substring(0, useEffectToRemoveStart) + newLayoutContent.substring(useEffectToRemoveEnd);
}

const themeFnToRemoveStart = newLayoutContent.indexOf('const changeTheme = (newTheme: string) => {');
if (themeFnToRemoveStart !== -1) {
  const themeFnToRemoveEnd = newLayoutContent.indexOf('};', themeFnToRemoveStart) + '};'.length;
  newLayoutContent = newLayoutContent.substring(0, themeFnToRemoveStart) + newLayoutContent.substring(themeFnToRemoveEnd);
}

const logoutFnToRemoveStart = newLayoutContent.indexOf('const handleLogout = async () => {');
if (logoutFnToRemoveStart !== -1) {
  const logoutFnToRemoveEnd = newLayoutContent.indexOf('};', logoutFnToRemoveStart) + '};'.length;
  newLayoutContent = newLayoutContent.substring(0, logoutFnToRemoveStart) + newLayoutContent.substring(logoutFnToRemoveEnd);
}

const notifClickToRemoveStart = newLayoutContent.indexOf('const handleNotifClick = (notif: AppNotification) => {');
if (notifClickToRemoveStart !== -1) {
  const notifClickToRemoveEnd = newLayoutContent.indexOf('};', notifClickToRemoveStart) + '};'.length;
  newLayoutContent = newLayoutContent.substring(0, notifClickToRemoveStart) + newLayoutContent.substring(notifClickToRemoveEnd);
}

const filteredNotifsToRemoveStart = newLayoutContent.indexOf('const filteredNotifs = notifications.filter((notif) => {');
if (filteredNotifsToRemoveStart !== -1) {
  const filteredNotifsToRemoveEnd = newLayoutContent.indexOf('});', filteredNotifsToRemoveStart) + '});'.length;
  newLayoutContent = newLayoutContent.substring(0, filteredNotifsToRemoveStart) + newLayoutContent.substring(filteredNotifsToRemoveEnd);
}

fs.writeFileSync(layoutPath, newLayoutContent);
console.log('Refactoring complete');
