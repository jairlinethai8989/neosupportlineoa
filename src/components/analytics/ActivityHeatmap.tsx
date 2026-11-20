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

  const getColor = (count: number) => {
    if (count === 0) return 'var(--color-surface-subtle)';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity <= 0.35) return 'rgba(29, 78, 216, 0.22)';
    if (intensity <= 0.7) return 'rgba(13, 148, 136, 0.45)';
    return '#1D4ED8';
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ minWidth: '720px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', marginLeft: '64px' }}>
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '11px',
                color: 'var(--color-text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {i.toString().padStart(2, '0')}
            </div>
          ))}
        </div>

        {DAYS.map((day, dayIdx) => (
          <div key={day} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '64px', fontSize: '12px', color: 'var(--color-text)', fontWeight: 500 }}>
              {day}
            </div>
            <div style={{ display: 'flex', flex: 1, gap: '3px' }}>
              {Array.from({ length: 24 }).map((_, hourIdx) => {
                const cellData = data.find(
                  (d) => d.dayOfWeek === dayIdx && d.hourOfDay === hourIdx
                );
                const count = cellData?.count || 0;

                return (
                  <div
                    key={hourIdx}
                    title={`${day} ${hourIdx}:00 — ${count} เคส`}
                    style={{
                      flex: 1,
                      height: '24px',
                      borderRadius: '4px',
                      background: getColor(count),
                      border: '1px solid var(--color-border)',
                    }}
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            marginTop: '12px',
            gap: '8px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
          }}
        >
          <span>น้อย</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--color-surface-subtle)', border: '1px solid var(--color-border)' }} />
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(29, 78, 216, 0.22)', border: '1px solid var(--color-border)' }} />
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(13, 148, 136, 0.45)', border: '1px solid var(--color-border)' }} />
            <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: '#1D4ED8', border: '1px solid var(--color-border)' }} />
          </div>
          <span>มาก</span>
        </div>
      </div>
    </div>
  );
}
