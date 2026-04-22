'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { ChevronLeft, Volume2, VolumeX, Bell, Play } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';

export default function NotificationSettingsPage() {
  const { isMuted, toggleMute, soundMode, setSoundMode, testSound } = useNotificationContext();

  const isSoundEnabled = !isMuted;

  const setSoundEnabled = (enabled: boolean) => {
    if (enabled === isSoundEnabled) return;
    toggleMute();
  };

  const soundModeLabel = useMemo(() => {
    if (soundMode === 'voice') return 'เสียงพูด: "มีใบงานใหม่"';
    return 'เสียง Beep';
  }, [soundMode]);

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
                  เปิดหรือปิดเสียง และเลือกประเภทเสียงที่ต้องการ
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
                เสถียรที่สุด เหมาะกับทุกเครื่อง
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
              <div style={{ fontSize: '13px', fontWeight: '900', marginBottom: '6px' }}>เสียงพูด</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.5' }}>
                พูดว่า &quot;มีใบงานใหม่&quot; และถ้าระบบไม่รองรับจะ fallback เป็น beep
              </div>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '20px' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '900' }}>โหมดปัจจุบัน</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {isSoundEnabled ? soundModeLabel : 'ปิดเสียงแจ้งเตือน'}
              </div>
            </div>
            <button
              onClick={testSound}
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

        <div className="glass" style={{ padding: '24px', height: 'fit-content' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '900', marginTop: 0 }}>หมายเหตุ</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '12px', lineHeight: '1.7', marginBottom: 0 }}>
            บางเบราว์เซอร์จะไม่อนุญาตให้เล่นเสียงหรือพูดจนกว่าผู้ใช้จะกดเปิดเสียงอย่างน้อย 1 ครั้ง
            หากเลือกเสียงพูดแล้วเครื่องไม่รองรับ ระบบจะใช้เสียง beep แทนโดยอัตโนมัติ
          </p>
        </div>
      </div>
    </div>
  );
}
