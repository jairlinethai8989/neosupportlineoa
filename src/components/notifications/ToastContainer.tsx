'use client';
import React from 'react';
import ToastItem from './ToastItem';
import { useNotificationContext } from '@/contexts/NotificationContext';

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotificationContext();

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="การแจ้งเตือน"
      style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: 'auto' }}>
          <ToastItem toast={toast} onDismiss={dismissToast} />
        </div>
      ))}
    </div>
  );
}
