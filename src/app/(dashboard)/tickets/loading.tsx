'use client';

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import styles from './tickets-workspace.module.css';

export default function TicketsLoading() {
  return (
    <div className={styles.workspacePage} aria-busy="true" aria-label="Loading tickets">
      <div className={styles.headerTop}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <Skeleton width={220} height={28} borderRadius={6} />
          <Skeleton width={320} height={16} borderRadius={4} />
        </div>
        <Skeleton width={160} height={36} borderRadius={8} />
      </div>

      <div className={styles.toolbarRow}>
        <Skeleton width={260} height={36} borderRadius={8} />
        <Skeleton width={260} height={36} borderRadius={8} />
      </div>

      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} width="100%" height={48} borderRadius={8} />
        ))}
      </div>
    </div>
  );
}
