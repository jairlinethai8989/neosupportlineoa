'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { 
  Bell, 
  Search, 
  CheckCheck, 
  Ticket, 
  Zap, 
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  Volume2,
  VolumeX,
  Settings2,
  ExternalLink,
  Smartphone,
  ShieldCheck,
  Clock,
  Activity,
  RefreshCw,
  Trash2,
  Loader2,
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
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

const getNotificationTypeLabel = (type: string, t: any) => {
  if (type === 'sla') return t('notificationsHub.overSla');
  if (type === 'sla_warning') return t('notificationsHub.nearSla');
  if (type === 'ticket') return t('sidebar.menu.tickets');
  if (type === 'message') return t('sidebar.menu.inbox');
  if (type === 'system') return t('common.system');
  return type;
};

function timeAgo(dateStr: string, t: any): string {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return t('dashboard.justNow');
  if (mins < 60) return `${mins} ${t('dashboard.minutesAgo')}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ${t('dashboard.hoursAgo')}`;
  return `${Math.floor(hrs / 24)} ${t('dashboard.daysAgo')}`;
}

// ---------------------------------------------------------------
// SLA Status Badge
// ---------------------------------------------------------------
function SlaBadge({ minutesRemaining, t }: { minutesRemaining?: number, t: any }) {
  if (minutesRemaining === undefined) return null;
  if (minutesRemaining < 0) {
    return (
      <span style={{ fontSize: '10px', fontWeight: '900', color: '#ea5455', background: 'rgba(234,84,85,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(234,84,85,0.2)', whiteSpace: 'nowrap' }}>
        {t('notificationsHub.overSla')} {Math.abs(minutesRemaining)} {t('dashboard.minutesAgo').replace('ที่แล้ว', '')}
      </span>
    );
  }
  if (minutesRemaining <= 60) {
    return (
      <span style={{ fontSize: '10px', fontWeight: '900', color: '#ff9f43', background: 'rgba(255,159,67,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,159,67,0.2)', whiteSpace: 'nowrap' }}>
        {t('notificationsHub.nearSla')} {minutesRemaining} {t('dashboard.minutesAgo').replace('ที่แล้ว', '')}
      </span>
    );
  }
  return (
    <span style={{ fontSize: '10px', fontWeight: '900', color: '#ffcd3c', background: 'rgba(255,205,60,0.1)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(255,205,60,0.2)', whiteSpace: 'nowrap' }}>
      {t('notificationsHub.nearSla')} {minutesRemaining} {t('dashboard.minutesAgo').replace('ที่แล้ว', '')}
    </span>
  );
}

// ---------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------
export default function NotificationsPage() {
  const { t } = useStaffLocale();
  const router = useRouter();
  const { 
    notifications, unreadCount, markAllRead, clearNotifications, markAsRead,
    isMuted, toggleMute, soundMode, setSoundMode, soundVoice, setSoundVoice, testSound
  } = useNotificationContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');
  const [browserNotifsEnabled, setBrowserNotifsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission === 'granted'
      : false
  );

  // Refresh timestamp every minute
  useEffect(() => {
    const t = setInterval(() => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserNotifsEnabled(Notification.permission === 'granted');
      }
    }, 60000);
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

  const handleClearNotifications = () => {
    if (typeof window === 'undefined') return;
    const shouldClear = window.confirm(t('notificationsHub.clearConfirm') || 'Clear all notifications from this list?');
    if (!shouldClear) return;
    clearNotifications();
  };

  const tabs: { key: 'all' | 'unread' | 'sla'; label: string }[] = [
    { key: 'all', label: t('dashboard.tabs.all') },
    { key: 'unread', label: `${t('dashboard.tabs.unread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
    { key: 'sla', label: `🔥 ${t('dashboard.tabs.sla')}${(slaBreached.length + slaWarning.length) > 0 ? ` (${slaBreached.length + slaWarning.length})` : ''}` },
  ];

  // ---------------------------------------------------------------
  // Sound Widget Component
  // ---------------------------------------------------------------
  function SoundSettingsWidget() {
    const [testing, setTesting] = useState(false);

    const handleTest = async () => {
      setTesting(true);
      const res = await testSound();
      if (!res.ok) {
        console.error('[SoundTest]', res.detail);
      }
      setTesting(false);
    };

    return (
      <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Volume2 size={18} color="var(--primary)" />
            <h2 style={{ fontSize: '15px', fontWeight: '800' }}>{t('settingsNotifications.soundTitle')}</h2>
          </div>
          <button 
            onClick={toggleMute}
            style={{ 
              background: isMuted ? 'rgba(234, 84, 85, 0.1)' : 'rgba(40, 199, 111, 0.1)',
              border: 'none', padding: '6px 10px', borderRadius: '8px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s'
            }}
          >
            {isMuted ? <VolumeX size={14} color="#ea5455" /> : <Volume2 size={14} color="#28c76f" />}
            <span style={{ fontSize: '11px', fontWeight: '800', color: isMuted ? '#ea5455' : '#28c76f' }}>
              {isMuted ? t('common.off') : t('common.on')}
            </span>
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
            <button 
              onClick={() => setSoundMode('beep')}
              style={{
                padding: '10px', borderRadius: '9px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                background: soundMode === 'beep' ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                color: soundMode === 'beep' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              {t('settingsNotifications.soundBeep')}
            </button>
            <button 
              onClick={() => setSoundMode('voice')}
              style={{
                padding: '10px', borderRadius: '9px', border: 'none', fontSize: '12px', fontWeight: '700', cursor: 'pointer',
                background: soundMode === 'voice' ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                color: soundMode === 'voice' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              {t('settingsNotifications.soundVoice')}
            </button>
          </div>

          {soundMode === 'voice' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <button 
                onClick={() => setSoundVoice('female')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: soundVoice === 'female' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: soundVoice === 'female' ? 'var(--primary)' : 'transparent', border: '1px solid var(--border)' }} />
                {t('notificationsHub.alerts.voiceFemale')}
              </button>
              <button 
                onClick={() => setSoundVoice('male')}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer',
                  color: soundVoice === 'male' ? 'var(--primary)' : 'var(--text-muted)', fontSize: '12px', fontWeight: '700'
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: soundVoice === 'male' ? 'var(--primary)' : 'transparent', border: '1px solid var(--border)' }} />
                {t('notificationsHub.alerts.voiceMale')}
              </button>
            </div>
          )}

          <button 
            onClick={handleTest}
            disabled={testing}
            className="glass-interactive"
            style={{ width: '100%', padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: '13px', fontWeight: '800', cursor: testing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {testing ? <Loader2 size={16} className="animate-spin" /> : <Volume2 size={16} />}
            {t('settingsNotifications.testSound')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="glass" style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)' }}>
            <Bell color="var(--primary)" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '6px' }}>{t('notificationsHub.title')}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {unreadCount > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(54, 153, 255, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(54, 153, 255, 0.15)' }}>
                  <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{unreadCount} {t('dashboard.tabs.unread')}</span>
                </div>
              )}
              {slaBreached.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(234, 84, 85, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(234, 84, 85, 0.2)' }}>
                  <AlertTriangle size={12} color="#ea5455" />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ea5455' }}>{slaBreached.length} {t('notificationsHub.overSla')}</span>
                </div>
              )}
              {slaWarning.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 159, 67, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(255, 159, 67, 0.2)' }}>
                  <Clock size={12} color="#ff9f43" />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#ff9f43' }}>{slaWarning.length} {t('notificationsHub.nearSla')}</span>
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
            {browserNotifsEnabled ? t('notificationsHub.browserStatus') : t('settingsNotifications.requestPermission')}
          </button>

          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="glass-interactive" 
              style={{ padding: '10px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#0a0e14', background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '13px', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)' }}
            >
              <CheckCheck size={16} />
              {t('dashboard.markAllRead')}
            </button>
          )}

          {notifications.length > 0 && (
            <button
              onClick={handleClearNotifications}
              className="glass-interactive"
              style={{ padding: '10px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#ff9f43', border: '1px solid rgba(255, 159, 67, 0.3)', background: 'rgba(255, 159, 67, 0.08)', cursor: 'pointer', fontWeight: '800', fontSize: '13px' }}
            >
              <Trash2 size={16} />
              {t('notificationsHub.clearAll')}
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
                  type="text" placeholder={t('notificationsHub.searchPlaceholder')}
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px 10px 42px', color: 'var(--text-main)', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Notification cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredNotifs.length === 0 ? (
                <div style={{ padding: '80px 24px', textAlign: 'center' }}>
                  <Bell size={52} style={{ opacity: 0.07, marginBottom: '16px' }} />
                  <p style={{ color: 'var(--text-muted)', fontWeight: '600', fontSize: '14px' }}>{t('dashboard.noNotifications')}</p>
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
                            {getNotificationTypeLabel(notif.type, t)}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-main)', opacity: 0.5 }}>•</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-main)', opacity: 0.6, fontWeight: '600' }}>{timeAgo(notif.createdAt, t)}</span>
                          {notif.minutesRemaining !== undefined && <SlaBadge minutesRemaining={notif.minutesRemaining} t={t} />}
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: !notif.isRead ? '800' : '600', color: 'var(--text-main)', marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {notif.title}
                        </h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-main)', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                <h2 style={{ fontSize: '15px', fontWeight: '800' }}>{t('notificationsHub.slaMonitor')}</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: 0.5 }}>
                <RefreshCw size={11} />
                <span style={{ fontSize: '10px' }}>90 {t('dashboard.minutesAgo').replace('ที่แล้ว', '')}</span>
              </div>
            </div>

            {/* Stat bars */}
            <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Breached */}
              <div style={{ padding: '14px', borderRadius: '12px', background: slaBreached.length > 0 ? 'rgba(234,84,85,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${slaBreached.length > 0 ? 'rgba(234,84,85,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertTriangle size={14} color="#ea5455" />
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{t('notificationsHub.overSla')}</span>
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: slaBreached.length > 0 ? '#ea5455' : 'var(--text-muted)' }}>
                    {slaBreached.length}
                  </span>
                </div>
                {slaBreached.length > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>{t('settingsSla.escalationLevels')}</p>
                )}
              </div>

              {/* Warning */}
              <div style={{ padding: '14px', borderRadius: '12px', background: slaWarning.length > 0 ? 'rgba(255,159,67,0.07)' : 'rgba(255,255,255,0.02)', border: `1px solid ${slaWarning.length > 0 ? 'rgba(255,159,67,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={14} color="#ff9f43" />
                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{t('notificationsHub.nearSla')} (≤60 {t('dashboard.minutesAgo').replace('ที่แล้ว', '')})</span>
                  </div>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: slaWarning.length > 0 ? '#ff9f43' : 'var(--text-muted)' }}>
                    {slaWarning.length}
                  </span>
                </div>
                {slaWarning.length > 0 && (
                  <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>{t('settingsSla.policyGuide')}</p>
                )}
              </div>

              {/* All clear */}
              {slaBreached.length === 0 && slaWarning.length === 0 && (
                <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(40,199,111,0.07)', border: '1px solid rgba(40,199,111,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={18} color="#28c76f" />
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: '800', color: '#28c76f' }}>{t('notificationsHub.allNormal')}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>{t('notificationsHub.noActiveSla')}</p>
                  </div>
                </div>
              )}

              <button onClick={() => router.push('/tickets')} style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {t('notificationsHub.viewAllTickets')} <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Channel Settings */}
          <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Settings2 size={18} color="var(--primary)" />
              <h2 style={{ fontSize: '15px', fontWeight: '800' }}>{t('notificationsHub.channels')}</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Smartphone size={16} color="var(--primary)" />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{t('notificationsHub.inApp')}</span>
                </div>
                <span style={{ color: '#28c76f', fontSize: '10px', fontWeight: '900' }}>{t('notificationsHub.active')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: browserNotifsEnabled ? 'rgba(40,199,111,0.05)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: `1px solid ${browserNotifsEnabled ? 'rgba(40,199,111,0.2)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Volume2 size={16} color={browserNotifsEnabled ? '#28c76f' : 'var(--text-dim)'} />
                  <span style={{ fontSize: '13px', fontWeight: '700' }}>{t('notificationsHub.browserPush')}</span>
                </div>
                <span style={{ color: browserNotifsEnabled ? '#28c76f' : 'var(--text-muted)', fontSize: '10px', fontWeight: '900' }}>
                  {browserNotifsEnabled ? t('notificationsHub.enabled') : t('common.inactive')}
                </span>
              </div>
            </div>
          </div>

          {/* Sound Settings Widget */}
          <SoundSettingsWidget />

          <div className="glass" style={{ padding: '20px', borderRadius: '20px', border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(54, 153, 255, 0.04) 0%, rgba(0, 242, 254, 0.04) 100%)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <Zap size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '14px', fontWeight: '800' }}>{t('notificationsHub.quickTip')}</h2>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6', marginBottom: '16px' }}>
              {t('notificationsHub.tipBody')}
            </p>
            <button 
              onClick={() => router.push('/settings/profile')}
              style={{ width: '100%', padding: '10px', borderRadius: '9px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--text-main)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            >
              {t('notificationsHub.goToList')} <ExternalLink size={12} />
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
