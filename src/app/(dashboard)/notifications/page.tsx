'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  MessageSquare,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Ticket,
  Trash2,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  PageHeader,
} from '@/components/ui';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { AppNotification } from '@/hooks/useNotifications';
import styles from './notifications.module.css';

const ACTION_ICONS: Record<string, React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>> = {
  sla: AlertTriangle,
  sla_warning: Clock,
  ticket: Ticket,
  message: MessageSquare,
  system: ShieldCheck,
};

function getNotificationTypeLabel(type: string, t: (key: string) => string) {
  if (type === 'sla') return t('notificationsHub.overSla');
  if (type === 'sla_warning') return t('notificationsHub.nearSla');
  if (type === 'ticket') return t('sidebar.menu.tickets');
  if (type === 'message') return t('sidebar.menu.inbox');
  if (type === 'system') return t('common.system');
  return type;
}

function timeAgo(dateStr: string, t: (key: string) => string): string {
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

function SlaBadge({
  minutesRemaining,
  t,
}: {
  minutesRemaining?: number;
  t: (key: string) => string;
}) {
  if (minutesRemaining === undefined) return null;
  const unit = t('dashboard.minutesAgo').replace('ที่แล้ว', '');
  if (minutesRemaining < 0) {
    return (
      <Badge size="sm" variant="danger">
        {t('notificationsHub.overSla')} {Math.abs(minutesRemaining)} {unit}
      </Badge>
    );
  }
  return (
    <Badge size="sm" variant="warning">
      {t('notificationsHub.nearSla')} {minutesRemaining} {unit}
    </Badge>
  );
}

export default function NotificationsPage() {
  const { locale, t } = useStaffLocale();
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
    markAsRead,
    isMuted,
    toggleMute,
    soundMode,
    setSoundMode,
    soundVoice,
    setSoundVoice,
    testSound,
  } = useNotificationContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [testingSound, setTestingSound] = useState(false);
  const [browserNotifsEnabled, setBrowserNotifsEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission === 'granted'
      : false
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setBrowserNotifsEnabled(Notification.permission === 'granted');
      }
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserNotifsEnabled(permission === 'granted');
  };

  const slaBreached = useMemo(
    () => notifications.filter((n) => n.type === 'sla'),
    [notifications]
  );
  const slaWarning = useMemo(
    () => notifications.filter((n) => n.type === 'sla_warning'),
    [notifications]
  );

  const filteredNotifs = useMemo(() => {
    return notifications
      .filter((n) => {
        const s = searchTerm.toLowerCase();
        const matchSearch =
          !s ||
          n.title.toLowerCase().includes(s) ||
          n.body.toLowerCase().includes(s) ||
          n.ticketNo?.toString().includes(s);
        if (!matchSearch) return false;
        if (activeTab === 'unread') return !n.isRead;
        if (activeTab === 'sla') return n.type === 'sla' || n.type === 'sla_warning';
        return true;
      })
      .sort((a, b) => {
        const priority = (n: AppNotification) =>
          n.type === 'sla' ? 0 : n.type === 'sla_warning' ? 1 : 2;
        if (priority(a) !== priority(b)) return priority(a) - priority(b);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [notifications, searchTerm, activeTab]);

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.ticketId) router.push(`/tickets/${notif.ticketId}`);
    else if (notif.type === 'message') router.push('/inbox');
  };

  const handleTestSound = async () => {
    setTestingSound(true);
    const res = await testSound();
    if (!res.ok) {
      console.error('[SoundTest]', res.detail);
    }
    setTestingSound(false);
  };

  const tabs: { key: 'all' | 'unread' | 'sla'; label: string }[] = [
    { key: 'all', label: t('dashboard.tabs.all') },
    {
      key: 'unread',
      label: `${t('dashboard.tabs.unread')}${unreadCount > 0 ? ` (${unreadCount})` : ''}`,
    },
    {
      key: 'sla',
      label: `${t('dashboard.tabs.sla')}${slaBreached.length + slaWarning.length > 0 ? ` (${slaBreached.length + slaWarning.length})` : ''}`,
    },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={t('notificationsHub.title')}
        badge={
          <div className={styles.statusBadges}>
            {unreadCount > 0 && (
              <Badge variant="primary" dot>
                {unreadCount} {t('dashboard.tabs.unread')}
              </Badge>
            )}
            {slaBreached.length > 0 && (
              <Badge variant="danger" dot>
                {slaBreached.length} {t('notificationsHub.overSla')}
              </Badge>
            )}
            {slaWarning.length > 0 && (
              <Badge variant="warning" dot>
                {slaWarning.length} {t('notificationsHub.nearSla')}
              </Badge>
            )}
          </div>
        }
        actions={
          <>
            <Button
              size="sm"
              variant={browserNotifsEnabled ? 'secondary' : 'ghost'}
              onClick={requestNotificationPermission}
              leftIcon={
                browserNotifsEnabled ? (
                  <Volume2 size={15} aria-hidden="true" />
                ) : (
                  <VolumeX size={15} aria-hidden="true" />
                )
              }
            >
              {browserNotifsEnabled
                ? t('notificationsHub.browserStatus')
                : t('settingsNotifications.requestPermission')}
            </Button>

            {unreadCount > 0 && (
              <Button
                size="sm"
                variant="primary"
                onClick={markAllRead}
                leftIcon={<CheckCheck size={15} aria-hidden="true" />}
              >
                {t('dashboard.markAllRead')}
              </Button>
            )}

            {notifications.length > 0 && (
              <Button
                size="sm"
                variant="warning"
                onClick={() => setShowClearConfirm(true)}
                leftIcon={<Trash2 size={15} aria-hidden="true" />}
              >
                {t('notificationsHub.clearAll')}
              </Button>
            )}
          </>
        }
      />

      <div className={styles.grid}>
        <Card>
          <CardBody>
            <div className={styles.listToolbar}>
              <div className={styles.tabs} role="tablist" aria-label="Notification filters">
                {tabs.map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setActiveTab(tab.key)}
                      className={clsx(styles.tabBtn, active && styles.tabBtnActive)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className={styles.searchWrap}>
                <Search size={14} className={styles.searchIcon} aria-hidden="true" />
                <input
                  type="search"
                  placeholder={t('notificationsHub.searchPlaceholder')}
                  aria-label={t('notificationsHub.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
            </div>

            <div className={styles.notifList}>
              {filteredNotifs.length === 0 ? (
                <EmptyState
                  icon={<Bell size={22} aria-hidden="true" />}
                  title={t('dashboard.noNotifications')}
                />
              ) : (
                filteredNotifs.map((notif) => {
                  const IconComp = ACTION_ICONS[notif.type] || Ticket;
                  const isSla = notif.type === 'sla';
                  const isSlaWarn = notif.type === 'sla_warning';

                  return (
                    <div
                      key={notif.id}
                      className={clsx(
                        styles.notifItem,
                        !notif.isRead && styles.notifItemUnread,
                        isSla && styles.notifItemSla,
                        isSlaWarn && styles.notifItemWarning
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => handleNotifClick(notif)}
                        className={styles.notifMainBtn}
                      >
                        <div
                          className={clsx(
                            styles.notifIconBox,
                            isSla
                              ? styles.notifIconSla
                              : isSlaWarn
                                ? styles.notifIconWarning
                                : notif.type === 'message'
                                  ? styles.notifIconMessage
                                  : styles.notifIconTicket
                          )}
                          aria-hidden="true"
                        >
                          <IconComp size={18} aria-hidden={true} />
                        </div>

                        <div className={styles.notifBody}>
                          <div className={styles.notifMeta}>
                            <span style={{ fontWeight: 700 }}>
                              {getNotificationTypeLabel(notif.type, t)}
                            </span>
                            <span aria-hidden="true">•</span>
                            <span className="tabular-nums">{timeAgo(notif.createdAt, t)}</span>
                            {notif.minutesRemaining !== undefined && (
                              <SlaBadge minutesRemaining={notif.minutesRemaining} t={t} />
                            )}
                          </div>
                          <p className={styles.notifTitle}>{notif.title}</p>
                          <p className={styles.notifSubtitle}>{notif.body}</p>
                        </div>
                      </button>

                      {notif.isRead ? (
                        <span
                          aria-label={locale === 'th' ? 'อ่านแล้ว' : 'Read'}
                          style={{ color: 'var(--color-text-disabled)', padding: '6px' }}
                        >
                          <CheckCircle2 size={16} aria-hidden="true" />
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          onClick={() => markAsRead(notif.id)}
                          aria-label={locale === 'th' ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'Mark as read'}
                          title={locale === 'th' ? 'ทำเครื่องหมายว่าอ่านแล้ว' : 'Mark as read'}
                        >
                          <CheckCheck size={15} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </CardBody>
        </Card>

        <div className={styles.sidebarCol}>
          {/* SLA Monitor */}
          <Card>
            <CardHeader
              actions={
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: 'var(--color-text-subtle)',
                  }}
                >
                  <RefreshCw size={11} aria-hidden="true" />
                  <span className="tabular-nums">90s</span>
                </span>
              }
            >
              <CardTitle>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} color="var(--color-primary)" aria-hidden="true" />
                  {t('notificationsHub.slaMonitor')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className={clsx(styles.statTile, slaBreached.length > 0 && styles.statTileDanger)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  <AlertTriangle size={14} color="var(--color-danger)" aria-hidden="true" />
                  <span>{t('notificationsHub.overSla')}</span>
                </div>
                <span
                  className={clsx(styles.statNumber, 'tabular-nums')}
                  style={{
                    color: slaBreached.length > 0 ? 'var(--color-danger-text)' : 'var(--color-text-muted)',
                  }}
                >
                  {slaBreached.length}
                </span>
              </div>

              <div className={clsx(styles.statTile, slaWarning.length > 0 && styles.statTileWarning)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  <Clock size={14} color="var(--color-warning)" aria-hidden="true" />
                  <span>
                    {t('notificationsHub.nearSla')} (≤60m)
                  </span>
                </div>
                <span
                  className={clsx(styles.statNumber, 'tabular-nums')}
                  style={{
                    color: slaWarning.length > 0 ? 'var(--color-warning-text)' : 'var(--color-text-muted)',
                  }}
                >
                  {slaWarning.length}
                </span>
              </div>

              {slaBreached.length === 0 && slaWarning.length === 0 && (
                <div className={clsx(styles.statTile, styles.statTileSuccess)} style={{ justifyContent: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={18} color="var(--color-success)" aria-hidden="true" />
                  <div>
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-success-text)' }}>
                      {t('notificationsHub.allNormal')}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {t('notificationsHub.noActiveSla')}
                    </p>
                  </div>
                </div>
              )}

              <Button
                size="sm"
                variant="secondary"
                fullWidth
                onClick={() => router.push('/tickets')}
                rightIcon={<ExternalLink size={12} aria-hidden="true" />}
              >
                {t('notificationsHub.viewAllTickets')}
              </Button>
            </CardBody>
          </Card>

          {/* Channels */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Settings2 size={16} color="var(--color-primary)" aria-hidden="true" />
                  {t('notificationsHub.channels')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className={styles.channelRow}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Smartphone size={15} color="var(--color-primary)" aria-hidden="true" />
                  {t('notificationsHub.inApp')}
                </span>
                <Badge size="sm" variant="success">
                  {t('notificationsHub.active')}
                </Badge>
              </div>
              <div className={styles.channelRow}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2
                    size={15}
                    color={browserNotifsEnabled ? 'var(--color-success)' : 'var(--color-text-muted)'}
                    aria-hidden="true"
                  />
                  {t('notificationsHub.browserPush')}
                </span>
                <Badge size="sm" variant={browserNotifsEnabled ? 'success' : 'neutral'}>
                  {browserNotifsEnabled
                    ? t('notificationsHub.enabled')
                    : locale === 'th'
                      ? 'ปิดอยู่'
                      : 'Off'}
                </Badge>
              </div>
            </CardBody>
          </Card>

          {/* Sound Settings */}
          <Card>
            <CardHeader
              actions={
                <Button
                  size="sm"
                  variant={isMuted ? 'danger' : 'secondary'}
                  onClick={toggleMute}
                  leftIcon={
                    isMuted ? (
                      <VolumeX size={14} aria-hidden="true" />
                    ) : (
                      <Volume2 size={14} aria-hidden="true" />
                    )
                  }
                >
                  {isMuted
                    ? locale === 'th'
                      ? 'ปิดเสียง'
                      : 'Muted'
                    : locale === 'th'
                      ? 'เปิดเสียง'
                      : 'On'}
                </Button>
              }
            >
              <CardTitle>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Volume2 size={16} color="var(--color-primary)" aria-hidden="true" />
                  {t('settingsNotifications.soundTitle')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className={styles.tabs} style={{ width: '100%' }}>
                <button
                  type="button"
                  aria-pressed={soundMode === 'beep'}
                  onClick={() => setSoundMode('beep')}
                  className={clsx(styles.tabBtn, soundMode === 'beep' && styles.tabBtnActive)}
                  style={{ flex: 1 }}
                >
                  {t('settingsNotifications.soundBeep')}
                </button>
                <button
                  type="button"
                  aria-pressed={soundMode === 'voice'}
                  onClick={() => setSoundMode('voice')}
                  className={clsx(styles.tabBtn, soundMode === 'voice' && styles.tabBtnActive)}
                  style={{ flex: 1 }}
                >
                  {t('settingsNotifications.soundVoice')}
                </button>
              </div>

              {soundMode === 'voice' && (
                <div className={styles.radioPair} role="radiogroup" aria-label="Voice gender">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={soundVoice === 'female'}
                    onClick={() => setSoundVoice('female')}
                    className={clsx(
                      styles.radioBtn,
                      soundVoice === 'female' && styles.radioBtnActive
                    )}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background:
                          soundVoice === 'female' ? 'var(--color-primary)' : 'transparent',
                        border: '1px solid var(--color-border-strong)',
                      }}
                      aria-hidden="true"
                    />
                    {t('notificationsHub.alerts.voiceFemale')}
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={soundVoice === 'male'}
                    onClick={() => setSoundVoice('male')}
                    className={clsx(
                      styles.radioBtn,
                      soundVoice === 'male' && styles.radioBtnActive
                    )}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: soundVoice === 'male' ? 'var(--color-primary)' : 'transparent',
                        border: '1px solid var(--color-border-strong)',
                      }}
                      aria-hidden="true"
                    />
                    {t('notificationsHub.alerts.voiceMale')}
                  </button>
                </div>
              )}

              <Button
                size="sm"
                variant="secondary"
                fullWidth
                loading={testingSound}
                onClick={handleTestSound}
                leftIcon={<Volume2 size={14} aria-hidden="true" />}
              >
                {t('settingsNotifications.testSound')}
              </Button>
            </CardBody>
          </Card>

          {/* Quick Tip */}
          <Card>
            <CardHeader>
              <CardTitle>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} color="var(--color-primary)" aria-hidden="true" />
                  {t('notificationsHub.quickTip')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.55 }}>
                {t('notificationsHub.tipBody')}
              </p>
              <Button
                size="sm"
                variant="secondary"
                fullWidth
                onClick={() => router.push('/settings/profile')}
                rightIcon={<ExternalLink size={12} aria-hidden="true" />}
              >
                {t('notificationsHub.goToList')}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        size="sm"
        title={t('notificationsHub.clearAll')}
        description={t('notificationsHub.clearConfirm')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowClearConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowClearConfirm(false);
                clearNotifications();
              }}
            >
              {t('notificationsHub.clearAll')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {t('notificationsHub.clearConfirm')}
        </p>
      </Modal>
    </div>
  );
}
