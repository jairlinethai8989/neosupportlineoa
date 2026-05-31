/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { Zap } from 'lucide-react';

type TrendPoint = Record<string, string | number>;
type ChartDatum = { name: string; value: number; fill?: string };
type AgentDatum = { name: string; value: number };
type RecentLog = {
  action_type?: string;
  created_at?: string;
  note?: string;
  tickets?: { ticket_no?: string } | null;
};

const CHART_COLORS = {
  primary: '#00f2fe',
  success: '#28c76f',
  info: '#4facfe',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ fontSize: '13px', fontWeight: '800', color: p.color || 'var(--primary)' }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div
      style={{
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '12px 16px',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <p style={{ fontSize: '13px', fontWeight: '800', color: d.payload?.fill || 'white' }}>
        {d.name}: {d.value} ใบงาน
      </p>
    </div>
  );
};

type DashboardChartsSectionProps = {
  trendData: TrendPoint[];
  statusData: ChartDatum[];
  hospitalData: ChartDatum[];
  agentData: AgentDatum[];
  recentLogs: RecentLog[];
  totalAll: number;
  avgCsat: number;
  labels: {
    ticketTrend: string;
    newTickets: string;
    resolved: string;
    statusDistribution: string;
    allTab: string;
    priorityBreakdown: string;
    hospitalWorkload: string;
    agentWorkload: string;
    recentActivity: string;
    noResults: string;
    heatmapVolume?: string;
  };
  heatmapData?: number[][];
};

export function DashboardChartsSection({
  trendData,
  statusData,
  hospitalData,
  agentData,
  recentLogs,
  totalAll,
  avgCsat,
  labels,
  heatmapData = [],
}: DashboardChartsSectionProps) {
  
  // Helpers for Heatmap
  const DAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  
  const maxHeatmapValue = React.useMemo(() => {
    let max = 0;
    if (heatmapData && heatmapData.length === 7) {
      heatmapData.forEach(day => day.forEach(val => { if(val > max) max = val; }));
    }
    return max || 1;
  }, [heatmapData]);

  const getHeatmapColor = (value: number) => {
    if (value === 0) return 'rgba(255, 255, 255, 0.03)';
    const intensity = value / maxHeatmapValue;
    if (intensity <= 0.33) {
      return 'rgba(0, 242, 254, 0.3)'; // Electric Cyan for low density
    } else if (intensity <= 0.7) {
      return 'rgba(40, 199, 111, 0.6)'; // Neon Green for medium density
    } else {
      return 'rgba(255, 159, 67, 0.95)'; // Acid Orange/Gold for peak density
    }
  };

  const getHeatmapBorder = (value: number) => {
    if (value === 0) return '1px solid rgba(255, 255, 255, 0.05)';
    const intensity = value / maxHeatmapValue;
    if (intensity <= 0.33) return '1px solid rgba(0, 242, 254, 0.4)';
    if (intensity <= 0.7) return '1px solid rgba(40, 199, 111, 0.6)';
    return '1px solid rgba(255, 159, 67, 0.8)';
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.ticketTrend}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TICKET TREND</p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CHART_COLORS.primary }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{labels.newTickets}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CHART_COLORS.success }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{labels.resolved}</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey={labels.newTickets}
                  stroke="#ff9f43"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#ff9f43', strokeWidth: 2, stroke: '#0a0e14' }}
                  activeDot={{ r: 6, stroke: '#ff9f43', strokeWidth: 2, fill: '#0a0e14' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.statusDistribution}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>STATUS DISTRIBUTION</p>
            </div>
            {avgCsat > 0 && (
              <div style={{
                background: 'rgba(255, 159, 67, 0.15)',
                border: '1px solid rgba(255, 159, 67, 0.3)',
                color: '#ff9f43',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: '800',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>⭐ CSAT {avgCsat.toFixed(1)}</span>
              </div>
            )}
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} innerRadius={60} outerRadius={85} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', fontWeight: '900', lineHeight: 1 }}>{totalAll}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700', marginTop: '2px', textTransform: 'uppercase' }}>{labels.allTab}</p>
                  {avgCsat > 0 && (
                    <div style={{
                      marginTop: '6px',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: '#ff9f43',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '2px'
                    }}>
                      <span>⭐ {avgCsat.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{labels.noResults}</p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
            {statusData.map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.fill }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: '13px', fontWeight: '800' }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', marginBottom: '24px' }}>
        <div style={{ marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.heatmapVolume || 'ปริมาณใบงานรายชั่วโมง (Heatmap)'}</h2>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TICKET VOLUME BY DAY/HOUR</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowX: 'auto', paddingBottom: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, minmax(20px, 1fr))', gap: '4px', marginBottom: '4px' }}>
             <div />
             {Array.from({length: 24}).map((_, i) => {
               const isKeyLabel = i === 0 || i === 6 || i === 12 || i === 18;
               return (
                 <div 
                   key={`h-${i}`} 
                   style={{ 
                     fontSize: isKeyLabel ? '9px' : '10px', 
                     color: isKeyLabel ? 'var(--text-main)' : 'var(--text-muted)', 
                     fontWeight: isKeyLabel ? '800' : '400',
                     textAlign: 'center',
                     minWidth: '20px'
                   }}
                 >
                   {i === 0 && '00:00'}
                   {i === 6 && '06:00'}
                   {i === 12 && '12:00'}
                   {i === 18 && '18:00'}
                   {!isKeyLabel && '•'}
                 </div>
               );
             })}
          </div>
          {heatmapData && heatmapData.length === 7 ? DAYS_TH.map((dayName, dayIdx) => (
            <div key={`d-${dayIdx}`} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, minmax(20px, 1fr))', gap: '4px', alignItems: 'center' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>{dayName}</div>
              {heatmapData[dayIdx]?.map((val, hourIdx) => {
                const isWorkingHours = hourIdx >= 8 && hourIdx <= 18;
                const isPeak = val > 0 && (val / maxHeatmapValue) > 0.7;
                return (
                  <div
                    key={`cell-${dayIdx}-${hourIdx}`}
                    title={`${dayName} เวลา ${hourIdx.toString().padStart(2, '0')}:00 น. มี ${val} งาน${!isWorkingHours ? ' (นอกเวลาทำการ)' : ''}`}
                    style={{
                      height: '24px',
                      borderRadius: '6px',
                      background: getHeatmapColor(val),
                      border: getHeatmapBorder(val),
                      boxShadow: isPeak ? (isWorkingHours ? '0 0 10px rgba(255, 159, 67, 0.6)' : '0 0 5px rgba(255, 159, 67, 0.3)') : 'none',
                      opacity: isWorkingHours ? 1 : (val > 0 ? 0.45 : 0.15),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative'
                    }}
                    onMouseEnter={(e) => { 
                      e.currentTarget.style.transform = 'scale(1.15)'; 
                      e.currentTarget.style.zIndex = '10'; 
                      e.currentTarget.style.opacity = '1';
                      if (isPeak) e.currentTarget.style.boxShadow = '0 0 16px rgba(255, 159, 67, 0.9)';
                    }}
                    onMouseLeave={(e) => { 
                      e.currentTarget.style.transform = 'scale(1)'; 
                      e.currentTarget.style.zIndex = '1'; 
                      e.currentTarget.style.opacity = isWorkingHours ? '1' : (val > 0 ? '0.45' : '0.15');
                      if (isPeak) e.currentTarget.style.boxShadow = isWorkingHours ? '0 0 10px rgba(255, 159, 67, 0.6)' : '0 0 5px rgba(255, 159, 67, 0.3)';
                    }}
                  >
                     {val > 0 && (
                       <span style={{
                         fontSize: '9px', 
                         fontWeight: '800', 
                         color: (val / maxHeatmapValue) > 0.7 ? '#000' : 'var(--text-main)',
                         textShadow: (val / maxHeatmapValue) <= 0.7 ? '0 1px 2px rgba(0,0,0,0.8)' : 'none'
                       }}>
                         {val}
                       </span>
                     )}
                  </div>
                );
              })}
            </div>
          )) : (
            <div className="flex-center" style={{ height: '180px', color: 'var(--text-muted)', fontSize: '13px' }}>
              {labels.noResults}
            </div>
          )}
        </div>
        {/* Heatmap Legend */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center', marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '12px' }}>
          <span>น้อย (Less)</span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <div title="ไม่มีงาน" style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)' }} />
            <div title="หนาแน่นต่ำ (Electric Cyan)" style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(0, 242, 254, 0.3)', border: '1px solid rgba(0, 242, 254, 0.4)' }} />
            <div title="หนาแน่นปานกลาง (Neon Green)" style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(40, 199, 111, 0.6)', border: '1px solid rgba(40, 199, 111, 0.6)' }} />
            <div title="หนาแน่นสูง (Peak - Neon Orange)" style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'rgba(255, 159, 67, 0.95)', border: '1px solid rgba(255, 159, 67, 0.8)', boxShadow: '0 0 6px rgba(255, 159, 67, 0.6)' }} />
          </div>
          <span>มาก (Peak)</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Hospital Workload */}
          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.hospitalWorkload}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>HOSPITAL WORKLOAD</p>
            </div>
            <div style={{ flex: 1, minHeight: '320px' }}>
              {hospitalData.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart layout="vertical" data={hospitalData} margin={{ top: 5, right: 20, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" horizontal={false} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                      {hospitalData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex-center" style={{ height: '320px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  {labels.noResults}
                </div>
              )}
            </div>
          </div>

          {/* Agent Workload */}
          <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div style={{ marginBottom: '16px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.agentWorkload}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AGENT WORKLOAD • TOP 5</p>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center' }}>
              {agentData.length > 0 ? (
                agentData.map((agent, idx) => {
                  const maxVal = Math.max(...agentData.map((a) => a.value));
                  const pct = maxVal > 0 ? (agent.value / maxVal) * 100 : 0;
                  return (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ fontSize: '13px', fontWeight: '600' }}>{agent.name}</span>
                        <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>{agent.value}</span>
                      </div>
                      <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.info})`,
                            borderRadius: '4px',
                            transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>{labels.noResults}</p>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass" style={{ padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.recentActivity}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>RECENT ACTIVITY</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recentLogs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>{labels.noResults}</p>
            ) : (
              recentLogs.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '12px 0',
                    borderBottom: idx === recentLogs.length - 1 ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: 'rgba(0, 242, 254, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={14} color="var(--primary)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{log.tickets?.ticket_no} — {log.action_type}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
                      {log.note || 'อัปเดตสถานะอัตโนมัติ'}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
                        : '-'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
