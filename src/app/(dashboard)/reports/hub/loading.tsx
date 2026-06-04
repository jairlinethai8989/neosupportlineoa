'use client';
import React from 'react';
import Skeleton from '@/components/ui/Skeleton';

export default function ReportsHubLoading() {
  return (
    <div className="animate-page-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <Skeleton width={200} height={32} marginBottom={8} />
          <Skeleton width={300} height={16} />
        </div>
      </div>

      {/* Grid of Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
           <div key={i} className="glass" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Skeleton width={48} height={48} borderRadius={12} />
                 <div>
                    <Skeleton width={150} height={20} marginBottom={4} />
                    <Skeleton width={100} height={14} />
                 </div>
              </div>
              <Skeleton width="100%" height={60} borderRadius={8} />
              <Skeleton width="100%" height={36} borderRadius={8} />
           </div>
        ))}
      </div>
    </div>
  );
}
