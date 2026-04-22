'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bell, ChevronLeft, Play, Volume2, VolumeX } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';

type NotifPermission = 'unsupported' | NotificationPermission;

export default function NotificationSettingsPage() {
  const {
    isMuted,
    toggleMute,
    soundMode,
    soundVoice,
    setSoundMode,
    setSoundVoice,
    testSound,
    addToast,
  } = useNotificationContext();

  const [permission, setPermission] = useState<NotifPermission>(() => {
    if (typeof window === 'undefined') return 'unsupported';
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const isSoundEnabled = !isMuted;

  const setSoundEnabled = (enabled: boolean) => {
    if (enabled === isSoundEnabled) return;
    toggleMute();
  };

  const soundModeLabel = useMemo(() => {
    if (soundMode === 'voice') {
      return soundVoice === 'female' ? 'เสียงพูดผู้หญิง' : 'เสียงพูดผู้ชาย';
    }
    return 'เสียง Beep';
  }, [soundMode, soundVoice]);

  const pushToast = (title: string, body: string, duration = 9000) => {
    addToast({
      id: `settings-toast-${Date.now()}`,
      type: 'ticket',
      title,
      body,
      duration,
    });
  };

  const onTestSound = async () => {
    const result = await testSound();
    if (result.ok) {
      pushToast('ทดสอบเสียงแล้ว', result.hint);
      return;
    }

    pushToast('เล่นเสียงไม่สำเร็จ', `${result.detail} • ${result.hint}`, 12000);
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      pushToast('อุปกรณ์นี้ไม่รองรับ Notification', 'เบราว์เซอร์หรืออุปกรณ์นี้ไม่รองรับการแจ้งเตือนของระบบ');
      return;
    }

    try {
      const next = await Notification.requestPermission();
      setPermission(next);

      if (next === 'granted') {
        pushToast('อนุญาต Notification แล้ว', 'ระบบสามารถแสดงการแจ้งเตือนของระบบ (เด้งมุมจอ) ได้', 8000);
        return;
      }

      if (next === 'denied') {
        pushToast(
          'ถูกปฏิเสธ Notification',
          'ถ้าต้องการเปิด ให้ไปที่ Site settings ของเบราว์เซอร์แล้วตั้งเป็น Allow',
          12000
        );
        return;
      }

      pushToast(
        'ยังไม่ได้อนุญาต Notification',
        'คุณสามารถกดขออนุญาตอีกครั้งได้ภายหลัง หรือเปิดจาก Site settings',
        10000
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      pushToast('ขออนุญาต Notification ไม่สำเร็จ', msg, 12000);
    }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/settings/profile" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={24} />
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>ตั้งค่าการแจ้งเตือน</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="glass" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
                <h2 style={{ fontSize: '18px', fontWeight: '850', margin: 0 }}>เสียงแจ้งเตือนใบงานใหม่</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                  เปิดหรือปิดเสียง เลือกโหมดเสียง และเลือกไฟล์เสียงชายหรือหญิงได้ในหน้าเดียว
                </p>
              </div>
            </div>

            <button
              onClick={() => setSoundEnabled(!isSoundEnabled)}
              className="glass-interactive flex-center"
              title={isSoundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
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
              <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>เสียง Beep</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                เสถียรที่สุดและเหมาะกับทุกเครื่อง
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
              <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>เสียงพูดจากไฟล์ MP3</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                เสถียรกว่า TTS ใน Chrome และเลือกเสียงผู้หญิงหรือผู้ชายได้
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
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>เสียงผู้หญิง</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  ใช้ไฟล์ `new-ticket-female.mp3`
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
                <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>เสียงผู้ชาย</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                  ใช้ไฟล์ `new-ticket-male.mp3`
                </div>
              </button>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '900' }}>โหมดปัจจุบัน</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isSoundEnabled ? soundModeLabel : 'ปิดเสียงแจ้งเตือน'}
              </div>
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
              title="ทดสอบเสียง"
            >
              <Play size={16} /> ทดสอบเสียง
            </button>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: '900', marginTop: 0, marginBottom: '6px' }}>Notification ของระบบ</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', margin: 0 }}>
              ใช้สำหรับการเด้งแจ้งเตือนของระบบ เช่น มุมขวาล่าง และไม่จำเป็นสำหรับการเล่นเสียง
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '900' }}>สถานะสิทธิ์</div>
              <div style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                {permission === 'unsupported' ? 'ไม่รองรับ' : permission}
              </div>
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
              title="ขออนุญาต Notification"
            >
              ขออนุญาต
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '900', marginTop: 0 }}>หมายเหตุ</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', marginBottom: 0 }}>
              ถ้าเลือกโหมดเสียงพูด ระบบจะเล่นไฟล์ MP3 ที่ฝังไว้แทน TTS เพื่อให้ Chrome, Edge และเบราว์เซอร์อื่นมีพฤติกรรมใกล้เคียงกันมากที่สุด
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
