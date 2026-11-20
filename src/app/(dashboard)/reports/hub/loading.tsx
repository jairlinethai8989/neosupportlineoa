'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';
import { Card, CardBody } from '@/components/ui';
import styles from '@/components/reports/reports.module.css';

export default function ReportsHubLoading() {
  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Skeleton width={220} height={32} marginBottom={8} />
          <Skeleton width={300} height={16} />
        </div>
        <Skeleton width={160} height={36} borderRadius={8} />
      </div>

      <div className={styles.hubGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card>
            <CardBody>
              <Skeleton width="40%" height={20} marginBottom={16} />
              <div className={styles.summaryStrip}>
                <Skeleton width="100%" height={72} borderRadius={8} />
                <Skeleton width="100%" height={72} borderRadius={8} />
                <Skeleton width="100%" height={72} borderRadius={8} />
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Skeleton width="35%" height={20} marginBottom={16} />
              <Skeleton width="100%" height={200} borderRadius={8} />
            </CardBody>
          </Card>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card>
            <CardBody>
              <Skeleton width="100%" height={240} borderRadius={8} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
