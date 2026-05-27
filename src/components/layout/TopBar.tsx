'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import type { UserProfile } from '@/contexts/AppContext';
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
  const { userProfile: agent, updateStatus, companySettings } = useAppContext();
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

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [onlineStaff, setOnlineStaff] = useState<UserProfile[]>([]);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAllProfiles = async () => {
      try {
        const { data, error } = await supabase.from('profiles').select('*');
        if (error) throw error;
        if (data) setProfiles(data);
      } catch (err) {
        console.error('Failed to load profiles:', err);
      }
    };

    void fetchAllProfiles();

    const channelId = `profiles-presence-${Date.now()}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setProfiles(prev => [...prev, payload.new]);
        } else if (payload.eventType === 'UPDATE') {
          setProfiles(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p));
        } else if (payload.eventType === 'DELETE') {
          setProfiles(prev => prev.filter(p => p.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  // Synchronize local agent's status/last_seen updates instantly into profiles state
  useEffect(() => {
    if (agent?.id) {
      setProfiles(prev => {
        const exists = prev.some(p => p.id === agent.id);
        if (exists) {
          return prev.map(p => p.id === agent.id ? { ...p, status: agent.status, last_seen: agent.last_seen } : p);
        } else {
          return [...prev, agent];
        }
      });
    }
  }, [agent]);

  useEffect(() => {
    const filterOnline = () => {
      const thresholdMinutes = companySettings?.active_threshold_minutes || 15;
      const now = new Date();
      const filtered = profiles
        .map(p => {
          if (agent && p.id === agent.id) {
            return { ...p, status: agent.status, last_seen: agent.last_seen };
          }
          return p;
        })
        .filter(p => {
          if (!p.last_seen) return false;
          const lastSeenDate = new Date(p.last_seen);
          const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 60000;
          return diffMinutes <= thresholdMinutes;
        });

      filtered.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (a.status !== 'Active' && b.status === 'Active') return 1;
        return (a.full_name || '').localeCompare(b.full_name || '');
      });

      setOnlineStaff(filtered);
    };

    filterOnline();
    const filterInterval = setInterval(filterOnline, 30000);
    return () => clearInterval(filterInterval);
  }, [profiles, companySettings, agent]);

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
        <style>{`
          .avatar-bubble {
            transition: all 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          }
          .avatar-bubble:hover {
            transform: scale(1.15) translateY(-2px);
            z-index: 50 !important;
            box-shadow: 0 8px 20px rgba(0,0,0,0.4);
          }
          .avatar-bubble:hover .tooltip-presence {
            opacity: 1 !important;
            transform: translateX(-50%) translateY(0) scale(1) !important;
            pointer-events: auto !important;
          }
        `}</style>

        {/* Overlapping Online Staff indicators */}
        {onlineStaff.length > 0 && (
          <div className="show-desktop" style={{ display: 'flex', alignItems: 'center', marginRight: '16px', gap: '8px' }}>
            <span style={{ fontSize: '10px', fontWeight: '850', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('dashboard.onlineStaff')}:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
              {onlineStaff.slice(0, 4).map((p, idx) => (
                <div 
                  key={p.id} 
                  className="avatar-bubble"
                  style={{ 
                    position: 'relative', 
                    zIndex: 10 - idx,
                    cursor: 'default'
                  }}
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img 
                      src={p.avatar_url} 
                      alt={p.full_name || ''} 
                      style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        border: '2px solid rgba(10, 14, 20, 0.8)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        objectFit: 'cover'
                      }} 
                    />
                  ) : (
                    <div 
                      style={{ 
                        width: '30px', 
                        height: '30px', 
                        borderRadius: '50%', 
                        border: '2px solid rgba(10, 14, 20, 0.8)',
                        background: p.status === 'Active' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(115, 103, 240, 0.1)',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                        color: 'var(--text-main)',
                        fontWeight: '800',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      {(p.full_name || 'A').charAt(0)}
                    </div>
                  )}
                  {/* Status indicator dot */}
                  <span 
                    style={{ 
                      position: 'absolute', 
                      bottom: '0px', 
                      right: '0px', 
                      width: '9px', 
                      height: '9px', 
                      borderRadius: '50%', 
                      border: '1.5px solid rgba(10, 14, 20, 0.9)',
                      background: p.status === 'Active' ? '#00E676' : '#FF9100', // Neon Green vs Neon Orange
                      boxShadow: p.status === 'Active' ? '0 0 6px #00E676' : '0 0 6px #FF9100'
                    }}
                  />
                  
                  {/* High-quality Glassmorphic Tooltip */}
                  <div 
                    className="tooltip-presence"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%) translateY(-4px) scale(0.95)',
                      background: 'rgba(10, 14, 20, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      opacity: 0,
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#ffffff' }}>{p.full_name}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>{p.department || t('dashboard.agentFallback')}</span>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: '700', 
                      color: p.status === 'Active' ? '#00E676' : '#FF9100',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.status === 'Active' ? '#00E676' : '#FF9100' }} />
                      {p.status === 'Active' ? t('dashboard.statusActive') : t('dashboard.statusBusy')}
                    </span>
                  </div>
                </div>
              ))}
              
              {/* Overlapping Count badge */}
              {onlineStaff.length > 4 && (
                <div 
                  className="avatar-bubble group"
                  style={{ 
                    width: '30px', 
                    height: '30px', 
                    borderRadius: '50%', 
                    border: '2px solid rgba(10, 14, 20, 0.8)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(12px)',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    zIndex: 5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: '900',
                    color: 'var(--primary)',
                    cursor: 'default'
                  }}
                  title={onlineStaff.slice(4).map(p => p.full_name).join(', ')}
                >
                  +{onlineStaff.length - 4}
                  
                  {/* Tooltip for the +N badge showing other online employees */}
                  <div 
                    className="tooltip-presence"
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 10px)',
                      left: '50%',
                      transform: 'translateX(-50%) translateY(4px) scale(0.95)',
                      background: 'rgba(10, 14, 20, 0.9)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      opacity: 0,
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}
                  >
                    {onlineStaff.slice(4).map(p => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: p.status === 'Active' ? '#00E676' : '#FF9100' }} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-main)' }}>{p.full_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

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
                              color: 'var(--text-main)',
                              opacity: 0.7,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              marginTop: '2px',
                            }}
                          >
                            {notif.body}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                            <p style={{ fontSize: '10px', color: 'var(--text-main)', opacity: 0.5, fontWeight: '600' }}>
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
            <div style={{ position: 'relative' }}>
              {agent?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
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
              {/* Status indicator dot */}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-1px',
                  right: '-1px',
                  width: '9px',
                  height: '9px',
                  borderRadius: '50%',
                  border: '1.5px solid rgba(10, 14, 20, 0.9)',
                  background: agent?.status === 'Active' ? '#00E676' : agent?.status === 'Busy' ? '#FF9100' : 'var(--text-muted)',
                  boxShadow: agent?.status === 'Active' ? '0 0 6px #00E676' : agent?.status === 'Busy' ? '0 0 6px #FF9100' : 'none',
                }}
              />
            </div>
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

              {/* Active / Busy Status Switcher */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', marginBottom: '8px' }}>
                <p style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                  {t('dashboard.myStatus')}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => void updateStatus('Active')}
                    className="glass-interactive"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: agent?.status === 'Active' ? 'rgba(0, 230, 118, 0.15)' : 'transparent',
                      border: '1px solid',
                      borderColor: agent?.status === 'Active' ? '#00E676' : 'var(--border)',
                      color: agent?.status === 'Active' ? '#00E676' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 6px #00E676' }} />
                    <span>{t('dashboard.statusActive')}</span>
                  </button>
                  <button
                    onClick={() => void updateStatus('Busy')}
                    className="glass-interactive"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: agent?.status === 'Busy' ? 'rgba(255, 145, 0, 0.15)' : 'transparent',
                      border: '1px solid',
                      borderColor: agent?.status === 'Busy' ? '#FF9100' : 'var(--border)',
                      color: agent?.status === 'Busy' ? '#FF9100' : 'var(--text-main)',
                      fontSize: '11px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF9100', boxShadow: '0 0 6px #FF9100' }} />
                    <span>{t('dashboard.statusBusy')}</span>
                  </button>
                </div>
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
