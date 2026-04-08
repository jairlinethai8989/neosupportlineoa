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
  CheckCircle2
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { NotificationProvider, useNotificationContext } from '@/contexts/NotificationContext';
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
  'ticket': Ticket,
  'message': MessageSquare,
};

const ACTION_COLORS: Record<string, string> = {
  'Created': '#00f2fe',
  'Claimed': '#ff9f43',
  'Transferred': '#7367f0',
  'Resolved': '#28c76f',
  'Message': '#4facfe',
  'sla': '#ff9f43',
  'ticket': '#00f2fe',
  'message': '#28c76f',
};

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
  const [agent, setAgent] = useState<any>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeTab, setActiveTab] = useState<NotifTab>('all');
  const notifRef = useRef<HTMLDivElement>(null);

  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markAsRead } = useNotificationContext();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (data.user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
        setAgent(p || data.user);
      }
    });
  }, []);

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    if (showNotifications) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showNotifications]);

  const handleBellClick = () => {
    setShowNotifications(!showNotifications);
  };

  const handleNotifClick = (notif: AppNotification) => {
    setShowNotifications(false);
    markAsRead(notif.id);

    if (notif.type === 'sla' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(`/tickets/${notif.ticketId}`);
    } else if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  // Filtered notifications by tab
  const filteredNotifs: AppNotification[] = notifications.filter((n) => {
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'sla') return n.type === 'sla';
    return true;
  });

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
          width: isSidebarCollapsed ? '80px' : '280px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease'
        }}
      >
        <MainSidebar isCollapsed={isSidebarCollapsed} onClickLink={() => setIsSidebarOpen(false)} />
      </div>

      <main className="content-area">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.innerWidth > 1024) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className="glass-interactive flex-center"
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', color: 'white', marginRight: '8px' }}
            >
              <Menu size={20} />
            </button>
            <div className="show-desktop">
              <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <span>ระบบจัดการอัจฉริยะ</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>NEO INTELLIGENCE SUITE</span>
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                    background: 'var(--danger, #ea5455)',
                    borderRadius: '10px',
                    fontSize: '9px',
                    fontWeight: '900',
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
                  background: 'rgba(10, 14, 20, 0.97)',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  backdropFilter: 'blur(20px)',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                  zIndex: 100,
                  overflow: 'hidden',
                  animation: 'fadeIn 0.2s ease-out',
                }}>

                  {/* Header */}
                  <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div>
                        <h3 style={{ fontSize: '14px', fontWeight: '800' }}>การแจ้งเตือน</h3>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>สถานะและเหตุการณ์ล่าสุด</p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--primary)', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.8 }}
                        >
                          <CheckCheck size={12} />
                          อ่านทั้งหมด
                        </button>
                      )}
                    </div>
                    {/* Tabs */}
                    <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', borderRadius: '24px', padding: '3px' }}>
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
                        const iconColor = ACTION_COLORS[notif.type] || '#00f2fe';
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotifClick(notif)}
                            style={{
                              padding: '12px 16px',
                              borderBottom: '1px solid rgba(255,255,255,0.04)',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                              background: !notif.isRead ? `${iconColor}08` : 'transparent',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              position: 'relative'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = !notif.isRead ? `${iconColor}08` : 'transparent')}
                          >
                            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: `${iconColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <IconComponent size={14} color={iconColor} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                                <p style={{ fontSize: '12px', fontWeight: !notif.isRead ? '800' : '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {notif.title}
                                </p>
                                {!notif.isRead && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                    style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: iconColor }}
                                  >
                                    <CheckCircle2 size={10} />
                                  </button>
                                )}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                                {notif.body}
                              </p>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                <p style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px', padding: '4px 12px 4px 4px', borderRadius: '30px', border: '1px solid var(--border)' }} className="glass-interactive">
              {agent?.avatar_url ? (
                <img src={agent.avatar_url} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'var(--secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '12px',
                  boxShadow: '0 0 10px rgba(115, 103, 240, 0.4)'
                }}>{agent?.full_name?.charAt(0) || 'A'}</div>
              )}
              <div className="show-desktop">
                <p style={{ fontSize: '12px', fontWeight: '800' }}>{agent?.full_name || 'Agent'}</p>
              </div>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: '24px', overflow: 'auto', position: 'relative' }}>
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
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
    <NotificationProvider>
      <DashboardInner>{children}</DashboardInner>
    </NotificationProvider>
  );
}
