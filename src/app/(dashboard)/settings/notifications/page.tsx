'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, Globe2, Play, Volume2, VolumeX } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { NotificationSoundMode } from '@/hooks/useNotifications';
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle, PageHeader } from '@/components/ui';
import styles from '../settings.module.css';

type NotifPermission = 'unsupported' | NotificationPermission;

export default function NotificationSettingsPage() {
  const {
    isMuted,
    toggleMute,
    soundMode,
    soundVoice,
    setSoundMode,
    setSoundVoice,
    prefNewTicket,
    prefNewMessage,
    prefTransfer,
    prefSlaWarning,
    updatePreference,
    testSound,
    addToast,
  } = useNotificationContext();
  const { locale, setLocale, t } = useStaffLocale();

  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const isSoundEnabled = !isMuted;

  const soundModeLabel = useMemo(() => {
    if (!isSoundEnabled) return t('settingsNotifications.mutedMode');
    if (soundMode === 'voice') {
      return soundVoice === 'female'
        ? t('settingsNotifications.femaleVoice')
        : t('settingsNotifications.maleVoice');
    }
    switch (soundMode) {
      case 'beep-retro':
        return locale === 'th' ? 'เสียง Beep (Retro 8-bit)' : 'Beep (Retro 8-bit)';
      case 'beep-cosmic':
        return locale === 'th' ? 'เสียง Beep (Cosmic Echo)' : 'Beep (Cosmic Echo)';
      case 'beep-digital':
        return locale === 'th' ? 'เสียง Beep (Digital Double)' : 'Beep (Digital Double)';
      case 'beep-alert':
        return locale === 'th' ? 'เสียง Beep (Urgent Alert)' : 'Beep (Urgent Alert)';
      case 'beep':
      default:
        return t('settingsNotifications.soundBeep');
    }
  }, [isSoundEnabled, soundMode, soundVoice, t, locale]);

  const pushToast = (title: string, body: string, duration = 9000) => {
    addToast({
      id: `settings-toast-${Date.now()}`,
      type: 'ticket',
      title,
      body,
      duration,
    });
  };

  const setSoundEnabled = (enabled: boolean) => {
    if (enabled === isSoundEnabled) return;
    toggleMute();
  };

  const onTestSound = async () => {
    const result = await testSound();
    if (result.ok) {
      pushToast(t('settingsNotifications.testSound'), result.hint);
      return;
    }

    pushToast(t('settingsNotifications.testSound'), `${result.detail} • ${result.hint}`, 12000);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      pushToast(
        t('settingsNotifications.systemNotificationTitle'),
        t('settingsNotifications.systemNotificationDescription')
      );
      return;
    }

    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      pushToast(t('settingsNotifications.systemNotificationTitle'), next);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast(t('settingsNotifications.systemNotificationTitle'), message, 12000);
    }
  };

  const permissionLabel = permission === 'unsupported' ? t('settingsNotifications.unsupported') : permission;

  const beepOptions: { id: NotificationSoundMode; label: string }[] = [
    { id: 'beep', label: locale === 'th' ? '🔊 Classic Beep (มาตรฐาน)' : '🔊 Classic Beep (Standard)' },
    { id: 'beep-retro', label: locale === 'th' ? '👾 Retro 8-bit (เกมย้อนยุค)' : '👾 Retro 8-bit (Retro Game)' },
    { id: 'beep-cosmic', label: locale === 'th' ? '🌌 Cosmic Echo (เสียงก้องอวกาศ)' : '🌌 Cosmic Echo (Space Echo)' },
    { id: 'beep-digital', label: locale === 'th' ? '🤖 Digital Double (เสียงเตือนคู่ดิจิทัล)' : '🤖 Digital Double (Double Pulse)' },
    { id: 'beep-alert', label: locale === 'th' ? '🚨 Urgent Alert (แจ้งเตือนเร่งด่วน)' : '🚨 Urgent Alert (Urgent Siren)' },
  ];

  const eventRows = [
    { id: 'new_ticket', label: t('settingsNotifications.eventNewTicket'), value: prefNewTicket },
    { id: 'new_message', label: t('settingsNotifications.eventNewMessage'), value: prefNewMessage },
    { id: 'transfer', label: t('settingsNotifications.eventTransfer'), value: prefTransfer },
    { id: 'sla_warning', label: t('settingsNotifications.eventSlaWarning'), value: prefSlaWarning },
  ];

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <Link href="/settings/profile" className={styles.backLink} aria-label="กลับหน้าโปรไฟล์">
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
            <span>{t('settingsNotifications.title')}</span>
          </span>
        }
      />

      <div className={styles.twoColEqual}>
        {/* Left Column: Audio & Language */}
        <div className={styles.stackLg}>
          <Card>
            <CardHeader
              actions={
                <Button
                  size="md"
                  variant={isSoundEnabled ? 'primary' : 'secondary'}
                  iconOnly
                  aria-pressed={isSoundEnabled}
                  aria-label={
                    isSoundEnabled
                      ? t('settingsNotifications.soundDisabled')
                      : t('settingsNotifications.soundEnabled')
                  }
                  onClick={() => setSoundEnabled(!isSoundEnabled)}
                >
                  {isSoundEnabled ? <Volume2 size={18} aria-hidden="true" /> : <VolumeX size={18} aria-hidden="true" />}
                </Button>
              }
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
                  <Bell size={18} aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>{t('settingsNotifications.audioTitle')}</CardTitle>
                  <CardDescription>{t('settingsNotifications.audioDescription')}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardBody className={styles.stackMd}>
              <div className={styles.formGrid2}>
                <button
                  type="button"
                  onClick={() => setSoundMode('beep')}
                  disabled={!isSoundEnabled}
                  aria-pressed={soundMode.startsWith('beep')}
                  className={`${styles.optionCard} ${soundMode.startsWith('beep') ? styles.optionCardActive : ''}`}
                >
                  <span className={styles.optionCardTitle}>{t('settingsNotifications.soundBeep')}</span>
                  <span className={styles.optionCardDesc}>{t('settingsNotifications.soundBeepDescription')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoundMode('voice')}
                  disabled={!isSoundEnabled}
                  aria-pressed={soundMode === 'voice'}
                  className={`${styles.optionCard} ${soundMode === 'voice' ? styles.optionCardActive : ''}`}
                >
                  <span className={styles.optionCardTitle}>{t('settingsNotifications.soundVoice')}</span>
                  <span className={styles.optionCardDesc}>{t('settingsNotifications.soundVoiceDescription')}</span>
                </button>
              </div>

              {soundMode.startsWith('beep') && (
                <div
                  className={styles.stackSm}
                  style={{
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-surface-subtle)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  <p
                    style={{
                      fontSize: '11px',
                      fontWeight: 'var(--weight-semibold)',
                      color: 'var(--color-text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {locale === 'th' ? 'เลือกรูปแบบเสียง Beep' : 'Choose Beep Style'}
                  </p>
                  {beepOptions.map((option) => {
                    const isSelected = soundMode === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSoundMode(option.id)}
                        disabled={!isSoundEnabled}
                        aria-pressed={isSelected}
                        className={`${styles.optionCard} ${isSelected ? styles.optionCardActive : ''}`}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: 'var(--space-2) var(--space-3)',
                        }}
                      >
                        <span style={{ fontSize: 'var(--text-xs)', fontWeight: isSelected ? 600 : 500 }}>
                          {option.label}
                        </span>
                        {isSelected && (
                          <Badge variant="primary" size="sm" dot>
                            ACTIVE
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {soundMode === 'voice' && (
                <div className={styles.formGrid2}>
                  <button
                    type="button"
                    onClick={() => setSoundVoice('female')}
                    disabled={!isSoundEnabled}
                    aria-pressed={soundVoice === 'female'}
                    className={`${styles.optionCard} ${soundVoice === 'female' ? styles.optionCardActive : ''}`}
                  >
                    <span className={styles.optionCardTitle}>{t('settingsNotifications.femaleVoice')}</span>
                    <span className={styles.optionCardDesc}>{t('settingsNotifications.femaleVoiceDescription')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoundVoice('male')}
                    disabled={!isSoundEnabled}
                    aria-pressed={soundVoice === 'male'}
                    className={`${styles.optionCard} ${soundVoice === 'male' ? styles.optionCardActive : ''}`}
                  >
                    <span className={styles.optionCardTitle}>{t('settingsNotifications.maleVoice')}</span>
                    <span className={styles.optionCardDesc}>{t('settingsNotifications.maleVoiceDescription')}</span>
                  </button>
                </div>
              )}

              <div
                className={styles.rowBetween}
                style={{ paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
                    {t('settingsNotifications.currentMode')}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                    {soundModeLabel}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onTestSound}
                  disabled={!isSoundEnabled}
                  leftIcon={<Play size={14} aria-hidden="true" />}
                >
                  {t('settingsNotifications.testSound')}
                </Button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconInfo}`}>
                  <Globe2 size={18} aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>{t('settingsNotifications.languageTitle')}</CardTitle>
                  <CardDescription>{t('settingsNotifications.languageDescription')}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardBody className={styles.stackMd}>
              <div className={styles.formGrid2}>
                <button
                  type="button"
                  onClick={() => setLocale('th')}
                  aria-pressed={locale === 'th'}
                  className={`${styles.optionCard} ${locale === 'th' ? styles.optionCardActive : ''}`}
                >
                  <span className={styles.optionCardTitle}>{t('common.thai')}</span>
                  <span className={styles.optionCardDesc}>{t('common.staffLanguageHint')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocale('en')}
                  aria-pressed={locale === 'en'}
                  className={`${styles.optionCard} ${locale === 'en' ? styles.optionCardActive : ''}`}
                >
                  <span className={styles.optionCardTitle}>{t('common.english')}</span>
                  <span className={styles.optionCardDesc}>{t('common.staffLanguageHint')}</span>
                </button>
              </div>

              <div style={{ fontSize: 'var(--text-xs)' }}>
                <span style={{ fontWeight: 'var(--weight-semibold)' }}>
                  {t('settingsNotifications.currentLanguage')}:{' '}
                </span>
                <span style={{ color: 'var(--color-text-muted)' }}>
                  {locale === 'th' ? t('common.thai') : t('common.english')}
                </span>
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column: Events & Browser Permission */}
        <div className={styles.stackLg}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconWarning}`}>
                  <Bell size={18} aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>{t('settingsNotifications.eventsTitle')}</CardTitle>
                  <CardDescription>{t('settingsNotifications.eventsDescription')}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardBody className={styles.stackSm}>
              {eventRows.map((event) => {
                const labelId = `notif-event-${event.id}`;
                return (
                  <div key={event.id} className={styles.switchRow}>
                    <span id={labelId} className={styles.switchLabel}>
                      {event.label}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={event.value}
                      aria-labelledby={labelId}
                      onClick={() => updatePreference(event.id, !event.value)}
                      className={`${styles.switchTrack} ${event.value ? styles.switchTrackOn : ''}`}
                    >
                      <span className={styles.switchThumb} />
                    </button>
                  </div>
                );
              })}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('settingsNotifications.systemNotificationTitle')}</CardTitle>
              <CardDescription>{t('settingsNotifications.systemNotificationDescription')}</CardDescription>
            </CardHeader>

            <CardBody className={styles.stackMd}>
              <div className={styles.rowBetween}>
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <div style={{ fontWeight: 'var(--weight-semibold)' }}>
                    {t('settingsNotifications.permissionStatus')}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <Badge
                      variant={
                        permission === 'granted' ? 'success' : permission === 'denied' ? 'danger' : 'neutral'
                      }
                      size="sm"
                      dot
                    >
                      {permissionLabel}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" variant="secondary" onClick={requestNotificationPermission}>
                  {t('settingsNotifications.requestPermission')}
                </Button>
              </div>

              <div
                style={{
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--color-border)',
                }}
              >
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', marginBottom: '4px' }}>
                  {t('settingsNotifications.noteTitle')}
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-normal)' }}>
                  {t('settingsNotifications.noteBody')}
                </p>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
