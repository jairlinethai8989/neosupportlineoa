'use client';
import React from 'react';
import { Loader2 } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: '60vh',
        width: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <Loader2 className="animate-spin" color="var(--primary)" size={40} />
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '600' }}>
          กำลังโหลด...
        </p>
      </div>
    </div>
  );
}
