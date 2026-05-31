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
type DateWindow = { from: Date; to: Date };
type DashboardStats = {
  totalToday: number;
  newTickets: number;
  inProgress: number;
  pending: number;
  escalated: number;
  resolved: number;
  totalAll: number;
  trendPct: number | null;
  avgCsat: number;
};
type TrendRow = { dateKey: string; created: number; resolved: number };
type ValueRow = { name: string; value: number };
type AgentRow = { name: string; value: number };
type LogRow = { action_type: string; note: string; created_at: string; tickets: { ticket_no: string } };

const EMPTY_STATS: DashboardStats = {
  totalToday: 0,
  newTickets: 0,
  inProgress: 0,
  pending: 0,
  escalated: 0,
  resolved: 0,
  totalAll: 0,
  trendPct: null,
  avgCsat: 0,
};

let exportUtilsPromise: Promise<ExportUtilsModule> | null = null;
let dashboardCache: {
  key: string;
  stats: DashboardStats;
  trendRows: TrendRow[];
  statusRows: ValueRow[];
  priorityRows: ValueRow[];
  hospitalRows: ValueRow[];
  agentRows: AgentRow[];
  heatmap: number[][];
} | null = null;

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
const HOSPITAL_COLORS = ['#4facfe', '#00f2fe', '#28c76f', '#ff9f43', '#7367f0', '#ea5455', '#7bdff2', '#9b87f5'];

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

function computeDateWindow(
  timeRange: 'today' | 'week' | 'month' | 'custom',
  customStart: string,
  customEnd: string
): DateWindow {
  let from: Date;
  let to: Date = new Date();
  to.setHours(23, 59, 59, 999);

  if (timeRange === 'today') {
    from = new Date();
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'week') {
    from = new Date();
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  } else if (timeRange === 'month') {
    from = new Date();
    from.setMonth(from.getMonth() - 1);
    from.setHours(0, 0, 0, 0);
  } else {
    from = customStart ? new Date(customStart) : new Date();
    to = customEnd ? new Date(customEnd) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

export default function Home() {
  const { t } = useStaffLocale();
  const router = useRouter();

  // Date Filter State
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [hospitalsList, setHospitalsList] = useState<any[]>([]);
  const [modulesList, setModulesList] = useState<any[]>([]);
  const [issueTypesList, setIssueTypesList] = useState<any[]>([]);

  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');

  const [tempHospital, setTempHospital] = useState<string>('');
  const [tempModule, setTempModule] = useState<string>('');
  const [tempIssueType, setTempIssueType] = useState<string>('');

  useEffect(() => {
    async function loadFilterOptions() {
      const { data: hosps } = await supabase.from('hospitals').select('id, name').eq('is_active', true).order('name');
      const { data: mods } = await supabase.from('ticket_modules').select('name').eq('is_active', true).order('name');
      const { data: types } = await supabase.from('ticket_issue_types').select('name').eq('is_active', true).order('name');
      
      if (hosps) setHospitalsList(hosps);
      if (mods) setModulesList(mods);
      if (types) setIssueTypesList(types);
    }
    loadFilterOptions();
  }, []);

  const dateWindow = useMemo(
    () => computeDateWindow(timeRange, customStart, customEnd),
    [timeRange, customStart, customEnd]
  );
  const currentWindowKey = `${dateWindow.from.toISOString()}_${dateWindow.to.toISOString()}_h=${selectedHospital}_m=${selectedModule}_t=${selectedIssueType}`;
  const hasCache = dashboardCache?.key === currentWindowKey;

  const [stats, setStats] = useState<DashboardStats>(hasCache ? dashboardCache!.stats : EMPTY_STATS);
  const [trendRows, setTrendRows] = useState<TrendRow[]>(hasCache ? dashboardCache!.trendRows : []);
  const [statusRows, setStatusRows] = useState<ValueRow[]>(hasCache ? dashboardCache!.statusRows : []);
  const [priorityRows, setPriorityRows] = useState<ValueRow[]>(hasCache ? dashboardCache!.priorityRows : []);
  const [hospitalRows, setHospitalRows] = useState<ValueRow[]>(hasCache ? dashboardCache!.hospitalRows : []);
  const [agentRows, setAgentRows] = useState<AgentRow[]>(hasCache ? dashboardCache!.agentRows : []);
  const [heatmap, setHeatmap] = useState<number[][]>(hasCache ? dashboardCache!.heatmap : []);
  
  const [exportTicketsRows, setExportTicketsRows] = useState<any[]>([]);
  const [exportTicketsKey, setExportTicketsKey] = useState<string>('');
  const [recentLogs, setRecentLogs] = useState<LogRow[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [pendingFormat, setPendingFormat] = useState<'xlsx' | 'pdf' | null>(null);
  const [isLoading, setIsLoading] = useState(!hasCache);

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

  const handleExportRequest = async (format: 'xlsx' | 'pdf') => {
    let rows = exportTicketsRows;

    if (exportTicketsKey !== currentWindowKey || rows.length === 0) {
      const exportSelect = `
        id,
        ticket_no,
        subject,
        status,
        priority,
        created_at,
        updated_at,
        customers!tickets_customer_id_fkey (display_name),
        assigned_agent:profiles!assigned_agent_id (full_name)
      `;
      let query = supabase
        .from('tickets')
        .select(exportSelect)
        .gte('created_at', dateWindow.from.toISOString())
        .lte('created_at', dateWindow.to.toISOString());
        
      if (selectedHospital) {
        query = query.eq('hospital_id', selectedHospital);
      }
      if (selectedModule) {
        query = query.eq('module', selectedModule);
      }
      if (selectedIssueType) {
        query = query.eq('issue_type', selectedIssueType);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Export fetch error:', error.message);
        alert(t('dashboard.exportError') || 'ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
        return;
      }

      // Flatten joined fields for export
      rows = (data || []).map((row: any) => ({
        ...row,
        customer_name: row.customers?.display_name || '-',
        agent_name: row.assigned_agent?.full_name || '-',
        resolved_at: row.updated_at,
      }));
      setExportTicketsRows(rows);
      setExportTicketsKey(currentWindowKey);
    }

    const preview: ExportPreviewData = {
      format: format === 'xlsx' ? 'excel' : 'pdf',
      title: t('dashboard.exportReport'),
      subtitle: t('dashboard.managementSummary'),
      totalRecords: rows.length,
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
    exportTickets(exportTicketsRows, pendingFormat);
    setShowExportPreview(false);
  };

  const handleExportPrint = async () => {
    const { printTickets } = await loadExportUtils();
    printTickets(exportTicketsRows, 'Dashboard Tickets Report');
    setShowExportPreview(false);
  };

  useEffect(() => {
    let cancelled = false;

    async function fetchDashboard(backgroundRefresh = false) {
      if (!backgroundRefresh) setIsLoading(true);
      try {
        const from = encodeURIComponent(dateWindow.from.toISOString());
        const to = encodeURIComponent(dateWindow.to.toISOString());
        const res = await fetch(`/api/dashboard/summary?from=${from}&to=${to}&hospitalId=${selectedHospital}&module=${selectedModule}&issueType=${selectedIssueType}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Dashboard summary failed (${res.status})`);
        const payload = await res.json();

        if (cancelled) return;
        setStats(payload.stats || EMPTY_STATS);
        setTrendRows(payload.trendByDay || []);
        setStatusRows(payload.statusData || []);
        setPriorityRows(payload.priorityData || []);
        setHospitalRows(payload.hospitalData || []);
        setAgentRows(payload.agentData || []);
        setHeatmap(payload.heatmap || []);
        
        dashboardCache = {
          key: currentWindowKey,
          stats: payload.stats || EMPTY_STATS,
          trendRows: payload.trendByDay || [],
          statusRows: payload.statusData || [],
          priorityRows: payload.priorityData || [],
          hospitalRows: payload.hospitalData || [],
          agentRows: payload.agentData || [],
          heatmap: payload.heatmap || [],
        };
        
        if (!backgroundRefresh) setRecentLogs([]);

        // Load recent logs after first paint; do not block summary rendering.
        void fetch(`/api/dashboard/summary?from=${from}&to=${to}&includeLogs=1&hospitalId=${selectedHospital}&module=${selectedModule}&issueType=${selectedIssueType}`, { cache: 'no-store' })
          .then(async (logRes) => {
            if (!logRes.ok || cancelled) return;
            const logPayload = await logRes.json();
            if (!cancelled) setRecentLogs(logPayload.recentLogs || []);
          })
          .catch(() => {});
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setStats(EMPTY_STATS);
        setTrendRows([]);
        setStatusRows([]);
        setPriorityRows([]);
        setHospitalRows([]);
        setAgentRows([]);
        setHeatmap([]);
        setRecentLogs([]);
      } finally {
        if (!cancelled && !backgroundRefresh) setIsLoading(false);
      }
    }
    const currentKey = `${dateWindow.from.toISOString()}_${dateWindow.to.toISOString()}_h=${selectedHospital}_m=${selectedModule}_t=${selectedIssueType}`;
    fetchDashboard(dashboardCache?.key === currentKey);

    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        void fetchDashboard(true);
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
  }, [dateWindow.from, dateWindow.to, currentWindowKey, selectedHospital, selectedModule, selectedIssueType]);

  const trendData = useMemo(() => {
    const days: { label: string; dateKey: string; [key: string]: any }[] = [];
    const newTicketsLabel = t('dashboard.newTickets');
    const resolvedLabel = t('dashboard.resolved');

    if (trendRows.length === 0) return days;

    for (const row of trendRows) {
      days.push({
        label: getDayLabel(row.dateKey),
        dateKey: row.dateKey,
        [newTicketsLabel]: row.created,
        [resolvedLabel]: row.resolved,
      });
    }
    return days;
  }, [trendRows, t]);

  const statusData = useMemo(
    () =>
      statusRows.map(({ name, value }) => ({
        name,
        value,
        fill: STATUS_COLORS[name] || '#4facfe',
      })),
    [statusRows]
  );

  const priorityData = useMemo(
    () =>
      priorityRows.map(({ name, value }) => ({
        name,
        value,
        fill: PRIORITY_COLORS[name] || '#4facfe',
      })),
    [priorityRows]
  );
  const hospitalData = useMemo(
    () =>
      hospitalRows.map(({ name, value }, index) => ({
        name,
        value,
        fill: HOSPITAL_COLORS[index % HOSPITAL_COLORS.length],
      })),
    [hospitalRows]
  );

  const agentData = useMemo(
    () =>
      agentRows.map(({ name, value }) => ({
        name: name.length > 12 ? `${name.substring(0, 12)}...` : name,
        value,
      })),
    [agentRows]
  );

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

      {/* Filters Bar */}
      <div className="glass" style={{ display: 'flex', gap: '16px', padding: '16px 24px', borderRadius: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>ตัวกรองข้อมูล (FILTERS):</span>
        
        {/* Hospital Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
          <select 
            value={tempHospital} 
            onChange={e => setTempHospital(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', outline: 'none' }}
          >
            <option value="">-- โรงพยาบาลทั้งหมด --</option>
            {hospitalsList.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        </div>

        {/* Module Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
          <select 
            value={tempModule} 
            onChange={e => setTempModule(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', outline: 'none' }}
          >
            <option value="">-- โมดูลทั้งหมด --</option>
            {modulesList.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </div>

        {/* Issue Type Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: '180px' }}>
          <select 
            value={tempIssueType} 
            onChange={e => setTempIssueType(e.target.value)}
            style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '13px', fontWeight: '700', outline: 'none' }}
          >
            <option value="">-- ประเภทงานทั้งหมด --</option>
            {issueTypesList.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
          </select>
        </div>

        {/* Apply Filters Button */}
        <button
          onClick={() => {
            setSelectedHospital(tempHospital);
            setSelectedModule(tempModule);
            setSelectedIssueType(tempIssueType);
          }}
          style={{
            background: 'var(--primary)',
            color: '#0a0e14',
            border: 'none',
            padding: '8px 20px',
            borderRadius: '10px',
            fontSize: '13px',
            fontWeight: '800',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: (tempHospital !== selectedHospital || tempModule !== selectedModule || tempIssueType !== selectedIssueType)
              ? '0 0 12px var(--primary)'
              : 'none',
            opacity: (tempHospital !== selectedHospital || tempModule !== selectedModule || tempIssueType !== selectedIssueType) ? 1 : 0.8
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.02)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ใช้ตัวกรอง (Apply)
        </button>

        {/* Clear Filters Button */}
        {(tempHospital || tempModule || tempIssueType || selectedHospital || selectedModule || selectedIssueType) && (
          <button
            onClick={() => {
              setTempHospital('');
              setTempModule('');
              setTempIssueType('');
              setSelectedHospital('');
              setSelectedModule('');
              setSelectedIssueType('');
            }}
            style={{ background: 'rgba(234, 84, 85, 0.1)', color: 'var(--danger)', border: 'none', padding: '8px 16px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            ล้างตัวกรอง
          </button>
        )}
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
          hospitalData={hospitalData}
          agentData={agentData}
          recentLogs={recentLogs}
          totalAll={stats.totalAll}
          avgCsat={stats.avgCsat}
          labels={{
            ticketTrend: t('dashboard.ticketTrend'),
            newTickets: t('dashboard.newTickets'),
            resolved: t('dashboard.resolved'),
            statusDistribution: t('dashboard.statusDistribution'),
            allTab: t('dashboard.tabs.all'),
            priorityBreakdown: t('dashboard.priorityBreakdown'),
            hospitalWorkload: t('dashboard.hospitalWorkload'),
            agentWorkload: t('dashboard.agentWorkload'),
            recentActivity: t('dashboard.recentActivity'),
            noResults: t('common.messages.noResults'),
            heatmapVolume: t('dashboard.heatmapVolume') || 'ปริมาณใบงานรายชั่วโมง (Heatmap)',
          }}
          heatmapData={heatmap}
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

