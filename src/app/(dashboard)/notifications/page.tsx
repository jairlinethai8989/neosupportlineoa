'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  CheckCheck, 
  Ticket, 
  Zap, 
  ArrowRight, 
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Settings2,
  Info,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  Clock,
  TrendingUp,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@/hooks/useNotifications';

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
const ACTION_ICONS: Record<string, any> = {
  'sla':         AlertTriangle,
  'sla_warning': Clock,
  'ticket':      Ticket,
  'message':     MessageSquare,
  'system':      ShieldCheck,
};

const ACTION_COLORS: Record<string, string> = {
  'sla':         '#ea5455',
  'sla_warning': '#ff9f43',
  'ticket':      '#00f2fe',
  'message':     '#28c76f',
  'system':      '#7367f0',
};

const TYPE_LABELS: Record<string, string> = {
  'sla':         'SLA หลุดกำหนด',
  'sla_warning': 'SLA ใกล้หมด',
  'ticket':      'ใบงาน',
  'message':     'ข้อความ',
  'system':      'ระบบ',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

// ---------------------------------------------------------------
// SLA Status Badge
// ---------------------------------------------------------------
function SlaBadge({ minutesRemaining }: { minutesRemaining?: number }) {
  if (minutesRemaining === undefined) return null;
  if (minutesRemaining < 0) {
    return (
      <span style={{ fontSize: '10px', fontWeight: '900', color: '#ea5455', background: 'rgba(234,84,85,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(234,84,85,0.2)', whiteSpace: 'nowrap' }}>
        เกิน {Math.abs(minutesRemaining)} นาที
      </span>
    );
  }
  if (minutesRemaining <= 30) {
    return (
      <span style={{ fontSize: '10px', fontWeight: '900', color: '#ff9f43', background: 'rgba(255,159,67,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,159,67,0.2)', whiteSpace: 'nowrap' }}>
        เหลือ {minutesRemaining} นาที
      </span>
    );
  }
  return (
    <span style={{ fontSize: '10px', fontWeight: '900', color: '#ffcd3c', background: 'rgba(255,205,60,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,205,60,0.2)', whiteSpace: 'nowrap' }}>
      เหลือ {minutesRemaining} นาที
    </span>
  );
}

// ---------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------
export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markAsRead } = useNotificationContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');
  const [browserNotifsEnabled, setBrowserNotifsEnabled] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotifsEnabled(Notification.permission === 'granted');
    }
  }, []);

  // Refresh timestamp every minute
  useEffect(() => {
    const t = setInterval(() => setLastRefreshed(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserNotifsEnabled(permission === 'granted');
  };

  // ---------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------
  const slaBreached = useMemo(() => notifications.filter(n => n.type === 'sla'), [notifications]);
  const slaWarning  = useMemo(() => notifications.filter(n => n.type === 'sla_warning'), [notifications]);

  const filteredNotifs = useMemo(() => {
    return notifications
      .filter(n => {
        const s = searchTerm.toLowerCase();
        const matchSearch = !s || n.title.toLowerCase().includes(s) || n.body.toLowerCase().includes(s) || n.ticketNo?.toString().includes(s);
        if (!matchSearch) return false;
        if (activeTab === 'unread') return !n.isRead;
        if (activeTab === 'sla') return n.type === 'sla' || n.type === 'sla_warning';
        return true;
      })
      .sort((a, b) => {
        // SLA breached first, then warning, then by date
        const priority = (n: AppNotification) => n.type === 'sla' ? 0 : n.type === 'sla_warning' ? 1 : 2;
        if (priority(a) !== priority(b)) return priority(a) - priority(b);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [notifications, searchTerm, activeTab]);

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.ticketId) router.push(`/tickets/${notif.ticketId}`);
    else if (notif.type === 'message') router.push('/inbox');
  };

  const tabs: { key: 'all' | 'unread' | 'sla'; label: string }[] = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'unread', label: `ยังไม่อ่าน${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'sla', label: `🔥 SLA วิกฤต${(slaBreached.length + slaWarning.length) > 0 ? ` (${slaBreached.length + slaWarning.length})` : ''}` },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="glass" style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)' }}>
            <Bell color="var(--primary)" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '6px' }}>ศูนย์การแจ้งเตือน</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {unreadCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(54, 153, 255, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(54, 153, 255, 0.15)' }}>
                  <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{unreadCount} ยังไม่อ่าน</span>
                </div>
              )}
              {slaBreached.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(234, 84, 85, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(234, 84, 85, 0.2)' }}>
                  <AlertTriangle size={12} color="#ea5455" />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ea5455' }}>{slaBreached.length} เกิน SLA</span>
                </div>
              )}
              {slaWarning.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 159, 67, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255, 159, 67, 0.2)' }}>
                  <Clock size={12} color="#ff9f43" />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ff9f43' }}>{slaWarning.length} ใกล้หมด</span>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button 
            onClick={requestNotificationPermission}
            className="glass-interactive" 
            style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: browserNotifsEnabled ? 'var(--primary)' : 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer', fontWeight: '700', fontSize: '13px' }}
          >
            {browserNotifsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            {browserNotifsEnabled ? 'Browser: เปิดแล้ว' : 'เปิด Browser Notif'}
          </button>

          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="glass-interactive" 
              style={{ padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0a0e14', background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '13px', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)' }}
            >
              <CheckCheck size={16} />
              อ่านแล้วทั้งหมด
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '28px' }}>

        {/* LEFT: Notification List */}
        <div style={{ minWidth: 0 }}>
          <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            {/* Tabs + Search */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px', flexWrap: 'wrap' }}>
                {tabs.map(tab => (
                  <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                    padding: '9px 18px', borderRadius: '9px', border: 'none', fontSize: '13px',
                    fontWeight: '800', cursor: 'pointer',
                    background: activeTab === tab.key ? 'rgba(54, 153, 255, 0.12)' : 'transparent',
                    color: activeTab === tab.key ? 'var(--primary)' : 'var(--text-dim)',
                    transition: 'all 0.2s',
                  }}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div style={{ position: 'relative', minWidth: '220px' }}>
                <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.35 }} />
                <input 
                  type="text" placeholder="ค้นหาการแจ้งเตือน..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px 10px 42px', color: 'white', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Notification cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNotifs.length === 0 ? (
                <div style={{ padding: '80px 24px', textAlign: 'center' }}>
                  <Bell size={52} style={{ opacity: 0.07, marginBottom: '16px' }} />
                  <p style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '14px' }}>ไม่มีการแจ้งเตือนในขณะนี้</p>
                </div>
              ) : (
                filteredNotifs.map(notif => {
                  const IconComp = ACTION_ICONS[notif.type] || Ticket;
                  const iconColor = ACTION_COLORS[notif.type] || '#00f2fe';
                  const isSlaAlert = notif.type === 'sla' || notif.type === 'sla_warning';

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotifClick(notif)}
                      className="notif-card-premium"
                      style={{
                        background: !notif.isRead ? (isSlaAlert ? `${iconColor}08` : 'rgba(0, 242, 254, 0.03)') : 'rgba(255,255,255,0.01)',
                        border: `1px solid ${!notif.isRead ? `${iconColor}18` : 'var(--border)'}`,
                        borderLeft: isSlaAlert ? `3px solid ${iconColor}` : undefined,
                        borderRadius: '14px',
                        padding: '16px 20px',
                        display: 'flex',
                        gap: '16px',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: `${iconColor}12`, border: `1px solid ${iconColor}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <IconComp size={20} color={iconColor} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.08em', color: iconColor, opacity: 0.9 }}>
                            {TYPE_LABELS[notif.type] || notif.type}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>•</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '600' }}>{timeAgo(notif.createdAt)}</span>
                          {notif.minutesRemaining !== undefined && <SlaBadge minutesRemaining={notif.minutesRemaining} />}
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: !notif.isRead ? '800' : '600', color: 'var(--text-main)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.title}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.body}
                        </p>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                        {notif.isRead ? (
                          <div style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', opacity: 0.4 }}>
                            <CheckCircle2 size={16} />
                          </div>
                        ) : (
                          <button 
                            onClick={e => { e.stopPropagation(); markAsRead(notif.id); }}
                            className="glass-interactive"
                            style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'var(--primary-glow)', color: 'var(--primary)', cursor: 'pointer' }}
                          >
                            <CheckCheck size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Widgets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* SLA Overview Widget */}
          <div className="glass" style={{ borderRadius: '20px', border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity size={18} color="var(--primary)" />
                <h2 style={{ fontSize: '15px', fontWeight: '800' }}>SLA Monitor</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
                <RefreshCw size={11} />
                <span style={{ fontSize: '10px' }}>90 วินาที</span>
              </div>
            </div>

            {/* Stat bars */}
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Breached */}
              <div style={{ padding: '14px', borderRadius: '12px', background: slaBreached.length > 0 ? 'rgba(234,84,85,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${slaBreached.length > 0 ? 'rgba(234,84,85,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} color="#ea5455" />
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>เกิน SLA</span>
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: slaBreached.length > 0 ? '#ea5455' : 'var(--text-muted)' }}>
                    {slaBreached.length}
                  </span>
                </div>
                {slaBreached.length > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>กรุณาดำเนินการด่วน</p>
                )}
              </div>

              {/* Warning */}
              <div style={{ padding: '14px', borderRadius: '12px', background: slaWarning.length > 0 ? 'rgba(255,159,67,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${slaWarning.length > 0 ? 'rgba(255,159,67,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} color="#ff9f43" />
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>ใกล้ SLA (≤60 นาที)</span>
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: slaWarning.length > 0 ? '#ff9f43' : 'var(--text-muted)' }}>
                    {slaWarning.length}
                  </span>
                </div>
                {slaWarning.length > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>ต้องดำเนินการภายใน 60 นาที</p>
                )}
              </div>

              {/* All clear */}
              {slaBreached.length === 0 && slaWarning.length === 0 && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(40,199,111,0.07)', border: '1px solid rgba(40,199,111,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="#28c76f" />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '800', color: '#28c76f' }}>SLA ปกติทั้งหมด</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>ไม่มีใบงานที่ใกล้หมดหรือเกิน SLA</p>
                  </div>
                </div>
              )}

              <button onClick={() => router.push('/tickets')} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                ดูใบงานทั้งหมด <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Channel Settings */}
          <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Settings2 size={18} color="var(--primary)" />
              <h2 style={{ fontSize: '15px', fontWeight: '800' }}>ช่องทางแจ้งเตือน</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={16} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>In-App</span>
                </div>
                <span style={{ color: '#28c76f', fontSize: '10px', fontWeight: '900' }}>ใช้งานอยู่</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: browserNotifsEnabled ? 'rgba(40,199,111,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: `1px solid ${browserNotifsEnabled ? 'rgba(40,199,111,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Volume2 size={16} color={browserNotifsEnabled ? '#28c76f' : 'var(--text-dim)'} />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>Browser Push</span>
                </div>
                <span style={{ color: browserNotifsEnabled ? '#28c76f' : 'var(--text-muted)', fontSize: '10px', fontWeight: '900' }}>
                  {browserNotifsEnabled ? 'เปิดแล้ว' : 'ยังไม่เปิด'}
                </span>
              </div>
              <div style={{ padding: '12px', background: 'rgba(54, 153, 255, 0.04)', borderRadius: '10px', border: '1px solid rgba(54, 153, 255, 0.1)' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Info size={13} color="var(--primary)" style={{ flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                    SLA จะถูกตรวจสอบทุก 90 วินาที Toast แจ้งเตือนจะไม่ซ้ำซ้อน
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick tip */}
          <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(54, 153, 255, 0.04) 0%, rgba(0, 242, 254, 0.04) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Zap size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: '800' }}>Quick Tip</h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '16px' }}>
              คลิกการแจ้งเตือนเพื่อไปยังใบงานหรือห้องแชทโดยตรง ระบบจะทำเครื่องหมายว่าอ่านแล้วทันที
            </p>
            <button 
              onClick={() => router.push('/settings/profile')}
              style={{ width: '100%', padding: '10px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              ตั้งค่าโปรไฟล์ <ExternalLink size={12} />
            </button>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .notif-card-premium:hover {
          background: rgba(255,255,255,0.04) !important;
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .pulse-dot { animation: sla-pulse 2s infinite; }
        @keyframes sla-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(0, 242, 254, 0.4); }
          50% { opacity: 0.7; box-shadow: 0 0 0 8px rgba(0, 242, 254, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
