'use client';

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import styles from './notifications.module.css';

export default function NotificationsLoading() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading notifications">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={200} height={28} borderRadius={6} />
          <Skeleton width={280} height={16} borderRadius={4} />
        </div>
        <Skeleton width={130} height={34} borderRadius={8} />
      </div>

      <div className={styles.grid}>
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} width="100%" height={68} borderRadius={8} />
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Skeleton width="100%" height={180} borderRadius={12} />
          <Skeleton width="100%" height={140} borderRadius={12} />
        </div>
      </div>
    </div>
  );
}
