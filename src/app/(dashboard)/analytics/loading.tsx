'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import { Card, CardBody } from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

export default function AnalyticsLoading() {
  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Skeleton width={260} height={32} marginBottom={8} />
          <Skeleton width={200} height={16} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Skeleton width={120} height={36} borderRadius={8} />
          <Skeleton width={120} height={36} borderRadius={8} />
        </div>
      </div>

      <Skeleton width={140} height={36} borderRadius={8} />

      <div className={styles.widgetGrid}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i}>
            <CardBody>
              <Skeleton width="45%" height={20} marginBottom={16} />
              <Skeleton width="100%" height={240} />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
