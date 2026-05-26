'use client';

import React from 'react';

type HeatmapDataPoint = {
  day: number; // 0 (Sun) - 6 (Sat)
  hour: number; // 0 - 23
  value: number;
};

interface ActivityHeatmapProps {
  data: HeatmapDataPoint[];
}

const DAYS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  // Create a 7x24 matrix
  const matrix = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  let maxVal = 0;

  data.forEach((d) => {
    matrix[d.day][d.hour] = d.value;
    if (d.value > maxVal) maxVal = d.value;
  });

  const getColor = (value: number) => {
    if (value === 0) return 'bg-white/5 border border-white/10';
    const intensity = Math.max(0.2, value / maxVal);
    // Use a neon cyan/blue scale for HUD style
    return `bg-cyan-500 border border-cyan-400 opacity-${Math.round(intensity * 100)}`;
  };

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="min-w-[800px]">
        <div className="flex mb-2">
          <div className="w-12 flex-shrink-0"></div>
          {HOURS.map((h) => (
            <div key={h} className="flex-1 text-center text-xs text-white/50">
              {h.toString().padStart(2, '0')}
            </div>
          ))}
        </div>
        
        <div className="flex flex-col gap-1">
          {DAYS.map((day, dIdx) => (
            <div key={day} className="flex items-center gap-1">
              <div className="w-12 text-sm text-white/70 font-medium text-right pr-2">
                {day}
              </div>
              {HOURS.map((h) => {
                const val = matrix[dIdx][h];
                const bgClass = getColor(val);
                return (
                  <div
                    key={`${day}-${h}`}
                    className={`flex-1 aspect-square rounded-sm ${val > 0 ? 'bg-cyan-500' : 'bg-white/5 border border-white/10'} relative group cursor-pointer transition-all hover:ring-1 hover:ring-white`}
                    style={{
                      opacity: val === 0 ? 1 : Math.max(0.3, val / (maxVal || 1))
                    }}
                    title={`${day} เวลา ${h}:00 น. - ${val} รายการ`}
                  >
                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-xs rounded border border-white/20 whitespace-nowrap z-10 pointer-events-none">
                      {val} ใบงาน
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="flex justify-end items-center gap-2 mt-4 text-xs text-white/50">
          <span>น้อย</span>
          <div className="w-3 h-3 rounded-sm bg-white/5 border border-white/10"></div>
          <div className="w-3 h-3 rounded-sm bg-cyan-500" style={{ opacity: 0.4 }}></div>
          <div className="w-3 h-3 rounded-sm bg-cyan-500" style={{ opacity: 0.7 }}></div>
          <div className="w-3 h-3 rounded-sm bg-cyan-500" style={{ opacity: 1 }}></div>
          <span>มาก</span>
        </div>
      </div>
    </div>
  );
}
