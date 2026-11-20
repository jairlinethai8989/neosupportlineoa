'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Languages,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Search,
  Sun,
  Ticket,
  UserCog,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { AppNotification } from '@/hooks/useNotifications';

type ThemeMode = 'light' | 'dark';

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string; 'aria-hidden'?: boolean }>> = {
  ticket: Ticket,
  sla: AlertCircle,
  sla_warning: AlertCircle,
  message: MessageSquare,
  system: AlertCircle,
};

const ACTION_COLORS: Record<string, string> = {
  ticket: 'var(--color-primary)',
  sla: 'var(--color-danger)',
  sla_warning: 'var(--color-warning)',
  message: 'var(--color-success)',
  system: 'var(--color-text-muted)',
};

function migrateLegacyTheme(raw: string | null): ThemeMode {
  if (raw === 'dark' || raw === 'blue' || raw === 'cyan' || raw === 'gray') {
    return 'dark';
  }
  if (raw === 'system' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function timeAgo(dateString: string, t: (key: string) => string): string {
  if (!dateString) return '';
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return t('dashboard.justNow');
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes} ${t('dashboard.minutesAgo')}`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ${t('dashboard.hoursAgo')}`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} ${t('dashboard.daysAgo')}`;
}

export interface TopBarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean) => void;
  onOpenCommandPalette?: () => void;
}

function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('neo-theme-change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('neo-theme-change', callback);
  };
}

function getThemeSnapshot(): ThemeMode {
  const raw = window.localStorage.getItem('theme');
  return migrateLegacyTheme(raw);
}

function getServerThemeSnapshot(): ThemeMode {
  return 'light';
}

export function TopBar({
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  onOpenCommandPalette,
}: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile: agent, activeProject, updateStatus, logout } = useAppContext();
  const { notifications, unreadCount, markAllRead, markAsRead, isMuted, toggleMute } = useNotificationContext();
  const { locale, toggleLocale, t } = useStaffLocale();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Migrate legacy theme values (blue / cyan / gray -> dark) and sync DOM attribute
  useEffect(() => {
    const raw = window.localStorage.getItem('theme');
    const migrated = migrateLegacyTheme(raw);
    if (raw !== migrated) {
      window.localStorage.setItem('theme', migrated);
      window.dispatchEvent(new Event('neo-theme-change'));
    }
    document.documentElement.setAttribute('data-theme', migrated);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = theme === 'light' ? 'dark' : 'light';
    window.localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
    window.dispatchEvent(new Event('neo-theme-change'));
  };

  const handleNotifClick = (notif: AppNotification) => {
    setShowNotifications(false);
    markAsRead(notif.id);
    if (notif.type === 'sla' || notif.type === 'sla_warning' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(`/tickets/${notif.ticketId}`);
      return;
    }
    if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  const filteredNotifs = useMemo(
    () =>
      notifications.filter((notif) => {
        if (activeTab === 'unread') return !notif.isRead;
        if (activeTab === 'sla') return notif.type === 'sla' || notif.type === 'sla_warning';
        return true;
      }),
    [activeTab, notifications]
  );

  const breadcrumb = useMemo<{ group?: string; label: string }>(() => {
    const segmentMap: Array<{ match: (p: string) => boolean; group?: string; label: string }> = [
      { match: (p) => p === '/', label: t('sidebar.menu.overview') },
      { match: (p) => p.startsWith('/inbox'), group: t('sidebar.sections.operations'), label: t('sidebar.menu.inbox') },
      { match: (p) => p === '/tickets/new', group: t('sidebar.menu.tickets'), label: t('sidebar.createTicket') },
      {
        match: (p) => p.startsWith('/tickets/'),
        group: t('sidebar.menu.tickets'),
        label: locale === 'th' ? 'รายละเอียดใบงาน' : 'Ticket Detail',
      },
      { match: (p) => p.startsWith('/tickets'), group: t('sidebar.sections.operations'), label: t('sidebar.menu.tickets') },
      {
        match: (p) => p.startsWith('/notifications'),
        group: t('sidebar.sections.operations'),
        label: t('sidebar.menu.notifications'),
      },
      {
        match: (p) => p.startsWith('/analytics/personal'),
        group: t('sidebar.menu.performance'),
        label: t('sidebar.menu.personalPerformance'),
      },
      {
        match: (p) => p.startsWith('/analytics/staff/evaluation-360'),
        group: t('sidebar.menu.staffPerformance'),
        label: 'Evaluation 360',
      },
      {
        match: (p) => p.startsWith('/analytics/staff'),
        group: t('sidebar.menu.performance'),
        label: t('sidebar.menu.staffPerformance'),
      },
      {
        match: (p) => p.startsWith('/analytics/insights'),
        group: t('sidebar.menu.performance'),
        label: locale === 'th' ? 'เชิงลึก' : 'Insights',
      },
      { match: (p) => p.startsWith('/analytics'), group: t('sidebar.sections.intelligence'), label: t('sidebar.menu.performance') },
      { match: (p) => p.startsWith('/reports/daily'), group: t('sidebar.menu.reports'), label: t('sidebar.menu.dailyReport') },
      {
        match: (p) => p.startsWith('/reports/presentation'),
        group: t('sidebar.menu.reports'),
        label: locale === 'th' ? 'พรีเซนเทชัน' : 'Presentation',
      },
      { match: (p) => p.startsWith('/reports'), group: t('sidebar.sections.intelligence'), label: t('sidebar.menu.reportHub') },
      { match: (p) => p.startsWith('/customers'), group: t('sidebar.sections.intelligence'), label: t('sidebar.menu.customers') },
      { match: (p) => p.startsWith('/settings/profile'), group: t('sidebar.menu.settingsPersonal'), label: t('sidebar.menu.profile') },
      {
        match: (p) => p.startsWith('/settings/notifications'),
        group: t('sidebar.menu.settingsPersonal'),
        label: t('sidebar.menu.notificationSettings'),
      },
      { match: (p) => p.startsWith('/settings/projects'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.projects') },
      { match: (p) => p.startsWith('/settings/branding'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.branding') },
      { match: (p) => p.startsWith('/settings/staff'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.staff') },
      { match: (p) => p.startsWith('/settings/sla'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.sla') },
      { match: (p) => p.startsWith('/settings/master'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.master') },
      { match: (p) => p.startsWith('/settings/audit'), group: t('sidebar.menu.settingsSystem'), label: t('sidebar.menu.audit') },
    ];
    return segmentMap.find((entry) => entry.match(pathname)) || { label: 'Neo Support' };
  }, [locale, pathname, t]);

  const iconBtnStyle: React.CSSProperties = {
    height: '32px',
    minWidth: '32px',
    padding: '0 8px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-muted)',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: 'var(--text-xs)',
    fontWeight: 600,
    transition: 'var(--transition-colors)',
  };

  const isOnline = agent?.status === 'Active';

  return (
    <header className="top-bar">
      {/* Left: Menu Toggle + Dynamic Page Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
        <button
          type="button"
          onClick={() => {
            if (window.innerWidth > 1024) {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            } else {
              setIsSidebarOpen(!isSidebarOpen);
            }
          }}
          aria-label={locale === 'th' ? 'สลับเมนูด้านข้าง' : 'Toggle navigation menu'}
          aria-expanded={isSidebarOpen}
          style={iconBtnStyle}
        >
          <Menu size={16} aria-hidden="true" />
        </button>

        <nav aria-label={locale === 'th' ? 'ตำแหน่งหน้าปัจจุบัน' : 'Breadcrumb'} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {breadcrumb.group && (
            <>
              <span className="hidden-mobile truncate" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                {breadcrumb.group}
              </span>
              <ChevronRight size={13} className="hidden-mobile" color="var(--color-text-subtle)" aria-hidden="true" />
            </>
          )}
          <span className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>
            {breadcrumb.label}
          </span>
          {activeProject && (
            <span
              className="hidden-mobile mono"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                marginLeft: '4px',
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-subtle)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--color-text-muted)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 'var(--radius-full)',
                  background: activeProject.primary_color || 'var(--color-primary)',
                }}
              />
              {activeProject.code}
            </span>
          )}
        </nav>
      </div>

      {/* Center/Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {/* Cmd+K Command Palette Trigger */}
        <button
          type="button"
          onClick={() => onOpenCommandPalette?.()}
          aria-label={locale === 'th' ? 'เปิดคำสั่งด่วน (Cmd+K)' : 'Open command palette (Cmd+K)'}
          style={{
            height: '32px',
            padding: '0 10px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-subtle)',
            color: 'var(--color-text-muted)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: 'var(--text-xs)',
            transition: 'var(--transition-colors)',
          }}
        >
          <Search size={14} aria-hidden="true" />
          <span className="hidden-mobile">
            {locale === 'th' ? 'ค้นหา / ข้ามหน้า...' : 'Search or jump...'}
          </span>
          <kbd
            className="hidden-mobile mono"
            style={{
              padding: '1px 5px',
              borderRadius: '4px',
              border: '1px solid var(--color-border-strong)',
              background: 'var(--color-surface)',
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--color-text-muted)',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Locale TH/EN Toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          title={locale === 'th' ? t('dashboard.switchToEnglish') : t('dashboard.switchToThai')}
          aria-label={locale === 'th' ? t('dashboard.switchToEnglish') : t('dashboard.switchToThai')}
          style={iconBtnStyle}
        >
          <Languages size={15} aria-hidden="true" />
          <span className="mono">{locale.toUpperCase()}</span>
        </button>

        {/* 2-Theme Daylight / Night Shift Toggle */}
        <button
          type="button"
          onClick={toggleTheme}
          title={
            theme === 'light'
              ? locale === 'th'
                ? 'สลับเป็นโหมดมืด (Night Shift)'
                : 'Switch to Night Shift Dark'
              : locale === 'th'
                ? 'สลับเป็นโหมดสว่าง (Daylight)'
                : 'Switch to Daylight Light'
          }
          aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
          aria-pressed={theme === 'dark'}
          style={iconBtnStyle}
        >
          {theme === 'light' ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
        </button>

        {/* Sound Mute Toggle */}
        <button
          type="button"
          onClick={toggleMute}
          title={isMuted ? t('dashboard.unmuteNotifications') : t('dashboard.muteNotifications')}
          aria-label={isMuted ? t('dashboard.unmuteNotifications') : t('dashboard.muteNotifications')}
          aria-pressed={!isMuted}
          style={{
            ...iconBtnStyle,
            color: isMuted ? 'var(--color-text-muted)' : 'var(--color-primary)',
            background: isMuted ? 'var(--color-surface)' : 'var(--color-primary-soft)',
            borderColor: isMuted ? 'var(--color-border)' : 'transparent',
          }}
        >
          {isMuted ? <VolumeX size={15} aria-hidden="true" /> : <Volume2 size={15} aria-hidden="true" />}
        </button>

        {/* Notifications Bell + Popover */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((prev) => !prev);
              setShowUserMenu(false);
            }}
            aria-label={t('dashboard.notificationsTitle')}
            aria-expanded={showNotifications}
            aria-haspopup="dialog"
            style={{
              ...iconBtnStyle,
              position: 'relative',
              color: showNotifications ? 'var(--color-primary)' : 'var(--color-text-muted)',
            }}
          >
            <Bell size={15} aria-hidden="true" />
            {unreadCount > 0 && (
              <span
                className="tabular-nums"
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: '16px',
                  height: '16px',
                  background: 'var(--color-danger)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '10px',
                  fontWeight: 700,
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  border: '2px solid var(--color-surface)',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              role="dialog"
              aria-label={t('dashboard.notificationsTitle')}
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: 'min(360px, calc(100vw - 24px))',
                maxHeight: '460px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 'var(--z-popover)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('dashboard.notificationsTitle')}
                    </h3>
                    <p style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {t('dashboard.notificationsSubtitle')}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--color-primary)',
                        fontWeight: 600,
                        background: 'transparent',
                        border: 'none',
                      }}
                    >
                      <CheckCheck size={13} aria-hidden="true" />
                      {t('dashboard.markAllRead')}
                    </button>
                  )}
                </div>

                <div
                  role="tablist"
                  style={{
                    display: 'flex',
                    gap: '4px',
                    background: 'var(--color-surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '3px',
                  }}
                >
                  {(['all', 'unread', 'sla'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`notif-tab${activeTab === tab ? ' active' : ''}`}
                      style={{ flex: 1, borderRadius: 'var(--radius-sm)' }}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === 'all'
                        ? t('dashboard.tabs.all')
                        : tab === 'unread'
                          ? `${t('dashboard.tabs.unread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                          : t('dashboard.tabs.sla')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="no-scrollbar" style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {filteredNotifs.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <Bell size={24} color="var(--color-text-subtle)" style={{ marginBottom: '8px' }} aria-hidden="true" />
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                      {t('dashboard.noNotifications')}
                    </p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => {
                    const IconComponent = ACTION_ICONS[notif.type] || Ticket;
                    const iconColor = ACTION_COLORS[notif.type] || 'var(--color-primary)';

                    return (
                      <div
                        key={notif.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          borderBottom: '1px solid var(--color-border)',
                          background: !notif.isRead ? 'var(--color-primary-soft)' : 'transparent',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => handleNotifClick(notif)}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            padding: '10px 14px',
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            background: 'transparent',
                            border: 'none',
                            textAlign: 'left',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--color-surface-subtle)',
                              border: '1px solid var(--color-border)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <IconComponent size={14} color={iconColor} aria-hidden={true} />
                          </span>
                          <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
                            <span
                              className="truncate"
                              style={{
                                display: 'block',
                                fontSize: 'var(--text-xs)',
                                fontWeight: !notif.isRead ? 700 : 500,
                                color: 'var(--color-text)',
                              }}
                            >
                              {notif.title}
                            </span>
                            <span
                              className="truncate"
                              style={{
                                display: 'block',
                                fontSize: '12px',
                                color: 'var(--color-text-muted)',
                                marginTop: '2px',
                              }}
                            >
                              {notif.body}
                            </span>
                            <span
                              style={{
                                display: 'block',
                                fontSize: '11px',
                                color: 'var(--color-text-subtle)',
                                marginTop: '3px',
                              }}
                            >
                              {timeAgo(notif.createdAt, t)}
                            </span>
                          </span>
                        </button>

                        {!notif.isRead && (
                          <button
                            type="button"
                            onClick={() => markAsRead(notif.id)}
                            aria-label={locale === 'th' ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'Mark as read'}
                            title={locale === 'th' ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'Mark as read'}
                            style={{
                              width: 28,
                              height: 28,
                              marginRight: '10px',
                              borderRadius: 'var(--radius-full)',
                              background: 'var(--color-surface)',
                              border: '1px solid var(--color-border)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: iconColor,
                              flexShrink: 0,
                            }}
                          >
                            <CheckCircle2 size={12} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile / Status / Logout Menu */}
        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => {
              setShowUserMenu((prev) => !prev);
              setShowNotifications(false);
            }}
            aria-expanded={showUserMenu}
            aria-haspopup="menu"
            aria-label={agent?.full_name || t('dashboard.agentFallback')}
            style={{
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 8px 0 4px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              transition: 'var(--transition-colors)',
            }}
          >
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              {agent?.avatar_url ? (
                <img
                  src={agent.avatar_url}
                  alt=""
                  style={{ width: 24, height: 24, borderRadius: 'var(--radius-full)', objectFit: 'cover' }}
                />
              ) : (
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--color-primary-solid)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '11px',
                    color: 'var(--color-on-primary)',
                  }}
                >
                  {agent?.full_name?.charAt(0) || 'A'}
                </span>
              )}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  bottom: -1,
                  right: -1,
                  width: 8,
                  height: 8,
                  borderRadius: 'var(--radius-full)',
                  border: '1.5px solid var(--color-surface)',
                  background: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
                }}
              />
            </span>
            <span className="hidden-mobile truncate" style={{ maxWidth: '120px', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              {agent?.full_name || t('dashboard.agentFallback')}
            </span>
            <ChevronDown size={13} color="var(--color-text-muted)" aria-hidden="true" />
          </button>

          {showUserMenu && (
            <div
              role="menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '240px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 'var(--z-popover)',
                padding: '8px',
              }}
            >
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--color-border)' }}>
                <p className="truncate" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                  {agent?.full_name || t('dashboard.agentFallback')}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {agent?.role || 'Staff'}
                </p>
              </div>

              <div style={{ padding: '10px 8px', borderBottom: '1px solid var(--color-border)' }}>
                <p
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: 'var(--color-text-subtle)',
                    textTransform: 'uppercase',
                    marginBottom: '6px',
                  }}
                >
                  {t('dashboard.myStatus')}
                </p>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => void updateStatus('Active')}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: 'var(--radius-md)',
                      background: isOnline ? 'var(--color-success-soft)' : 'transparent',
                      border: '1px solid',
                      borderColor: isOnline ? 'var(--color-success-border)' : 'var(--color-border)',
                      color: isOnline ? 'var(--color-success-text)' : 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-success)' }} />
                    {t('dashboard.statusActive')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void updateStatus('Busy')}
                    style={{
                      flex: 1,
                      height: '32px',
                      borderRadius: 'var(--radius-md)',
                      background: agent?.status === 'Busy' ? 'var(--color-warning-soft)' : 'transparent',
                      border: '1px solid',
                      borderColor: agent?.status === 'Busy' ? 'var(--color-warning-border)' : 'var(--color-border)',
                      color: agent?.status === 'Busy' ? 'var(--color-warning-text)' : 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 'var(--radius-full)', background: 'var(--color-warning)' }} />
                    {t('dashboard.statusBusy')}
                  </button>
                </div>
              </div>

              <div style={{ paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <Link
                  href="/settings/profile"
                  role="menuitem"
                  onClick={() => setShowUserMenu(false)}
                  style={{
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    textDecoration: 'none',
                  }}
                >
                  <UserCog size={14} color="var(--color-text-muted)" aria-hidden="true" />
                  <span>{t('sidebar.menu.profile')}</span>
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void logout()}
                  style={{
                    width: '100%',
                    height: '34px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0 10px',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-danger-text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    textAlign: 'left',
                  }}
                >
                  <LogOut size={14} aria-hidden="true" />
                  <span>{t('dashboard.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
