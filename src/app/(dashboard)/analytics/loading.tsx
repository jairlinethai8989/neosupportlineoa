'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export default function AnalyticsLoading() {
  return (
    <div className="animate-page-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <Skeleton width="50%" height={36} marginBottom={8} />
          <Skeleton width="40%" height={16} />
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
           <Skeleton width={260} height={42} borderRadius={12} />
           <div style={{ display: 'flex', gap: '8px' }}>
              <Skeleton width={100} height={42} borderRadius={12} />
              <Skeleton width={100} height={42} borderRadius={12} />
           </div>
        </div>
      </div>

      <Skeleton width={200} height={36} borderRadius={20} marginBottom={32} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
           <div key={i} className="glass" style={{ height: '340px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Skeleton width={32} height={32} borderRadius={8} />
                <Skeleton width={150} height={20} />
             </div>
             <Skeleton width={60} height={26} borderRadius={8} />
          </div>
          <div style={{ flex: 1, padding: '20px' }}>
             <Skeleton width="100%" height="80%" marginBottom={16} />
             <div style={{ display: 'flex', gap: '8px' }}>
                <Skeleton width={80} height={20} />
                <Skeleton width={80} height={20} />
             </div>
          </div>
       </div>
        ))}
      </div>
    </div>
  );
}
