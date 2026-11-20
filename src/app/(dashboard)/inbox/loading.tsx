'use client';

import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import styles from '@/components/inbox/inbox.module.css';

export default function InboxLoading() {
  return (
    <div className={styles.workspace} aria-busy="true" aria-label="Loading inbox">
      <div className={styles.queuePane} style={{ padding: '16px', gap: '12px' }}>
        <Skeleton width="100%" height={34} borderRadius={8} />
        <Skeleton width="100%" height={30} borderRadius={8} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} width="100%" height={68} borderRadius={8} />
          ))}
        </div>
      </div>

      <div className={styles.threadPane}>
        <div className={styles.threadHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Skeleton width={34} height={34} borderRadius={8} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <Skeleton width={140} height={14} borderRadius={4} />
              <Skeleton width={90} height={12} borderRadius={4} />
            </div>
          </div>
          <Skeleton width={100} height={32} borderRadius={8} />
        </div>

        <div className={styles.messagesStream} style={{ justifyContent: 'flex-end' }}>
          <Skeleton width="55%" height={54} borderRadius={12} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Skeleton width="42%" height={44} borderRadius={12} />
          </div>
          <Skeleton width="48%" height={64} borderRadius={12} />
        </div>

        <div className={styles.composerArea}>
          <Skeleton width="100%" height={44} borderRadius={8} />
        </div>
      </div>
    </div>
  );
}
