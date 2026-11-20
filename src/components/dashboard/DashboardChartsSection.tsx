'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
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
import { AlertTriangle, Clock, Star, Zap } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui';
import styles from './dashboard.module.css';

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
  primary: '#1D4ED8',
  success: '#059669',
  info: '#0284C7',
  teal: '#0D9488',
  warning: '#D97706',
  danger: '#DC2626',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.chartTooltip}>
      <p className={styles.chartTooltipLabel}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className={styles.chartTooltipValue} style={{ color: p.color || CHART_COLORS.primary }}>
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
    <div className={styles.chartTooltip}>
      <p className={styles.chartTooltipValue} style={{ color: d.payload?.fill || 'var(--color-text)' }}>
        {d.name}: {d.value}
      </p>
    </div>
  );
};

type DashboardChartsSectionProps = {
  trendData: TrendPoint[];
  statusData: ChartDatum[];
  organizationData: ChartDatum[];
  agentData: AgentDatum[];
  recentLogs: RecentLog[];
  totalAll: number;
  avgCsat: number;
  escalatedCount?: number;
  pendingCount?: number;
  labels: {
    ticketTrend: string;
    newTickets: string;
    resolved: string;
    statusDistribution: string;
    allTab: string;
    priorityBreakdown: string;
    organizationWorkload: string;
    agentWorkload: string;
    recentActivity: string;
    noResults: string;
    heatmapVolume?: string;
    urgentQueue?: string;
    escalated?: string;
    pending?: string;
  };
  heatmapData?: number[][];
};

export function DashboardChartsSection({
  trendData,
  statusData,
  organizationData,
  agentData,
  recentLogs,
  totalAll,
  avgCsat,
  escalatedCount = 0,
  pendingCount = 0,
  labels,
  heatmapData = [],
}: DashboardChartsSectionProps) {
  const DAYS_TH = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

  const maxHeatmapValue = React.useMemo(() => {
    let max = 0;
    if (heatmapData && heatmapData.length === 7) {
      heatmapData.forEach((day) =>
        day.forEach((val) => {
          if (val > max) max = val;
        })
      );
    }
    return max || 1;
  }, [heatmapData]);

  const getHeatmapStyle = (value: number, isWorkingHours: boolean): React.CSSProperties => {
    if (value === 0) {
      return {
        background: isWorkingHours ? 'var(--color-surface-subtle)' : 'var(--color-canvas)',
        color: 'var(--color-text-muted)',
      };
    }

    const intensity = value / maxHeatmapValue;
    if (!isWorkingHours) {
      if (intensity <= 0.33) {
        return { background: 'rgba(71, 85, 105, 0.16)', color: 'var(--color-text)' };
      }
      if (intensity <= 0.7) {
        return { background: 'rgba(71, 85, 105, 0.32)', color: 'var(--color-text)' };
      }
      return { background: 'rgba(71, 85, 105, 0.55)', color: '#ffffff' };
    }

    if (intensity <= 0.33) {
      return { background: 'rgba(29, 78, 216, 0.16)', color: 'var(--color-primary)' };
    }
    if (intensity <= 0.7) {
      return { background: 'rgba(13, 148, 136, 0.35)', color: 'var(--color-text)' };
    }
    return { background: '#D97706', color: '#ffffff' };
  };

  return (
    <div className={styles.asymmetricGrid}>
      {/* Left 65% (8fr): Primary Analytics */}
      <div className={styles.columnStack}>
        {/* Ticket Trend */}
        <Card>
          <CardHeader
            actions={
              <div className={styles.legendRow}>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: CHART_COLORS.primary }} />
                  {labels.newTickets}
                </span>
                <span className={styles.legendItem}>
                  <span className={styles.legendDot} style={{ background: CHART_COLORS.success }} />
                  {labels.resolved}
                </span>
              </div>
            }
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.ticketTrend}
            </h2>
          </CardHeader>
          <CardBody>
            {trendData.length > 0 ? (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={trendData} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="label" stroke="var(--color-text-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="var(--color-text-subtle)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey={labels.newTickets} fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} barSize={14} />
                    <Bar dataKey={labels.resolved} fill={CHART_COLORS.success} radius={[4, 4, 0, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact title={labels.noResults} />
            )}
          </CardBody>
        </Card>

        {/* Organization Workload */}
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.organizationWorkload}
            </h2>
          </CardHeader>
          <CardBody>
            {organizationData.length > 0 ? (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart layout="vertical" data={organizationData} margin={{ top: 4, right: 20, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                    <XAxis type="number" stroke="var(--color-text-subtle)" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" fontSize={12} tickLine={false} axisLine={false} width={130} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {organizationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS.primary} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState compact title={labels.noResults} />
            )}
          </CardBody>
        </Card>

        {/* Hourly Heatmap */}
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.heatmapVolume || 'ปริมาณใบงานรายชั่วโมง'}
            </h2>
          </CardHeader>
          <CardBody>
            {heatmapData && heatmapData.length === 7 ? (
              <div className={styles.heatmapWrap}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div className={styles.heatmapGridRow}>
                    <div />
                    {Array.from({ length: 24 }).map((_, i) => {
                      const isWorkHour = i >= 8 && i <= 18;
                      const labelText = i % 3 === 0 || i === 8 || i === 18 ? String(i).padStart(2, '0') : '';
                      return (
                        <div
                          key={`h-${i}`}
                          className={`${styles.heatmapHourHeader} ${isWorkHour ? styles.heatmapHourWork : ''}`}
                        >
                          {labelText}
                        </div>
                      );
                    })}
                  </div>

                  {DAYS_TH.map((dayName, dayIdx) => (
                    <div key={`d-${dayIdx}`} className={styles.heatmapGridRow}>
                      <div className={styles.heatmapDayLabel}>{dayName}</div>
                      {heatmapData[dayIdx]?.map((val, hourIdx) => {
                        const isWorkingHours = hourIdx >= 8 && hourIdx <= 18;
                        const cellStyle = getHeatmapStyle(val, isWorkingHours);
                        const edgeClass =
                          hourIdx === 8
                            ? styles.heatmapWorkStart
                            : hourIdx === 18
                              ? styles.heatmapWorkEnd
                              : '';

                        return (
                          <div
                            key={`cell-${dayIdx}-${hourIdx}`}
                            title={`${dayName} ${hourIdx.toString().padStart(2, '0')}:00 — ${val} งาน${isWorkingHours ? ' (เวลาทำการ)' : ' (นอกเวลาทำการ)'}`}
                            className={`${styles.heatmapCell} ${edgeClass}`}
                            style={cellStyle}
                          >
                            {val > 0 ? val : ''}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                <div className={styles.heatmapLegend}>
                  <span>น้อย</span>
                  <span className={styles.heatmapSwatch} style={{ background: 'var(--color-surface-subtle)' }} title="0" />
                  <span className={styles.heatmapSwatch} style={{ background: 'rgba(29, 78, 216, 0.16)' }} title="ต่ำ" />
                  <span className={styles.heatmapSwatch} style={{ background: 'rgba(13, 148, 136, 0.35)' }} title="ปานกลาง" />
                  <span className={styles.heatmapSwatch} style={{ background: '#D97706' }} title="สูง" />
                  <span>มาก</span>
                </div>
              </div>
            ) : (
              <EmptyState compact title={labels.noResults} />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Right 35% (4fr): Urgent Queue, Status Distribution, Agent Workload & Recent Activity */}
      <div className={styles.columnStack}>
        {/* Urgent Queue */}
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.urgentQueue || 'คิวงานเร่งด่วน'}
            </h2>
          </CardHeader>
          <CardBody compact>
            <div className={styles.urgentGrid}>
              <Link href="/tickets?status=Escalated" className={styles.urgentTile}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.urgentTileLabel}>{labels.escalated || 'ส่งต่อ (Escalated)'}</span>
                  <AlertTriangle size={16} color="var(--color-danger)" aria-hidden="true" />
                </div>
                <span className={styles.urgentTileValue} style={{ color: 'var(--color-danger)' }}>
                  {escalatedCount}
                </span>
              </Link>
              <Link href="/tickets?status=Pending" className={styles.urgentTile}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={styles.urgentTileLabel}>{labels.pending || 'รอดำเนินการ'}</span>
                  <Clock size={16} color="var(--color-warning)" aria-hidden="true" />
                </div>
                <span className={styles.urgentTileValue} style={{ color: 'var(--color-warning)' }}>
                  {pendingCount}
                </span>
              </Link>
            </div>
          </CardBody>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader
            actions={
              avgCsat > 0 ? (
                <Badge variant="warning" size="sm">
                  <Star size={12} aria-hidden="true" />
                  CSAT {avgCsat.toFixed(1)}
                </Badge>
              ) : null
            }
          >
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.statusDistribution}
            </h2>
          </CardHeader>
          <CardBody>
            {statusData.length > 0 ? (
              <>
                <div className={styles.donutContainer}>
                  <ResponsiveContainer width="100%" height={210}>
                    <PieChart>
                      <Pie
                        data={statusData}
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={3}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill || CHART_COLORS.primary} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className={styles.donutCenter}>
                    <p className={styles.donutTotal}>{totalAll}</p>
                    <p className={styles.donutSub}>{labels.allTab}</p>
                  </div>
                </div>
                <div className={styles.statusList}>
                  {statusData.map((item, i) => (
                    <div key={i} className={styles.statusRow}>
                      <span className={styles.legendItem}>
                        <span className={styles.legendDot} style={{ background: item.fill }} />
                        {item.name}
                      </span>
                      <span className={styles.statusCount}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState compact title={labels.noResults} />
            )}
          </CardBody>
        </Card>

        {/* Agent Workload Top 5 */}
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.agentWorkload}
            </h2>
          </CardHeader>
          <CardBody>
            {agentData.length > 0 ? (
              <div className={styles.agentList}>
                {agentData.map((agent, idx) => {
                  const maxVal = Math.max(...agentData.map((a) => a.value), 1);
                  const pct = (agent.value / maxVal) * 100;
                  return (
                    <div key={idx}>
                      <div className={styles.agentHeader}>
                        <span className={styles.agentName}>{agent.name}</span>
                        <span className={styles.agentCount}>{agent.value}</span>
                      </div>
                      <div className={styles.progressTrack}>
                        <div className={styles.progressFill} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState compact title={labels.noResults} />
            )}
          </CardBody>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.3 }}>
              {labels.recentActivity}
            </h2>
          </CardHeader>
          <CardBody>
            {recentLogs.length === 0 ? (
              <EmptyState compact title={labels.noResults} />
            ) : (
              <div className={styles.activityList}>
                {recentLogs.map((log, idx) => (
                  <div key={idx} className={styles.activityItem}>
                    <div className={styles.activityIcon} aria-hidden="true">
                      <Zap size={14} />
                    </div>
                    <div className={styles.activityBody}>
                      <p className={styles.activityTitle}>
                        <span className="mono">#{log.tickets?.ticket_no || '-'}</span> — {log.action_type}
                      </p>
                      <p className={styles.activityNote}>{log.note || 'อัปเดตสถานะอัตโนมัติ'}</p>
                      <p className={styles.activityTime}>
                        {log.created_at
                          ? new Date(log.created_at).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })
                          : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
