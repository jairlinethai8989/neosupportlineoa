'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import { Card, CardBody } from '@/components/ui';
import styles from '@/components/reports/reports.module.css';

export default function CustomersLoading() {
  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Skeleton width={260} height={32} marginBottom={8} />
          <Skeleton width={220} height={16} />
        </div>
        <Skeleton width={40} height={36} borderRadius={8} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody>
              <Skeleton width="45%" height={12} marginBottom={10} />
              <Skeleton width="55%" height={28} />
            </CardBody>
          </Card>
        ))}
      </div>

      <Card>
        <CardBody>
          <Skeleton width="100%" height={40} borderRadius={8} marginBottom={16} />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} width="100%" height={56} borderRadius={8} marginBottom={10} />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
