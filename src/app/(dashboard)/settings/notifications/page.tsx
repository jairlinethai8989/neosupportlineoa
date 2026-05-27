'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, Globe2, Play, Volume2, VolumeX } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

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
    return t('settingsNotifications.soundBeep');
  }, [isSoundEnabled, soundMode, soundVoice, t]);

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

    pushToast(
      t('settingsNotifications.testSound'),
      `${result.detail} • ${result.hint}`,
      12000
    );
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

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/settings/profile" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={24} />
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>{t('settingsNotifications.title')}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '32px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass" style={{ padding: '32px' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  className="flex-center"
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '14px',
                    background: 'var(--primary-transparent)',
                    color: 'var(--primary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Bell size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>
                    {t('settingsNotifications.audioTitle')}
                  </h2>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                    {t('settingsNotifications.audioDescription')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSoundEnabled(!isSoundEnabled)}
                className="glass-interactive flex-center"
                title={
                  isSoundEnabled
                    ? t('settingsNotifications.soundDisabled')
                    : t('settingsNotifications.soundEnabled')
                }
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  border: '1px solid var(--border)',
                  background: isSoundEnabled ? 'var(--primary-transparent)' : 'transparent',
                  color: isSoundEnabled ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              >
                {isSoundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button
                onClick={() => setSoundMode('beep')}
                disabled={!isSoundEnabled}
                className="glass-interactive"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: `1px solid ${soundMode === 'beep' ? 'var(--primary)' : 'var(--border)'}`,
                  background: soundMode === 'beep' ? 'rgba(0,242,254,0.06)' : 'transparent',
                  cursor: isSoundEnabled ? 'pointer' : 'not-allowed',
                  opacity: isSoundEnabled ? 1 : 0.5,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>
                  {t('settingsNotifications.soundBeep')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  {t('settingsNotifications.soundBeepDescription')}
                </div>
              </button>

              <button
                onClick={() => setSoundMode('voice')}
                disabled={!isSoundEnabled}
                className="glass-interactive"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: `1px solid ${soundMode === 'voice' ? 'var(--primary)' : 'var(--border)'}`,
                  background: soundMode === 'voice' ? 'rgba(0,242,254,0.06)' : 'transparent',
                  cursor: isSoundEnabled ? 'pointer' : 'not-allowed',
                  opacity: isSoundEnabled ? 1 : 0.5,
                  textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>
                  {t('settingsNotifications.soundVoice')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  {t('settingsNotifications.soundVoiceDescription')}
                </div>
              </button>
            </div>

            {soundMode === 'voice' && (
              <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <button
                  onClick={() => setSoundVoice('female')}
                  disabled={!isSoundEnabled}
                  className="glass-interactive"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: `1px solid ${soundVoice === 'female' ? 'var(--primary)' : 'var(--border)'}`,
                    background: soundVoice === 'female' ? 'rgba(0,242,254,0.06)' : 'transparent',
                    cursor: isSoundEnabled ? 'pointer' : 'not-allowed',
                    opacity: isSoundEnabled ? 1 : 0.5,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>
                    {t('settingsNotifications.femaleVoice')}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                    {t('settingsNotifications.femaleVoiceDescription')}
                  </div>
                </button>

                <button
                  onClick={() => setSoundVoice('male')}
                  disabled={!isSoundEnabled}
                  className="glass-interactive"
                  style={{
                    padding: '14px 16px',
                    borderRadius: '14px',
                    border: `1px solid ${soundVoice === 'male' ? 'var(--primary)' : 'var(--border)'}`,
                    background: soundVoice === 'male' ? 'rgba(0,242,254,0.06)' : 'transparent',
                    cursor: isSoundEnabled ? 'pointer' : 'not-allowed',
                    opacity: isSoundEnabled ? 1 : 0.5,
                    textAlign: 'left',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>
                    {t('settingsNotifications.maleVoice')}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                    {t('settingsNotifications.maleVoiceDescription')}
                  </div>
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '900' }}>{t('settingsNotifications.currentMode')}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{soundModeLabel}</div>
              </div>
              <button
                onClick={onTestSound}
                disabled={!isSoundEnabled}
                className="glass-interactive flex-center"
                style={{
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-main)',
                  cursor: isSoundEnabled ? 'pointer' : 'not-allowed',
                  opacity: isSoundEnabled ? 1 : 0.5,
                  gap: '8px',
                }}
                title={t('settingsNotifications.testSound')}
              >
                <Play size={16} />
                {t('settingsNotifications.testSound')}
              </button>
            </div>
          </div>

          <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                className="flex-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: 'rgba(0,242,254,0.08)',
                  color: 'var(--primary)',
                  border: '1px solid var(--border)',
                }}
              >
                <Globe2 size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>
                  {t('settingsNotifications.languageTitle')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                  {t('settingsNotifications.languageDescription')}
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <button
                onClick={() => setLocale('th')}
                className="glass-interactive"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: `1px solid ${locale === 'th' ? 'var(--primary)' : 'var(--border)'}`,
                  background: locale === 'th' ? 'rgba(0,242,254,0.06)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>{t('common.thai')}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  {t('common.staffLanguageHint')}
                </div>
              </button>

              <button
                onClick={() => setLocale('en')}
                className="glass-interactive"
                style={{
                  padding: '16px',
                  borderRadius: '16px',
                  border: `1px solid ${locale === 'en' ? 'var(--primary)' : 'var(--border)'}`,
                  background: locale === 'en' ? 'rgba(0,242,254,0.06)' : 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>
                  {t('common.english')}
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  {t('common.staffLanguageHint')}
                </div>
              </button>
            </div>

            <div style={{ marginTop: '20px', fontSize: '12px' }}>
              <div style={{ fontWeight: '900' }}>{t('settingsNotifications.currentLanguage')}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                {locale === 'th' ? t('common.thai') : t('common.english')}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                className="flex-center"
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: 'rgba(255,171,0,0.08)',
                  color: 'var(--warning)',
                  border: '1px solid var(--border)',
                }}
              >
                <Bell size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>
                  {t('settingsNotifications.eventsTitle')}
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                  {t('settingsNotifications.eventsDescription')}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { id: 'new_ticket', label: t('settingsNotifications.eventNewTicket'), value: prefNewTicket },
                { id: 'new_message', label: t('settingsNotifications.eventNewMessage'), value: prefNewMessage },
                { id: 'transfer', label: t('settingsNotifications.eventTransfer'), value: prefTransfer },
                { id: 'sla_warning', label: t('settingsNotifications.eventSlaWarning'), value: prefSlaWarning },
              ].map((event) => (
                <div 
                  key={event.id}
                  className="glass-interactive"
                  onClick={() => updatePreference(event.id, !event.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderRadius: '16px',
                    border: '1px solid var(--border)',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: '14px', fontWeight: '600' }}>{event.label}</span>
                  <div 
                    style={{
                      width: '44px',
                      height: '24px',
                      borderRadius: '12px',
                      background: event.value ? 'var(--primary)' : 'var(--bg-input)',
                      position: 'relative',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div 
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: 'white',
                        position: 'absolute',
                        top: '2px',
                        left: event.value ? '22px' : '2px',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass" style={{ padding: '32px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', marginTop: 0, marginBottom: '6px' }}>
              {t('settingsNotifications.systemNotificationTitle')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', margin: 0 }}>
              {t('settingsNotifications.systemNotificationDescription')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '900' }}>{t('settingsNotifications.permissionStatus')}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{permissionLabel}</div>
            </div>
            <button
              onClick={requestNotificationPermission}
              className="glass-interactive"
              style={{
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                fontWeight: '800',
              }}
              title={t('settingsNotifications.requestPermission')}
            >
              {t('settingsNotifications.requestPermission')}
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', marginTop: 0 }}>
              {t('settingsNotifications.noteTitle')}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', marginBottom: 0 }}>
              {t('settingsNotifications.noteBody')}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
}
