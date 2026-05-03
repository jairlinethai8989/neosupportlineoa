'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import type { AppNotification } from '@/hooks/useNotifications';
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
  MessageSquare
} from 'lucide-react';
import { TopBarClock } from '@/components/layout/TopBarClock';

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  ticket: Ticket,
  sla: AlertCircle,
  sla_warning: AlertCircle,
  message: MessageSquare,
  system: AlertCircle,
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
  if (diffInMinutes < 60) return `${diffInMinutes} ${t('common.timeAgo.minutesAgo')}`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} ${t('common.timeAgo.hoursAgo')}`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays} ${t('common.timeAgo.daysAgo')}`;
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
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('theme') || 'light';
  });

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
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
      router.push(`/tickets/${notif.ticketId}`);
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
    <header className="top-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={() => {
            if (window.innerWidth > 1024) {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            } else {
              setIsSidebarOpen(!isSidebarOpen);
            }
          }}
          className="glass-interactive flex-center"
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            display: 'flex',
            color: 'var(--text-main)',
            marginRight: '8px',
          }}
        >
          <Menu size={20} />
        </button>

        <div className="show-desktop">
          <h2
            style={{
              fontSize: '18px',
              fontWeight: '800',
              display: 'flex',
              flexDirection: 'column',
              lineHeight: '1.2',
            }}
          >
            <span>{t('dashboard.title')}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500' }}>
              {t('dashboard.subtitle')}
            </span>
          </h2>
        </div>
      </div>

      <div className="show-desktop" style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 16px' }}>
        <TopBarClock locale={locale} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={toggleLocale}
          className="glass-interactive"
          title={locale === 'th' ? t('dashboard.switchToEnglish') : t('dashboard.switchToThai')}
          style={{
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-main)',
            background: 'transparent',
            fontWeight: '800',
            fontSize: '11px',
          }}
        >
          <Languages size={16} />
          <span>{locale.toUpperCase()}</span>
        </button>

        <button
          onClick={toggleMute}
          className="glass-interactive"
          title={isMuted ? t('dashboard.unmuteNotifications') : t('dashboard.muteNotifications')}
          style={{
            padding: '8px',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isMuted ? 'var(--text-muted)' : 'var(--primary)',
            background: isMuted ? 'transparent' : 'var(--primary-transparent)',
            transition: 'all 0.2s',
          }}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="glass-interactive"
            style={{ padding: '8px', borderRadius: '8px', border: 'none', position: 'relative', cursor: 'pointer' }}
          >
            <Bell size={18} color={showNotifications ? 'var(--primary)' : 'var(--text-muted)'} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  minWidth: '16px',
                  height: '16px',
                  background: 'var(--danger)',
                  borderRadius: '10px',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                  animation: 'pulse 2s infinite',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '380px',
                maxHeight: '480px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                backdropFilter: 'blur(34px)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--border)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out',
              }}
            >
              <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>
                      {t('dashboard.notificationsTitle')}
                    </h3>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                      {t('dashboard.notificationsSubtitle')}
                    </p>
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--primary)',
                        fontWeight: '600',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0.8,
                      }}
                    >
                      <CheckCheck size={12} />
                      {t('dashboard.markAllRead')}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', borderRadius: '24px', padding: '3px' }}>
                  {(['all', 'unread', 'sla'] as const).map((tab) => (
                    <button
                      key={tab}
                      className={`notif-tab${activeTab === tab ? ' active' : ''}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab === 'all'
                        ? t('dashboard.tabs.all')
                        : tab === 'unread'
                          ? `${t('dashboard.tabs.unread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`
                          : `⚠️ ${t('dashboard.tabs.sla')}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="no-scrollbar" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {filteredNotifs.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <Bell size={28} color="var(--text-muted)" style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      {t('dashboard.noNotifications')}
                    </p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => {
                    const IconComponent = ACTION_ICONS[notif.type] || Ticket;
                    const iconColor = ACTION_COLORS[notif.type] || 'var(--primary)';

                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleNotifClick(notif)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          display: 'flex',
                          gap: '12px',
                          alignItems: 'flex-start',
                          background: !notif.isRead ? 'var(--primary-transparent)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          position: 'relative',
                        }}
                        onMouseEnter={(event) => {
                          event.currentTarget.style.background = 'var(--bg-card-hover)';
                        }}
                        onMouseLeave={(event) => {
                          event.currentTarget.style.background = !notif.isRead
                            ? 'var(--primary-transparent)'
                            : 'transparent';
                        }}
                      >
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '10px',
                            background: 'var(--primary-transparent)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <IconComponent size={14} color={iconColor} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                            <p
                              style={{
                                fontSize: '12px',
                                fontWeight: !notif.isRead ? '700' : '400',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {notif.title}
                            </p>
                            {!notif.isRead && (
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  markAsRead(notif.id);
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  background: 'var(--bg-input)',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  cursor: 'pointer',
                                  color: iconColor,
                                }}
                              >
                                <CheckCircle2 size={10} />
                              </button>
                            )}
                          </div>
                          <p
                            style={{
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                            }}
                          >
                            {notif.body}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-dim)', opacity: 0.6 }}>
                              {timeAgo(notif.createdAt, t)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={userMenuRef} style={{ position: 'relative' }}>
          <div
            onClick={() => setShowUserMenu(!showUserMenu)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginLeft: '8px',
              padding: '4px 12px 4px 4px',
              borderRadius: '30px',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
            className="glass-interactive"
          >
            {agent?.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt="User avatar"
                style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  background: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '11px',
                  color: 'white',
                  boxShadow: '0 0 10px rgba(115, 103, 240, 0.4)',
                }}
              >
                {agent?.full_name?.charAt(0) || 'A'}
              </div>
            )}
            <div className="show-desktop" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ fontSize: '12px', fontWeight: '700' }}>{agent?.full_name || t('dashboard.agentFallback')}</p>
              <ChevronDown size={14} opacity={0.5} />
            </div>
          </div>

          {showUserMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                width: '260px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: '16px',
                backdropFilter: 'blur(34px)',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                zIndex: 100,
                overflow: 'hidden',
                animation: 'fadeIn 0.2s ease-out',
                padding: '8px',
              }}
            >
              <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-main)' }}>
                  {agent?.full_name}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {agent?.role || 'Staff'}
                </p>
              </div>

              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowThemes(!showThemes)}
                  className="glass-interactive"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Palette size={16} color="var(--primary)" />
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{t('dashboard.theme')}</span>
                  </div>
                  <ChevronDown size={14} style={{ transform: showThemes ? 'rotate(180deg)' : 'none', transition: '0.2s' }} />
                </button>

                {showThemes && (
                  <div style={{ padding: '8px', background: 'var(--bg-input)', borderRadius: '12px', margin: '4px 8px' }}>
                    <button
                      onClick={() => changeTheme('light')}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                        background: theme === 'light' ? 'var(--bg-card)' : 'transparent',
                        border: '1px solid', borderColor: theme === 'light' ? 'var(--border)' : 'transparent',
                        borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)'
                      }}
                    >
                      <Sun size={14} /> <span style={{ fontSize: '12px' }}>Light</span>
                    </button>
                    <button
                      onClick={() => changeTheme('dark')}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                        background: theme === 'dark' ? 'var(--bg-card)' : 'transparent',
                        border: '1px solid', borderColor: theme === 'dark' ? 'var(--border)' : 'transparent',
                        borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)'
                      }}
                    >
                      <Moon size={14} /> <span style={{ fontSize: '12px' }}>Dark</span>
                    </button>
                    <button
                      onClick={() => changeTheme('system')}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px',
                        background: theme === 'system' ? 'var(--bg-card)' : 'transparent',
                        border: '1px solid', borderColor: theme === 'system' ? 'var(--border)' : 'transparent',
                        borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)'
                      }}
                    >
                      <Monitor size={14} /> <span style={{ fontSize: '12px' }}>System</span>
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                <button
                  onClick={handleLogout}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    color: 'var(--danger)',
                    cursor: 'pointer',
                    marginTop: '4px',
                  }}
                  className="glass-interactive"
                >
                  <LogOut size={16} />
                  <span style={{ fontSize: '12px', fontWeight: '800' }}>{t('dashboard.logout')}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
