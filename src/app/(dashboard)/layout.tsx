'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import MainSidebar from "@/components/layout/MainSidebar";
import { useRouter } from 'next/navigation';
import {
  Menu,
  X,
  Bell,
  User as UserIcon,
  Zap,
  CheckCheck,
  Ticket,
  ArrowRight,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Volume2,
  VolumeX,
  Languages,
  Palette,
  LogOut,
  ChevronDown,
  Monitor
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NotificationProvider, useNotificationContext } from '@/contexts/NotificationContext';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { StaffLocaleProvider, useStaffLocale } from '@/contexts/StaffLocaleContext';
import ToastContainer from '@/components/notifications/ToastContainer';
import type { AppNotification } from '@/hooks/useNotifications';

// Font Noto Sans Thai is handled by root layout

type NotifTab = 'all' | 'unread' | 'sla';

const ACTION_ICONS: Record<string, any> = {
  'Created': Ticket,
  'Claimed': Zap,
  'Transferred': ArrowRight,
  'Resolved': CheckCheck,
  'Message': MessageSquare,
  'sla': AlertTriangle,
  'sla_warning': Clock,
  'ticket': Ticket,
  'message': MessageSquare,
};

const ACTION_COLORS: Record<string, string> = {
  'ticket': 'var(--primary)',
  'message': 'var(--success)',
};

const THEMES = [
  { id: 'dark', name: 'Dark', thai: 'ธีมเข้ม', color: '#0a0e14', iconColor: '#7367f0' },
  { id: 'light', name: 'Light', thai: 'ธีมสว่าง', color: '#ffffff', iconColor: '#ffcd3c' },
  { id: 'blue', name: 'Blue', thai: 'ธีมฟ้า', color: '#0f172a', iconColor: '#38bdf8' },
  { id: 'cyan', name: 'Cyan', thai: 'ธีมไซแอน', color: '#081a26', iconColor: '#06b6d4' },
  { id: 'gray', name: 'Gray', thai: 'ธีมเทา', color: '#111827', iconColor: '#f3f4f6' },
];

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
}

// Inner layout that can consume NotificationContext
function DashboardInner({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemes, setShowThemes] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark';
    return localStorage.getItem('theme') || 'dark';
  });
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { 
    notifications, 
    unreadCount, 
    markAllRead, 
    markAsRead, 
    isMuted, 
    toggleMute 
  } = useNotificationContext();
  const { locale, toggleLocale } = useStaffLocale();
  const { userProfile: agent, loading: appLoading } = useAppContext();

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
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

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleNotifClick = (notif: AppNotification) => {
    setShowNotifications(false);
    markAsRead(notif.id);

    if (notif.type === 'sla' || notif.type === 'sla_warning' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(`/tickets/${notif.ticketId}`);
    } else if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  // Filtered notifications by tab
  const filteredNotifs: AppNotification[] = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'sla') return n.type === 'sla' || n.type === 'sla_warning';
    return true;
  });

  if (appLoading) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-main)' }}>
        <Loader2 className="animate-spin" color="var(--primary)" size={40} />
      </div>
    );
  }

  return (
    <div className="main-layout">
      {/* Global Toast Portal */}
      <ToastContainer />
      {/* Sidebar Mobile Toggle Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Persistent Sidebar */}
      <div
        className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
        style={{
          width: typeof window !== 'undefined' && window.innerWidth > 1024 
            ? (isSidebarCollapsed ? '80px' : '280px') 
            : '280px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease, left 0.3s ease'
        }}
      >
        <MainSidebar isCollapsed={isSidebarCollapsed} onClickLink={() => setIsSidebarOpen(false)} />
      </div>

      <main className="content-area">
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
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', color: 'var(--text-main)', marginRight: '8px' }}
            >
              <Menu size={20} />
            </button>
            <div className="show-desktop">
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <span>ระบบจัดการอัจฉริยะ</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500' }}>NEO INTELLIGENCE SUITE</span>
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={toggleLocale}
              className="glass-interactive"
              title={locale === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
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

            {/* Audio Notification Toggle */}
            <button
              onClick={toggleMute}
              className="glass-interactive"
              title={isMuted ? "เปิดเสียงแจ้งเตือน" : "ปิดเสียงแจ้งเตือน"}
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
                transition: 'all 0.2s'
              }}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>

            {/* Notification Bell */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                onClick={handleBellClick}
                className="glass-interactive"
                style={{ padding: '8px', borderRadius: '8px', border: 'none', position: 'relative', cursor: 'pointer' }}
              >
                <Bell size={18} color={showNotifications ? 'var(--primary)' : 'var(--text-muted)'} />
                {unreadCount > 0 && (
                  <span style={{
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
                    animation: 'pulse 2s infinite'
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div style={{
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
                }}>

                  {/* Header */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>การแจ้งเตือน</h3>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>สถานะและเหตุการณ์ล่าสุด</p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--primary)', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}
                        >
                          <CheckCheck size={12} />
                          อ่านทั้งหมด
                        </button>
                      )}
                    </div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-input)', borderRadius: '24px', padding: '3px' }}>
                      {(['all', 'unread', 'sla'] as NotifTab[]).map((tab) => (
                        <button
                          key={tab}
                          className={`notif-tab${activeTab === tab ? ' active' : ''}`}
                          onClick={() => setActiveTab(tab)}
                        >
                          {tab === 'all' ? 'ทั้งหมด' : tab === 'unread' ? `ยังไม่อ่าน${unreadCount > 0 ? ` (${unreadCount})` : ''}` : '⚠️ วิกฤต/SLA'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notification List */}
                  <div className="no-scrollbar" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    {filteredNotifs.length === 0 ? (
                      <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                        <Bell size={28} color="var(--text-muted)" style={{ marginBottom: '10px', opacity: 0.3 }} />
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ไม่มีการแจ้งเตือนในหมวดนี้</p>
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
                              background: !notif.isRead ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = !notif.isRead ? 'rgba(var(--primary-rgb), 0.05)' : 'transparent')}
                          >
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--primary-transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <IconComponent size={14} color={iconColor} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                                <p style={{ fontSize: '12px', fontWeight: !notif.isRead ? '700' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {notif.title}
                                </p>
                                {!notif.isRead && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: iconColor }}
                                  >
                                    <CheckCircle2 size={10} />
                                  </button>
                                )}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                {notif.body}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <p style={{ fontSize: '10px', color: 'var(--text-dim)', opacity: 0.6 }}>
                                  {timeAgo(notif.createdAt)}
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
                    cursor: 'pointer'
                 }} 
                 className="glass-interactive"
               >
                 {agent?.avatar_url ? (
                   <img src={agent.avatar_url} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                 ) : (
                   <div style={{
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
                     boxShadow: '0 0 10px rgba(115, 103, 240, 0.4)'
                   }}>{agent?.full_name?.charAt(0) || 'A'}</div>
                 )}
                 <div className="show-desktop" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                   <p style={{ fontSize: '12px', fontWeight: '700' }}>{agent?.full_name || 'Agent'}</p>
                   <ChevronDown size={14} opacity={0.5} />
                 </div>
               </div>

               {showUserMenu && (
                 <div style={{
                   position: 'absolute',
                   top: 'calc(100% + 8px)',
                   right: 0,
                   width: '240px',
                   background: 'var(--bg-card)',
                   border: '1px solid var(--border)',
                   borderRadius: '20px',
                   backdropFilter: 'blur(34px)',
                   boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                   zIndex: 101,
                   padding: '8px',
                   animation: 'fadeIn 0.2s ease-out'
                 }}>
                   <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                      <p style={{ fontSize: '13px', fontWeight: '800' }}>{agent?.full_name}</p>
                      <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase', marginTop: '2px' }}>{agent?.role || 'Agent'}</p>
                   </div>

                   {/* Theme Section */}
                   <div style={{ padding: '8px' }}>
                      <button 
                        onClick={() => setShowThemes(!showThemes)}
                        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '12px', border: 'none', background: 'none', color: 'var(--text-main)', cursor: 'pointer', transition: 'all 0.2s' }}
                        className="hover-item"
                      >
                         <Palette size={16} />
                         <span style={{ fontSize: '12px', fontWeight: '700', flex: 1, textAlign: 'left' }}>สลับธีม (Theme)</span>
                         <div style={{ fontSize: '10px', opacity: 0.5 }}>{showThemes ? '▲' : '▶'}</div>
                      </button>

                      {showThemes && (
                         <div style={{ display: 'flex', gap: '8px', padding: '8px 10px 12px', flexWrap: 'wrap', animation: 'fadeIn 0.2s' }}>
                            {THEMES.map(t => (
                               <button 
                                 key={t.id}
                                 onClick={() => changeTheme(t.id)}
                                 style={{ 
                                   width: '28px', 
                                   height: '28px', 
                                   borderRadius: '50%', 
                                   background: t.color, 
                                   border: theme === t.id ? `2px solid ${t.iconColor}` : '1px solid var(--border)',
                                   cursor: 'pointer',
                                   position: 'relative'
                                 }}
                                 title={t.thai}
                               >
                                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: t.iconColor }} />
                                  {theme === t.id && <div style={{ position: 'absolute', inset: -3, border: `2px solid ${t.iconColor}`, borderRadius: '50%' }} />}
                               </button>
                            ))}
                         </div>
                      )}
                   </div>

                   <button 
                      onClick={handleLogout}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '12px', border: 'none', background: 'rgba(234, 84, 85, 0.05)', color: 'var(--danger)', cursor: 'pointer', marginTop: '4px' }}
                      className="glass-interactive"
                   >
                      <LogOut size={16} />
                      <span style={{ fontSize: '12px', fontWeight: '800' }}>ออกจากระบบ</span>
                   </button>
                 </div>
               )}
            </div>
          </div>
        </header>

        <div style={{ 
          flex: 1, 
          padding: '24px', 
          overflowX: 'hidden', 
          overflowY: 'auto', 
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        :root {
          --primary-rgb: 59, 130, 246;
        }
        .hover-item:hover {
          background: rgba(255,255,255,0.05) !important;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .sidebar.collapsed {
          width: 80px !important;
        }
        @media (max-width: 1024px) {
           .show-desktop { display: none !important; }
        }
      `}} />
    </div>
  );
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProvider>
      <StaffLocaleProvider>
        <NotificationProvider>
          <DashboardInner>{children}</DashboardInner>
        </NotificationProvider>
      </StaffLocaleProvider>
    </AppProvider>
  );
}
