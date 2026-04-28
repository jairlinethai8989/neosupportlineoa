'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { Suspense, useState, useEffect, useMemo } from 'react';
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
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useRouter } from 'next/navigation';
import { ExportPreviewModal, type ExportPreviewData } from '@/components/ui/ExportPreviewModal';
const DashboardChartsSection = React.lazy(() =>
  import('@/components/dashboard/DashboardChartsSection').then((module) => ({
    default: module.DashboardChartsSection,
  }))
);

type ExportUtilsModule = typeof import('@/lib/utils/exportUtils');

let exportUtilsPromise: Promise<ExportUtilsModule> | null = null;

async function loadExportUtils(): Promise<ExportUtilsModule> {
  if (!exportUtilsPromise) {
    exportUtilsPromise = import('@/lib/utils/exportUtils');
  }
  return exportUtilsPromise;
}

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
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [pendingFormat, setPendingFormat] = useState<'xlsx' | 'pdf' | null>(null);
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

  const handleExportRequest = (format: 'xlsx' | 'pdf') => {
    const preview: ExportPreviewData = {
      format: format === 'xlsx' ? 'excel' : 'pdf',
      title: t('dashboard.exportReport'),
      subtitle: t('dashboard.managementSummary'),
      totalRecords: tickets.length,
      dateRange: timeRange,
      columns: ['Ticket No', 'Subject', 'Customer', 'Status', 'Priority', 'Created At', 'Resolved At'],
    };
    setPendingFormat(format);
    setPreviewData(preview);
    setShowExportMenu(false);
    setShowExportPreview(true);
  };

  const handleExportDownload = async () => {
    if (!pendingFormat) return;
    const { exportTickets } = await loadExportUtils();
    exportTickets(tickets, pendingFormat);
    setShowExportPreview(false);
  };

  const handleExportPrint = async () => {
    const { printTickets } = await loadExportUtils();
    printTickets(tickets, 'Dashboard Tickets Report');
    setShowExportPreview(false);
  };

  useEffect(() => {
    let cancelled = false;

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

      const ticketSelect = `
        id,
        ticket_no,
        subject,
        status,
        priority,
        created_at,
        resolved_at,
        updated_at,
        assigned_to
      `;

      const { data: allTickets } = await supabase
        .from('tickets')
        .select(ticketSelect)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString());
      
      if (!cancelled && allTickets) setTickets(allTickets);
      if (!cancelled) setIsLoading(false);

      const ticketLogSelect = `
        id,
        ticket_id,
        action_type,
        created_at,
        tickets(ticket_no)
      `;

      // Logs are secondary for first paint; fetch after primary ticket data renders.
      void supabase
        .from('ticket_logs')
        .select(ticketLogSelect)
        .gte('created_at', from.toISOString())
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data: logs }) => {
          if (!cancelled && logs) {
            setRecentLogs(logs);
          }
        });
    }
    fetchDashboard();

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void fetchDashboard();
      }, 300);
    };

    const channel = supabase.channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_logs' }, scheduleRefresh)
      .subscribe();

    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
      supabase.removeChannel(channel);
    };
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
      escalated: tickets.filter(t => t.status === 'Escalated').length,
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
                  onClick={() => handleExportRequest('xlsx')}
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
                  onClick={() => handleExportRequest('pdf')}
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
        <div className="kpi-group" style={{ display: 'flex', gap: '20px', flex: 1, minWidth: '280px' }}>
          <div className="glass-interactive" style={{ padding: '24px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(234, 84, 85, 0.15)', color: '#ea5455', padding: '10px', borderRadius: '10px' }}>
                <AlertTriangle size={20} />
              </div>
            </div>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>ส่งต่อ</span>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>ESCALATED</span>
              </div>
            </h3>
            <p style={{ fontSize: '24px', fontWeight: '800', color: '#ea5455' }}>{stats.escalated}</p>
          </div>

          <div className="glass-interactive" style={{ padding: '24px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ background: 'rgba(255, 159, 67, 0.15)', color: '#ff9f43', padding: '10px', borderRadius: '10px' }}>
                <Zap size={20} />
              </div>
            </div>
            <h3 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>รอดำเนินการ</span>
                <span style={{ fontSize: '8px', opacity: 0.7 }}>PENDING</span>
              </div>
            </h3>
            <p style={{ fontSize: '24px', fontWeight: '800', color: '#ff9f43' }}>{stats.pending}</p>
          </div>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="glass" style={{ padding: '24px', minHeight: '420px' }}>
            <Skeleton width="30%" height={20} marginBottom={24} />
            <Skeleton width="100%" height={300} />
          </div>
        }
      >
        <DashboardChartsSection
          trendData={trendData}
          statusData={statusData}
          priorityData={priorityData}
          agentData={agentData}
          recentLogs={recentLogs}
          totalAll={stats.totalAll}
          labels={{
            ticketTrend: t('dashboard.ticketTrend'),
            newTickets: t('dashboard.newTickets'),
            resolved: t('dashboard.resolved'),
            statusDistribution: t('dashboard.statusDistribution'),
            allTab: t('dashboard.tabs.all'),
            priorityBreakdown: t('dashboard.priorityBreakdown'),
            agentWorkload: t('dashboard.agentWorkload'),
            recentActivity: t('dashboard.recentActivity'),
            noResults: t('common.messages.noResults'),
          }}
        />
      </Suspense>

      {previewData && (
        <ExportPreviewModal
          isOpen={showExportPreview}
          onClose={() => setShowExportPreview(false)}
          onDownload={handleExportDownload}
          onPrint={handleExportPrint}
          data={previewData}
        />
      )}

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
        @media (max-width: 640px) {
          .kpi-group {
            flex-direction: column !important;
            min-width: 100% !important;
          }
        }
      `}} />
    </div>
  );
}

