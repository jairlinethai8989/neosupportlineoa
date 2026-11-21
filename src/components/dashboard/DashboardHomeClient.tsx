'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { Suspense, useState, useEffect, useMemo } from 'react';
import {
  MessageSquare,
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Download,
  Ticket,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import Skeleton from '@/components/ui/Skeleton';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useAppContext } from '@/contexts/AppContext';
import { useRouter } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ExportPreviewModal,
  Input,
  PageHeader,
  Select,
  type ExportPreviewData,
} from '@/components/ui';
import useSWR from 'swr';
import type { DashboardSummaryPayload } from '@/lib/server/dashboardSummary';
import styles from '@/components/dashboard/dashboard.module.css';

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

async function loadExportUtils(): Promise<ExportUtilsModule> {
  if (!exportUtilsPromise) {
    exportUtilsPromise = import('@/lib/utils/exportUtils');
  }
  return exportUtilsPromise;
}

const STATUS_COLORS: Record<string, string> = {
  New: '#0284C7',
  'In Progress': '#D97706',
  Pending: '#DC2626',
  Resolved: '#059669',
  Closed: '#475569',
};

const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#DC2626',
  High: '#D97706',
  Medium: '#1D4ED8',
  Low: '#059669',
};

const HOSPITAL_COLORS = [
  '#1D4ED8',
  '#0D9488',
  '#0284C7',
  '#059669',
  '#D97706',
  '#475569',
  '#2563EB',
  '#0F766E',
];

function KPICard({
  title,
  value,
  icon: Icon,
  iconColor,
  iconBg,
  trend,
  trendLabel,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  trend?: number | null;
  trendLabel?: string;
}) {
  return (
    <div className={styles.kpiCard}>
      <div className={styles.kpiTop}>
        <div className={styles.kpiIconBox} style={{ background: iconBg, color: iconColor }} aria-hidden="true">
          <Icon size={18} />
        </div>
        {trend !== undefined && trend !== null ? (
          <Badge variant={trend >= 0 ? 'success' : 'danger'} size="sm">
            {trend >= 0 ? <TrendingUp size={12} aria-hidden="true" /> : <TrendingDown size={12} aria-hidden="true" />}
            {trend >= 0 ? '+' : ''}
            {trend}%
          </Badge>
        ) : null}
      </div>
      <div>
        <p className={styles.kpiLabel}>{title}</p>
        <p className={styles.kpiValue}>{value}</p>
        {trendLabel ? <p className={styles.kpiMeta}>{trendLabel}</p> : null}
      </div>
    </div>
  );
}

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
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  } else {
    from = customStart ? new Date(customStart) : new Date();
    to = customEnd ? new Date(customEnd) : new Date();
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
  }

  return { from, to };
}

export function DashboardHomeClient({
  initialSummary = null,
  initialWindow = null,
  initialProjectId = 'all',
}: {
  initialSummary?: DashboardSummaryPayload | null;
  initialWindow?: { fromIso: string; toIso: string } | null;
  initialProjectId?: string;
}) {
  const { t } = useStaffLocale();
  const {
    scopedOrganizations: contextOrgs,
    companySettings,
    ensureOrganizations,
    selectedProjectId,
    effectiveProjectIds,
  } = useAppContext();
  const router = useRouter();

  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [tempTimeRange, setTempTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [tempCustomStart, setTempCustomStart] = useState('');
  const [tempCustomEnd, setTempCustomEnd] = useState('');

  const [organizationsList, setOrganizationsList] = useState<any[]>([]);
  const [modulesList, setModulesList] = useState<any[]>([]);
  const [issueTypesList, setIssueTypesList] = useState<any[]>([]);

  const [selectedHospital, setSelectedHospital] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');

  const [tempHospital, setTempHospital] = useState<string>('');
  const [tempModule, setTempModule] = useState<string>('');
  const [tempIssueType, setTempIssueType] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      void ensureOrganizations();
    }, 800);
    return () => clearTimeout(timer);
  }, [ensureOrganizations]);

  useEffect(() => {
    if (contextOrgs.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrganizationsList(contextOrgs as any[]);
    }
  }, [contextOrgs]);

  useEffect(() => {
    if (!companySettings) return;
    if (companySettings.modules?.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setModulesList(companySettings.modules.map((name: string) => ({ name })));
    }
    if (companySettings.issue_types?.length) {
      setIssueTypesList(companySettings.issue_types.map((name: string) => ({ name })));
    }
  }, [companySettings]);

  const isInitialDefaultView =
    Boolean(initialWindow && initialSummary) &&
    timeRange === 'week' &&
    !selectedHospital &&
    !selectedModule &&
    !selectedIssueType &&
    selectedProjectId === initialProjectId;

  const dateWindow = useMemo(() => {
    if (isInitialDefaultView && initialWindow) {
      return {
        from: new Date(initialWindow.fromIso),
        to: new Date(initialWindow.toIso),
      };
    }
    return computeDateWindow(timeRange, customStart, customEnd);
  }, [isInitialDefaultView, initialWindow, timeRange, customStart, customEnd]);
  const currentWindowKey = `${dateWindow.from.toISOString()}_${dateWindow.to.toISOString()}_h=${selectedHospital}_m=${selectedModule}_t=${selectedIssueType}_p=${selectedProjectId}`;

  const fetchUrl = `/api/dashboard/summary?from=${encodeURIComponent(dateWindow.from.toISOString())}&to=${encodeURIComponent(dateWindow.to.toISOString())}&includeLogs=1&organizationId=${selectedHospital}&module=${selectedModule}&issueType=${selectedIssueType}&projectId=${encodeURIComponent(selectedProjectId)}`;
  const { data: payload, isLoading: isSwrLoading, mutate } = useSWR(
    fetchUrl,
    (url: string) =>
      fetch(url).then((res) => {
        if (!res.ok) throw new Error('Failed to fetch dashboard summary');
        return res.json();
      }),
    {
      fallbackData: isInitialDefaultView ? initialSummary ?? undefined : undefined,
      revalidateOnMount: !isInitialDefaultView,
      revalidateOnFocus: false,
    }
  );

  const stats = payload?.stats || EMPTY_STATS;
  const trendRows = useMemo(() => payload?.trendByDay || [], [payload?.trendByDay]);
  const statusRows = useMemo(() => payload?.statusData || [], [payload?.statusData]);
  const priorityRows = useMemo(() => payload?.priorityData || [], [payload?.priorityData]);
  const organizationRows = useMemo(() => payload?.organizationData || [], [payload?.organizationData]);
  const agentRows = useMemo(() => payload?.agentData || [], [payload?.agentData]);
  const heatmap = payload?.heatmap || [];
  const recentLogs = payload?.recentLogs || [];
  const isLoading = isSwrLoading && !payload;

  const [exportTicketsRows, setExportTicketsRows] = useState<any[]>([]);
  const [exportTicketsKey, setExportTicketsKey] = useState<string>('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportRef = React.useRef<HTMLDivElement>(null);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [pendingFormat, setPendingFormat] = useState<'xlsx' | 'pdf' | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
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

      if (effectiveProjectIds && effectiveProjectIds.length > 0) {
        query = query.in('project_id', effectiveProjectIds);
      }
      if (selectedHospital) {
        query = query.eq('organization_id', selectedHospital);
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

  const { lastDbEvent } = useNotificationContext();

  useEffect(() => {
    if (!lastDbEvent) return;
    if (lastDbEvent.table === 'tickets' || lastDbEvent.table === 'ticket_logs') {
      const timer = setTimeout(() => {
        void mutate();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [lastDbEvent, mutate]);

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
      statusRows.map(({ name, value }: { name: string; value: number }) => ({
        name,
        value,
        fill: STATUS_COLORS[name] || '#0284C7',
      })),
    [statusRows]
  );

  const priorityData = useMemo(
    () =>
      priorityRows.map(({ name, value }: { name: string; value: number }) => ({
        name,
        value,
        fill: PRIORITY_COLORS[name] || '#1D4ED8',
      })),
    [priorityRows]
  );

  const organizationData = useMemo(
    () =>
      organizationRows.map(({ name, value }: { name: string; value: number }, index: number) => ({
        name: name || 'ไม่ระบุ',
        value,
        fill: HOSPITAL_COLORS[index % HOSPITAL_COLORS.length],
      })),
    [organizationRows]
  );

  const agentData = useMemo(
    () =>
      agentRows.map(({ name, value }: { name: string; value: number }) => ({
        name: name.length > 14 ? `${name.substring(0, 14)}...` : name,
        value,
      })),
    [agentRows]
  );

  const hasPendingFilterChanges =
    tempHospital !== selectedHospital ||
    tempModule !== selectedModule ||
    tempIssueType !== selectedIssueType ||
    tempTimeRange !== timeRange ||
    (tempTimeRange === 'custom' && (tempCustomStart !== customStart || tempCustomEnd !== customEnd));

  const hasActiveFilters = Boolean(
    tempHospital ||
      tempModule ||
      tempIssueType ||
      selectedHospital ||
      selectedModule ||
      selectedIssueType ||
      tempTimeRange !== 'week' ||
      timeRange !== 'week' ||
      tempCustomStart ||
      tempCustomEnd
  );

  if (isLoading) {
    return (
      <div className={`animate-page-in ${styles.pageStack}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Skeleton width={220} height={28} marginBottom={8} />
            <Skeleton width={180} height={16} />
          </div>
          <Skeleton width={150} height={36} borderRadius={8} />
        </div>

        <div className={styles.kpiGrid}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton width="40%" height={12} marginBottom={12} />
                <Skeleton width="55%" height={28} />
              </CardBody>
            </Card>
          ))}
        </div>

        <div className={styles.asymmetricGrid}>
          <Card>
            <CardBody>
              <Skeleton width="30%" height={20} marginBottom={20} />
              <Skeleton width="100%" height={280} />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <Skeleton width="45%" height={20} marginBottom={20} />
              <Skeleton width="100%" height={280} />
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      <PageHeader
        title={t('dashboard.managementSummary')}
        subtitle={t('dashboard.executiveSummary')}
        badge={
          <Badge variant="success" dot>
            LIVE
          </Badge>
        }
        actions={
          <div className={styles.headerActions}>
            <div ref={exportRef} className={styles.exportWrap}>
              <Button
                variant="primary"
                size="md"
                leftIcon={<Download size={16} aria-hidden="true" />}
                onClick={() => setShowExportMenu((prev) => !prev)}
                aria-expanded={showExportMenu}
                aria-haspopup="menu"
              >
                {t('dashboard.exportReport')}
              </Button>
              {showExportMenu ? (
                <div className={styles.exportMenu} role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.exportMenuItem}
                    onClick={() => handleExportRequest('xlsx')}
                  >
                    <FileSpreadsheet size={16} color="var(--color-success)" aria-hidden="true" />
                    <span>
                      Excel (.xlsx)
                      <span className={styles.exportMenuSub}>ส่งออกไฟล์ Excel</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.exportMenuItem}
                    onClick={() => handleExportRequest('pdf')}
                  >
                    <FileText size={16} color="var(--color-danger)" aria-hidden="true" />
                    <span>
                      PDF (.pdf)
                      <span className={styles.exportMenuSub}>ส่งออกไฟล์ PDF</span>
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <section aria-label="ตัวกรองข้อมูลแดชบอร์ด" className={styles.filterBar}>
        <div className={styles.filterRangeGroup}>
          <span className={styles.filterLabel}>ช่วงเวลา</span>
          <div className={styles.segmentedGroup} role="group" aria-label="เลือกช่วงเวลา">
            {[
              { id: 'today', label: t('dashboard.daily') },
              { id: 'week', label: t('dashboard.weekly') },
              { id: 'month', label: t('dashboard.monthly') },
              { id: 'custom', label: t('dashboard.customRange') },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (opt.id === 'custom') {
                    setTempTimeRange('custom');
                  } else {
                    setTimeRange(opt.id as 'today' | 'week' | 'month');
                    setTempTimeRange(opt.id as 'today' | 'week' | 'month');
                    setSelectedHospital(tempHospital);
                    setSelectedModule(tempModule);
                    setSelectedIssueType(tempIssueType);
                  }
                }}
                className={`${styles.segmentedBtn} ${tempTimeRange === opt.id ? styles.segmentedBtnActive : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {tempTimeRange === 'custom' ? (
          <div className={styles.filterCustomDates}>
            <Input
              id="dashboard-date-start"
              type="date"
              label="วันเริ่มต้น"
              value={tempCustomStart}
              onChange={(e) => setTempCustomStart(e.target.value)}
            />
            <Input
              id="dashboard-date-end"
              type="date"
              label="วันสิ้นสุด"
              value={tempCustomEnd}
              onChange={(e) => setTempCustomEnd(e.target.value)}
            />
          </div>
        ) : null}

        <div className={styles.filterFieldGroup}>
          <Select
            id="dashboard-filter-org"
            label="องค์กร / บริษัท"
            value={tempHospital}
            onChange={(e) => setTempHospital(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {organizationsList.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.filterFieldGroup}>
          <Select
            id="dashboard-filter-module"
            label="โมดูล"
            value={tempModule}
            onChange={(e) => setTempModule(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {modulesList.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.filterFieldGroup}>
          <Select
            id="dashboard-filter-type"
            label="ประเภทงาน"
            value={tempIssueType}
            onChange={(e) => setTempIssueType(e.target.value)}
          >
            <option value="">ทั้งหมด</option>
            {issueTypesList.map((item) => (
              <option key={item.name} value={item.name}>
                {item.name}
              </option>
            ))}
          </Select>
        </div>

        <div className={styles.filterActions}>
          <Button
            variant={hasPendingFilterChanges ? 'primary' : 'secondary'}
            size="md"
            onClick={() => {
              setSelectedHospital(tempHospital);
              setSelectedModule(tempModule);
              setSelectedIssueType(tempIssueType);
              setTimeRange(tempTimeRange);
              if (tempTimeRange === 'custom') {
                setCustomStart(tempCustomStart);
                setCustomEnd(tempCustomEnd);
              }
            }}
          >
            ใช้ตัวกรอง
          </Button>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="md"
              onClick={() => {
                setTempHospital('');
                setTempModule('');
                setTempIssueType('');
                setSelectedHospital('');
                setSelectedModule('');
                setSelectedIssueType('');
                setTempTimeRange('week');
                setTimeRange('week');
                setTempCustomStart('');
                setTempCustomEnd('');
                setCustomStart('');
                setCustomEnd('');
              }}
            >
              ล้างตัวกรอง
            </Button>
          ) : null}
        </div>
      </section>

      {/* 4-Column Executive KPI Strip */}
      <section aria-label="ตัวชี้วัดหลัก">
        <div className={styles.kpiGrid}>
          <KPICard
            title={t('dashboard.todayTickets')}
            value={stats.totalToday}
            icon={Ticket}
            iconColor="var(--color-primary)"
            iconBg="var(--color-primary-soft)"
            trend={stats.trendPct}
            trendLabel={t('dashboard.comparedToYesterday')}
          />
          <KPICard
            title={t('dashboard.newTickets')}
            value={stats.newTickets}
            icon={MessageSquare}
            iconColor="var(--color-info)"
            iconBg="var(--color-info-soft)"
          />
          <KPICard
            title={t('dashboard.inProgress')}
            value={stats.inProgress}
            icon={Clock}
            iconColor="var(--color-warning)"
            iconBg="var(--color-warning-soft)"
          />
          <KPICard
            title={t('dashboard.resolved')}
            value={stats.resolved}
            icon={CheckCircle}
            iconColor="var(--color-success)"
            iconBg="var(--color-success-soft)"
          />
        </div>
      </section>

      <Suspense
        fallback={
          <div className={styles.asymmetricGrid}>
            <Card>
              <CardBody>
                <Skeleton width="30%" height={20} marginBottom={20} />
                <Skeleton width="100%" height={280} />
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Skeleton width="45%" height={20} marginBottom={20} />
                <Skeleton width="100%" height={280} />
              </CardBody>
            </Card>
          </div>
        }
      >
        <DashboardChartsSection
          trendData={trendData}
          statusData={statusData}
          organizationData={organizationData}
          agentData={agentData}
          recentLogs={recentLogs}
          totalAll={stats.totalAll}
          avgCsat={stats.avgCsat}
          escalatedCount={stats.escalated}
          pendingCount={stats.pending}
          labels={{
            ticketTrend: t('dashboard.ticketTrend'),
            newTickets: t('dashboard.newTickets'),
            resolved: t('dashboard.resolved'),
            statusDistribution: t('dashboard.statusDistribution'),
            allTab: t('dashboard.tabs.all'),
            priorityBreakdown: t('dashboard.priorityBreakdown'),
            organizationWorkload: t('dashboard.organizationWorkload'),
            agentWorkload: t('dashboard.agentWorkload'),
            recentActivity: t('dashboard.recentActivity'),
            noResults: t('common.messages.noResults'),
            heatmapVolume: t('dashboard.heatmapVolume') || 'ปริมาณใบงานรายชั่วโมง',
            urgentQueue: 'คิวงานเร่งด่วน',
            escalated: 'ส่งต่อ (Escalated)',
            pending: 'รอดำเนินการ',
          }}
          heatmapData={heatmap}
        />
      </Suspense>

      {previewData ? (
        <ExportPreviewModal
          isOpen={showExportPreview}
          onClose={() => setShowExportPreview(false)}
          onDownload={handleExportDownload}
          onPrint={handleExportPrint}
          data={previewData}
        />
      ) : null}
    </div>
  );
}
