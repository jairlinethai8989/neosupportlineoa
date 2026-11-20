'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import { Card, CardBody } from '@/components/ui';
import styles from '@/components/reports/reports.module.css';

export default function DailyReportLoading() {
  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Skeleton width={220} height={32} marginBottom={8} />
          <Skeleton width={300} height={16} />
        </div>
        <Skeleton width={200} height={36} borderRadius={8} />
      </div>

      <Card>
        <CardBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} width="100%" height={48} borderRadius={8} />
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
