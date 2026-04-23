'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  CheckCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Download,
  Ticket,
  Activity,
  Zap
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { exportTickets } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

const CHART_COLORS = {
  primary: '#00f2fe',
  secondary: '#7367f0',
  success: '#28c76f',
  warning: '#ff9f43',
  danger: '#ea5455',
  info: '#4facfe',
};

const STATUS_COLORS: Record<string, string> = {
  'New': '#00f2fe',
  'In Progress': '#ff9f43',
  'Pending': '#ea5455',
  'Resolved': '#28c76f',
  'Closed': '#7367f0',
};

const PRIORITY_COLORS: Record<string, string> = {
  'Critical': '#ea5455',
  'High': '#ff9f43',
  'Medium': '#4facfe',
  'Low': '#28c76f',
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-sidebar)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '12px 16px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
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
    <div style={{
      background: 'var(--bg-sidebar)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '12px 16px',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <p style={{ fontSize: '13px', fontWeight: '800', color: d.payload?.fill || 'white' }}>
        {d.name}: {d.value} ใบงาน
      </p>
    </div>
  );
};

const KPICard = ({ title, value, icon: Icon, color, trend, trendLabel }: any) => (
  <div className="glass-interactive" style={{ padding: '24px', flex: 1, minWidth: '200px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
      <div style={{ 
        background: `${color}15`, 
        color: color, 
        padding: '12px', 
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} />
      </div>
      {trend !== undefined && trend !== null && (
        <span style={{ 
          fontSize: '12px', 
          color: trend >= 0 ? 'var(--success)' : 'var(--danger)',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          background: trend >= 0 ? 'rgba(40, 199, 111, 0.1)' : 'rgba(234, 84, 85, 0.1)',
          padding: '4px 10px',
          borderRadius: '20px'
        }}>
          {trend >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {trend >= 0 ? '+' : ''}{trend}%
        </span>
      )}
    </div>
    <h3 style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span>{title.thai}</span>
        <span style={{ fontSize: '9px', opacity: 0.7 }}>{title.eng}</span>
      </div>
    </h3>
    <p style={{ fontSize: '28px', fontWeight: '800' }}>{value}</p>
    {trendLabel && <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{trendLabel}</p>}
  </div>
);

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

export default function Home() {
  const { t } = useStaffLocale();
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Date Filter State
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Click outside to close export menu
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showExportMenu]);

  useEffect(() => {
    async function fetchDashboard() {
      setIsLoading(true);
      let from: Date, to: Date = new Date();
      to.setHours(23, 59, 59, 999);

      if (timeRange === 'today') {
        from = new Date(); from.setHours(0, 0, 0, 0);
      } else if (timeRange === 'week') {
        from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      } else if (timeRange === 'month') {
        from = new Date(); from.setMonth(from.getMonth() - 1); from.setHours(0, 0, 0, 0);
      } else {
        from = customStart ? new Date(customStart) : new Date();
        to = customEnd ? new Date(customEnd) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
      }

      const { data: allTickets } = await supabase
        .from('tickets')
        .select('*')
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      
      if (allTickets) setTickets(allTickets);

      const { data: logs } = await supabase
        .from('ticket_logs')
        .select(`*, tickets(ticket_no)`)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(10);
      if (logs) setRecentLogs(logs);
      setIsLoading(false);
    }
    fetchDashboard();

    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, fetchDashboard)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_logs' }, fetchDashboard)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [timeRange, customStart, customEnd]);

  // KPI calculations
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    const todayTickets = tickets.filter(t => new Date(t.created_at) >= todayStart);
    const yesterdayTickets = tickets.filter(t => {
      const d = new Date(t.created_at);
      return d >= yesterdayStart && d < todayStart;
    });

    const todayCount = todayTickets.length;
    const yesterdayCount = yesterdayTickets.length;
    const trendPct = yesterdayCount > 0 ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100) : null;

    return {
      totalToday: todayCount,
      newTickets: tickets.filter(t => t.status === 'New').length,
      inProgress: tickets.filter(t => t.status === 'In Progress').length,
      pending: tickets.filter(t => t.status === 'Pending').length,
      resolved: tickets.filter(t => t.status === 'Resolved' || t.status === 'Closed').length,
      totalAll: tickets.length,
      trendPct,
    };
  }, [tickets]);

  // 7-day trend data
  const trendData = useMemo(() => {
    const days: { label: string; dateKey: string; [key: string]: any }[] = [];
    const newTicketsLabel = t('dashboard.newTickets');
    const resolvedLabel = t('dashboard.resolved');

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().split('T')[0];
      const label = getDayLabel(d.toISOString());
      
      const created = tickets.filter(t => t.created_at?.startsWith(dateKey)).length;
      const resolved = tickets.filter(t => 
        (t.status === 'Resolved' || t.status === 'Closed') && 
        t.updated_at?.startsWith(dateKey)
      ).length;
      
      days.push({ label, dateKey, [newTicketsLabel]: created, [resolvedLabel]: resolved });
    }
    return days;
  }, [tickets]);

  // Status distribution for pie
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value, 
      fill: STATUS_COLORS[name] || '#4facfe' 
    }));
  }, [tickets]);

  // Priority distribution for bar chart
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.forEach(t => { 
      const p = t.priority || 'Medium';
      counts[p] = (counts[p] || 0) + 1; 
    });
    return Object.entries(counts).map(([name, value]) => ({ 
      name, 
      value, 
      fill: PRIORITY_COLORS[name] || '#4facfe' 
    }));
  }, [tickets]);

  // Agent workload
  const agentData = useMemo(() => {
    const counts: Record<string, number> = {};
    tickets.filter(t => t.assigned_to).forEach(t => {
      counts[t.assigned_to] = (counts[t.assigned_to] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name: name.length > 12 ? name.substring(0, 12) + '...' : name, value }));
  }, [tickets]);

  if (isLoading) {
    return (
      <div className="animate-page-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
          <div>
            <Skeleton width={200} height={32} marginBottom={8} />
            <Skeleton width={150} height={16} />
          </div>
          <Skeleton width={160} height={48} borderRadius={14} />
        </div>
        
        <div style={{ display: 'flex', gap: '20px', marginBottom: '32px' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass" style={{ padding: '24px', flex: 1 }}>
               <Skeleton width="40%" height={12} marginBottom={16} />
               <Skeleton width="60%" height={28} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div className="glass" style={{ padding: '24px', height: '350px' }}>
             <Skeleton width="30%" height={20} marginBottom={24} />
             <Skeleton width="100%" height="80%" />
          </div>
          <div className="glass" style={{ padding: '24px', height: '350px' }}>
             <Skeleton width="40%" height={20} marginBottom={24} />
             <Skeleton width="100%" height="80%" borderRadius="50%" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
           {[1, 2, 3].map(i => (
             <div key={i} className="glass" style={{ padding: '24px', height: '300px' }}>
                <Skeleton width="50%" height={16} marginBottom={20} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   {[1, 2, 3, 4].map(j => <Skeleton key={j} width="100%" height={32} />)}
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>{t('dashboard.managementSummary')}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {t('dashboard.executiveSummary')}
            </p>
            <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {[
                { id: 'today', label: t('dashboard.daily') },
                { id: 'week', label: t('dashboard.weekly') },
                { id: 'month', label: t('dashboard.monthly') },
                { id: 'custom', label: t('dashboard.customRange') }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTimeRange(opt.id as any)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    background: timeRange === opt.id ? 'var(--primary)' : 'transparent',
                    color: timeRange === opt.id ? '#0a0e14' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {timeRange === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease-out' }}>
                <input 
                  type="date" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', color: 'var(--text-main)', fontSize: '11px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                <input 
                  type="date" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', color: 'var(--text-main)', fontSize: '11px' }}
                />
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(0, 242, 254, 0.05)' }}>
            <Activity size={14} color="var(--primary)" />
            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>LIVE</span>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
          </div>
          <div ref={exportRef} style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="glass-interactive flex-center" 
              style={{ 
                padding: '12px 24px', 
                background: 'var(--primary)', 
                color: 'black', 
                border: 'none', 
                fontWeight: '800',
                borderRadius: '14px',
                gap: '12px',
                boxShadow: '0 8px 24px rgba(0, 242, 254, 0.3)',
                cursor: 'pointer'
              }}
            >
              <Download size={20} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: '1.2' }}>
                <span style={{ fontSize: '14px' }}>{t('dashboard.exportReport')}</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>EXPORT REPORT</span>
              </div>
            </button>
            {showExportMenu && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 8px)',
                right: 0,
                background: 'rgba(10, 14, 20, 0.97)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
                zIndex: 50,
                overflow: 'hidden',
                animation: 'fadeIn 0.15s ease-out',
                minWidth: '200px',
              }}>
                <button
                  onClick={() => { exportTickets(tickets, 'xlsx'); setShowExportMenu(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '14px 20px',
                    background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                    color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: '18px' }}>📊</span>
                  <div>
                    <p>Excel (.xlsx)</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>ส่งออกไฟล์ Excel</p>
                  </div>
                </button>
                <button
                  onClick={() => { exportTickets(tickets, 'pdf'); setShowExportMenu(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    width: '100%', padding: '14px 20px',
                    background: 'none', border: 'none',
                    color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                    textAlign: 'left',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ fontSize: '18px' }}>📄</span>
                  <div>
                    <p>PDF (.pdf)</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>ส่งออกไฟล์ PDF</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <KPICard 
          title={{ thai: t('dashboard.todayTickets'), eng: 'TODAY\'S TICKETS' }} 
          value={stats.totalToday} 
          icon={Ticket} 
          color="#00cfe8" 
          trend={stats.trendPct}
          trendLabel={t('dashboard.comparedToYesterday')}
        />
        <KPICard 
          title={{ thai: t('dashboard.newTickets'), eng: 'NEW TICKETS' }} 
          value={stats.newTickets} 
          icon={MessageSquare} 
          color="#00f2fe" 
          trend={null}
        />
        <KPICard 
          title={{ thai: t('dashboard.inProgress'), eng: 'IN PROGRESS' }} 
          value={stats.inProgress} 
          icon={Clock} 
          color="#ff9f43" 
          trend={null}
        />
        <KPICard 
          title={{ thai: t('dashboard.resolved'), eng: 'RESOLVED' }} 
          value={stats.resolved} 
          icon={CheckCircle} 
          color="#28c76f" 
          trend={null}
        />
      </div>

      {/* Charts Row 1 — Trend + Status Pie */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
        {/* 7-Day Trend Area Chart */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{t('dashboard.ticketTrend')}</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>TICKET TREND • Last 7 Days</p>
            </div>
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CHART_COLORS.primary }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dashboard.newTickets')}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: CHART_COLORS.success }} />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t('dashboard.resolved')}</span>
              </div>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: '280px' }}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="gradNew" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.success} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={CHART_COLORS.success} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey={t('dashboard.newTickets')} 
                  stroke={CHART_COLORS.primary} 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#gradNew)" 
                  dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 2, stroke: '#0a0e14' }}
                  activeDot={{ r: 6, stroke: CHART_COLORS.primary, strokeWidth: 2, fill: '#0a0e14' }}
                />
                <Area 
                  type="monotone" 
                  dataKey={t('dashboard.resolved')} 
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

        {/* Status Distribution Donut */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{t('dashboard.statusDistribution')}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>STATUS DISTRIBUTION</p>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie 
                      data={statusData} 
                      innerRadius={60} 
                      outerRadius={85} 
                      paddingAngle={4} 
                      dataKey="value"
                      strokeWidth={0}
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)', textAlign: 'center' }}>
                  <p style={{ fontSize: '28px', fontWeight: '900' }}>{stats.totalAll}</p>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '700' }}>{t('dashboard.tabs.all')}</p>
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{t('common.messages.noResults')}</p>
            )}
          </div>
          {/* Legend */}
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

      {/* Charts Row 2 — Priority Bar + Agent Workload + Recent Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px' }}>
        {/* Priority Distribution */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{t('dashboard.priorityBreakdown')}</h2>
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
              <div className="flex-center" style={{ height: '220px', color: 'var(--text-muted)', fontSize: '13px' }}>{t('common.messages.noResults')}</div>
            )}
          </div>
        </div>

        {/* Agent Workload */}
        <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{t('dashboard.agentWorkload')}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>AGENT WORKLOAD • TOP 5</p>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', justifyContent: 'center' }}>
            {agentData.length > 0 ? agentData.map((agent, idx) => {
              const maxVal = Math.max(...agentData.map(a => a.value));
              const pct = maxVal > 0 ? (agent.value / maxVal) * 100 : 0;
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>{agent.name}</span>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{agent.value}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${pct}%`, 
                      background: `linear-gradient(90deg, ${CHART_COLORS.primary}, ${CHART_COLORS.info})`,
                      borderRadius: '3px',
                      transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                    }} />
                  </div>
                </div>
              );
            }) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center' }}>{t('common.messages.noResults')}</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass" style={{ padding: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '2px' }}>{t('dashboard.recentActivity')}</h2>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>RECENT ACTIVITY</p>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {recentLogs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>{t('common.messages.noResults')}</p>
            ) : recentLogs.map((log, idx) => (
              <div key={idx} style={{ 
                padding: '10px 0', 
                borderBottom: idx === recentLogs.length - 1 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                gap: '12px',
                alignItems: 'start'
              }}>
                <div style={{ 
                  width: '28px', 
                  height: '28px', 
                  borderRadius: '8px', 
                  background: 'rgba(0, 242, 254, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
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
                    {new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @media (max-width: 1200px) {
          div[style*="gridTemplateColumns: 2fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="gridTemplateColumns: 1fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 768px) {
          div[style*="gridTemplateColumns: 2fr 1fr"] { grid-template-columns: 1fr !important; }
          div[style*="gridTemplateColumns: 1fr 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}} />
    </div>
  );
}

