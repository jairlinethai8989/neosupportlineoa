import React from 'react';

interface HeatmapProps {
  data: {
    dayOfWeek: number;
    hourOfDay: number;
    count: number;
  }[];
}

const DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์'];

export default function ActivityHeatmap({ data }: HeatmapProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // Helper to get color intensity
  const getColor = (count: number) => {
    if (count === 0) return 'var(--bg-card)';
    const intensity = Math.min(count / maxCount, 1);
    
    // Base blue: #3b82f6 (59, 130, 246)
    // Dark mode bg (var(--bg-card)) is usually very dark e.g. #1e293b
    // Let's use a nice primary color with varying opacity
    return `rgba(6, 182, 212, ${intensity * 0.8 + 0.2})`;
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ minWidth: '800px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {/* Hours header */}
        <div style={{ display: 'flex', marginLeft: '60px' }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)' }}>
              {i.toString().padStart(2, '0')}
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '60px', fontSize: '12px', color: 'var(--text-main)', fontWeight: '500' }}>
              {day}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: '2px' }}>
              {Array.from({ length: 24 }).map((_, hourIdx) => {
                const cellData = data.find(
                  (d) => d.dayOfWeek === dayIdx && d.hourOfDay === hourIdx
                );
                const count = cellData?.count || 0;

                return (
                  <div
                    key={hourIdx}
                    title={`${day} ${hourIdx}:00 - ${count} เคส`}
                    style={{
                      flex: 1,
                      height: '24px',
                      borderRadius: '4px',
                      background: getColor(count),
                      cursor: 'pointer',
                      transition: 'transform 0.2s, filter 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'scale(1.2)';
                      e.currentTarget.style.filter = 'brightness(1.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.filter = 'none';
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}
        
        {/* Legend */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '16px', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>น้อย</span>
          <div style={{ display: 'flex', gap: '2px' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'var(--bg-card)' }}></div>
            <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'rgba(6, 182, 212, 0.4)' }}></div>
            <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'rgba(6, 182, 212, 0.7)' }}></div>
            <div style={{ width: '16px', height: '16px', borderRadius: '2px', background: 'rgba(6, 182, 212, 1)' }}></div>
          </div>
          <span>มาก</span>
        </div>
      </div>
    </div>
  );
}
