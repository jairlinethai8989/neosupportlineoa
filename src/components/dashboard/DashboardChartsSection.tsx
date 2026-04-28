'use client';

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
  priorityData: ChartDatum[];
  agentData: AgentDatum[];
  recentLogs: RecentLog[];
  totalAll: number;
  labels: {
    ticketTrend: string;
    newTickets: string;
    resolved: string;
    statusDistribution: string;
    allTab: string;
    priorityBreakdown: string;
    agentWorkload: string;
    recentActivity: string;
    noResults: string;
  };
};

export function DashboardChartsSection({
  trendData,
  statusData,
  priorityData,
  agentData,
  recentLogs,
  totalAll,
  labels,
}: DashboardChartsSectionProps) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.ticketTrend}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TICKET TREND • Last 7 Days</p>
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
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={labels.newTickets}
                  stroke={CHART_COLORS.primary}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradNew)"
                  dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#0a0e14' }}
                  activeDot={{ r: 6, stroke: CHART_COLORS.primary, strokeWidth: 2, fill: '#0a0e14' }}
                />
                <Area
                  type="monotone"
                  dataKey={labels.resolved}
                  stroke={CHART_COLORS.success}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradResolved)"
                  dot={{ r: 4, fill: CHART_COLORS.success, strokeWidth: 2, stroke: '#0a0e14' }}
                  activeDot={{ r: 6, stroke: CHART_COLORS.success, strokeWidth: 2, fill: '#0a0e14' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.statusDistribution}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>STATUS DISTRIBUTION</p>
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
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', fontWeight: '900' }}>{totalAll}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>{labels.allTab}</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.priorityBreakdown}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>PRIORITY BREAKDOWN</p>
          </div>
          <div style={{ flex: 1, minHeight: '220px' }}>
            {priorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={priorityData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-center" style={{ height: '220px', color: 'var(--text-muted)', fontSize: '13px' }}>
                {labels.noResults}
              </div>
            )}
          </div>
        </div>

        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{labels.agentWorkload}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AGENT WORKLOAD • TOP 5</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
            {agentData.length > 0 ? (
              agentData.map((agent, idx) => {
                const maxVal = Math.max(...agentData.map((a) => a.value));
                const pct = maxVal > 0 ? (agent.value / maxVal) * 100 : 0;
                return (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600' }}>{agent.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{agent.value}</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.info})`,
                          borderRadius: '3px',
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
                    padding: '10px 0',
                    borderBottom: idx === recentLogs.length - 1 ? 'none' : '1px solid var(--border)',
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'start',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(0, 242, 254, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Zap size={12} color="var(--primary)" />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      #{log.tickets?.ticket_no} — {log.action_type}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.note || 'อัปเดตสถานะอัตโนมัติ'}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
