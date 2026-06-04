'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export default function CustomersLoading() {
  return (
    <div className="animate-page-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Skeleton width={200} height={32} marginBottom={8} />
          <Skeleton width={300} height={16} />
        </div>
        <Skeleton width={120} height={40} borderRadius={12} />
      </div>

      {/* Toolbar / Filters */}
      <div className="glass" style={{ padding: '16px', borderRadius: '16px', marginBottom: '24px', display: 'flex', gap: '16px' }}>
         <Skeleton width={150} height={36} borderRadius={8} />
         <Skeleton width={150} height={36} borderRadius={8} />
         <Skeleton width={150} height={36} borderRadius={8} />
      </div>

      {/* Content Area */}
      <div className="glass" style={{ padding: '24px', borderRadius: '16px', minHeight: '400px' }}>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="100%" height={60} borderRadius={8} />
            <Skeleton width="100%" height={60} borderRadius={8} />
            <Skeleton width="100%" height={60} borderRadius={8} />
            <Skeleton width="100%" height={60} borderRadius={8} />
            <Skeleton width="100%" height={60} borderRadius={8} />
         </div>
      </div>
    </div>
  );
}
