'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  FileSpreadsheet,
  Settings,
  LayoutGrid,
  FileText as FileIcon,
  RefreshCw,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase';
import { exportDashboardAsPDF, printDataTable } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';
import {
  Button,
  Card,
  CardBody,
  ExportPreviewModal,
  Input,
  PageHeader,
  type ExportPreviewData,
} from '@/components/ui';
import { useAppContext } from '@/contexts/AppContext';
import useSWR from 'swr';
import styles from '@/components/analytics/analytics.module.css';

const SortableWidgetGrid = dynamic(
  () => import('@/components/analytics/SortableWidgetGrid').then((m) => m.SortableWidgetGrid),
  {
    ssr: false,
    loading: () => (
      <div className={styles.widgetGrid}>
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardBody>
              <Skeleton width="45%" height={20} marginBottom={16} />
              <Skeleton width="100%" height={240} />
            </CardBody>
          </Card>
        ))}
      </div>
    ),
  }
);

const PersonalAnalyticsPage = dynamic(() => import('./personal/page'));
const StaffAnalyticsPage = dynamic(() => import('./staff/page'));
const Evaluation360Page = dynamic(() => import('./staff/evaluation-360/page'));
const InsightsPage = dynamic(() => import('./insights/page'));

const CHART_TYPES = [
  { id: 'bar-status', name: 'งานแยกตามสถานะ (Status Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-priority', name: 'สัดส่วนความสำคัญ (Priority Pie)', icon: PieChartIcon, type: 'pie' },
  { id: 'line-trend', name: 'แนวโน้มใบงาน (Ticket Trend)', icon: LineChartIcon, type: 'line' },
  { id: 'area-volume', name: 'ปริมาณภาระงาน (Volume Area)', icon: LineChartIcon, type: 'area' },
  { id: 'radar-agent', name: 'สมรรถนะแอดมิน (Agent Radar)', icon: Settings, type: 'radar' },
  { id: 'scatter-response', name: 'เวลาตอบกลับ (Response Scatter)', icon: LayoutGrid, type: 'scatter' },
  { id: 'bar-category', name: 'หมวดหมู่ปัญหา (Category Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-sla', name: 'สถานะ SLA (SLA Compliance)', icon: PieChartIcon, type: 'pie' },
  { id: 'composed-mix', name: 'ภาพรวมผสม (Mixed Overview)', icon: LayoutGrid, type: 'composed' },
  { id: 'tree-tags', name: 'แท็กยอดนิยม (Tag Treemap)', icon: FileIcon, type: 'treemap' },
  { id: 'line-csat', name: 'ความพึงพอใจ (CSAT Trend)', icon: LineChartIcon, type: 'line' },
  { id: 'bar-resolution', name: 'เวลาปิดงาน (Resolution Bar)', icon: BarChartIcon, type: 'bar' },
  { id: 'pie-channel', name: 'ช่องทางแจ้งเรื่อง (Channel Pie)', icon: PieChartIcon, type: 'pie' },
  { id: 'area-peak', name: 'ช่วงเวลาที่งานเยอะ (Peak Hours)', icon: LineChartIcon, type: 'area' },
  { id: 'radar-skill', name: 'ทักษะทีมงาน (Team Skills)', icon: Settings, type: 'radar' },
  { id: 'scatter-load', name: 'ภาระงานรายวัน (Daily Load)', icon: LayoutGrid, type: 'scatter' },
];

const DEFAULT_WIDGET_LAYOUT = [
  'bar-status',
  'bar-category',
  'line-trend',
  'pie-priority',
  'area-peak',
  'line-csat',
];

let html2CanvasPromise: Promise<(typeof import('html2canvas'))['default']> | null = null;

async function loadHtml2Canvas() {
  if (!html2CanvasPromise) {
    html2CanvasPromise = import('html2canvas').then((module) => module.default);
  }
  return html2CanvasPromise;
}

export default function AdvancedAnalyticsPage() {
  const { userProfile, effectiveProjectIds, selectedProjectId, projectsLoaded } = useAppContext();

  const showSupervisorTabs = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  const [activeTab, setActiveTab] = useState<string>('team');

  useEffect(() => {
    if (userProfile && !showSupervisorTabs) {
      setActiveTab('personal');
    }
  }, [userProfile, showSupervisorTabs]);

  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGET_LAYOUT);
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ months: 1 }).toISODate(),
    end: DateTime.now().toISODate(),
  });

  const fetcher = async () => {
    if (Array.isArray(effectiveProjectIds) && effectiveProjectIds.length === 0) {
      return {
        total_records: 0,
        status_data: [],
        priority_data: [],
        trend_data: [],
        category_data: [],
        peak_data: [],
        resolution_data: [],
        csat_data: [],
        sla_data: [],
      };
    }
    const { data, error } = await supabase.rpc('get_analytics_dashboard_v2', {
      start_date: dateRange.start,
      end_date: dateRange.end,
      p_project_ids: effectiveProjectIds,
    });
    if (error) throw error;
    return data;
  };

  const currentKey = projectsLoaded
    ? `analytics_${dateRange.start}_${dateRange.end}_${selectedProjectId}_${(effectiveProjectIds || []).join(',')}`
    : null;
  const { data: aggregatedData, isLoading: isSwrLoading } = useSWR(currentKey, fetcher);
  const loading = isSwrLoading && !aggregatedData;

  const [exporting, setExporting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [pendingFormat, setPendingFormat] = useState<'excel' | 'pdf' | null>(null);

  const chartDataMap = useMemo(() => {
    if (!aggregatedData) return {};

    return {
      'bar-status': aggregatedData.status_data || [],
      'pie-priority': aggregatedData.priority_data || [],
      'line-trend': aggregatedData.trend_data || [],
      'area-volume': aggregatedData.trend_data || [],
      'bar-category': aggregatedData.category_data || [],
      'area-peak': aggregatedData.peak_data || [],
      'bar-resolution': aggregatedData.resolution_data || [],
      'line-csat': aggregatedData.csat_data || [],
      'pie-sla': aggregatedData.sla_data || [],
      'pie-channel': [
        { name: 'LINE OA', value: aggregatedData.total_records || 0 },
        { name: 'Web Portal', value: 0 },
        { name: 'API', value: 0 },
      ],
      'radar-agent': (aggregatedData.priority_data || []).map((p: any) => ({
        name: p.name,
        value: p.value * 10,
      })),
      'scatter-response': (aggregatedData.resolution_data || []).map((r: any, idx: number) => ({
        x: idx + 1,
        y: r.value,
      })),
      'scatter-load': (aggregatedData.peak_data || []).map((pk: any) => ({
        x: parseInt(pk.name.split(':')[0]) || 0,
        y: pk.value,
      })),
    };
  }, [aggregatedData]);

  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    let currentTickets = tickets;
    if (!currentTickets.length) {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            id,
            ticket_no,
            subject,
            status,
            priority,
            created_at,
            resolved_at
          `)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end)
          .order('created_at', { ascending: false })
          .limit(5000);

        if (error) throw error;
        currentTickets = data || [];
        setTickets(currentTickets);
      } catch (err) {
        console.error('Fetch raw tickets for export failed:', err);
        alert('ไม่สามารถดึงข้อมูลตั๋วงานดิบสำหรับการส่งออกได้');
        setExporting(false);
        return;
      }
    }

    const preview: ExportPreviewData = {
      format,
      title: 'Executive Intelligence Report',
      subtitle: 'สรุปสถิติการดำเนินงาน • NEO SUPPORT',
      totalRecords: currentTickets.length,
      dateRange: `${dateRange.start} - ${dateRange.end}`,
      columns:
        format === 'excel'
          ? ['No.', 'Subject', 'Status', 'Priority', 'Created']
          : ['Dashboard Summary', 'Statistics Charts', 'Data Tables'],
    };
    setPendingFormat(format);
    setPreviewData(preview);
    setShowPreview(true);
    setExporting(false);
  };

  const executeExport = async () => {
    if (!pendingFormat) return;
    const format = pendingFormat;
    setShowPreview(false);
    if (format === 'excel') {
      setExporting(true);
      try {
        const res = await fetch(
          `/api/reports/analytics/export?start=${encodeURIComponent(dateRange.start || '')}&end=${encodeURIComponent(dateRange.end || '')}`,
          { method: 'GET' }
        );
        if (!res.ok) throw new Error(`Export failed (${res.status})`);

        const blob = await res.blob();
        const fileName =
          (res.headers.get('content-disposition') || '')
            .split('filename=')[1]
            ?.replaceAll('"', '')
            ?.trim() || 'Analytics_Report.xlsx';

        const blobUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Analytics excel export failed:', error);
        alert('ไม่สามารถส่งออก Excel ได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setExporting(false);
      }
      return;
    }

    if (format === 'pdf') {
      setExporting(true);
      try {
        const res = await fetch(
          `/api/reports/analytics/export-pdf?start=${encodeURIComponent(dateRange.start || '')}&end=${encodeURIComponent(dateRange.end || '')}`,
          { method: 'GET' }
        );
        if (!res.ok) throw new Error(`Export failed (${res.status})`);

        const blob = await res.blob();
        const fileName =
          (res.headers.get('content-disposition') || '')
            .split('filename=')[1]
            ?.replaceAll('"', '')
            ?.trim() || 'Analytics_Report.pdf';

        const blobUrl = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(blobUrl);
      } catch (error) {
        console.error('Analytics pdf export failed:', error);
        alert('ไม่สามารถส่งออก PDF ได้ กรุณาลองใหม่อีกครั้ง');
      } finally {
        setExporting(false);
      }
      return;
    }

    setExporting(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const pages: string[] = [];
      const reportElement = document.getElementById('report-portal');
      const chartContainer = reportElement?.querySelector('#report-charts-grid');
      const tableContainer = reportElement?.querySelector('#report-table-container');

      if (!reportElement || !chartContainer || !tableContainer) return;

      const capturedCharts: { name: string; image: string }[] = [];
      for (const id of activeWidgets) {
        const element = document.getElementById(`widget-${id}`);
        if (element) {
          const btn = element.querySelector('button');
          if (btn) btn.style.visibility = 'hidden';
          const canvas = await html2canvas(element, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
          if (btn) btn.style.visibility = 'visible';
          const info = CHART_TYPES.find((c) => c.id === id);
          capturedCharts.push({ name: info?.name || 'Chart', image: canvas.toDataURL('image/png') });
        }
      }

      reportElement.style.display = 'block';

      chartContainer.innerHTML = capturedCharts
        .slice(0, 4)
        .map(
          (c) => `
        <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
           <p style="font-weight: 700; margin-bottom: 10px; font-size: 14px;">${c.name}</p>
           <img src="${c.image}" style="width: 100%; height: auto; border-radius: 4px;" />
        </div>
      `
        )
        .join('');
      tableContainer.innerHTML = '';

      const canvas1 = await html2canvas(reportElement, { backgroundColor: '#ffffff', scale: 2, windowWidth: 1000 });
      pages.push(canvas1.toDataURL('image/png'));

      if (capturedCharts.length > 4) {
        chartContainer.innerHTML = capturedCharts
          .slice(4, 10)
          .map(
            (c) => `
          <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px;">
             <p style="font-weight: 700; margin-bottom: 10px; font-size: 14px;">${c.name}</p>
             <img src="${c.image}" style="width: 100%; height: auto; border-radius: 4px;" />
          </div>
        `
          )
          .join('');
        const canvas2 = await html2canvas(reportElement, { backgroundColor: '#ffffff', scale: 2, windowWidth: 1000 });
        pages.push(canvas2.toDataURL('image/png'));
      }

      const rowsPerPage = 22;
      for (let i = 0; i < tickets.length; i += rowsPerPage) {
        chartContainer.innerHTML = '';
        const chunk = tickets.slice(i, i + rowsPerPage);
        tableContainer.innerHTML = `
          <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 25px; color: #1D4ED8; border-left: 5px solid #1D4ED8; padding-left: 15px;">ตารางสรุปข้อมูล (หน้าที่ ${Math.floor(i / rowsPerPage) + 1})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 40px;">
            <thead>
               <tr style="background: #1D4ED8; color: #ffffff;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #1D4ED8;">No.</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #1D4ED8;">Subject</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #1D4ED8;">Status</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #1D4ED8;">Priority</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #1D4ED8;">Created</th>
               </tr>
            </thead>
            <tbody>
               ${chunk
                 .map(
                   (t, idx) => `
                  <tr style="background: ${idx % 2 === 0 ? '#f8fafc' : '#ffffff'}">
                     <td style="padding: 10px; border: 1px solid #e2e8f0">${t.ticket_no}</td>
                     <td style="padding: 10px; border: 1px solid #e2e8f0">${t.subject}</td>
                     <td style="padding: 10px; border: 1px solid #e2e8f0">${t.status}</td>
                     <td style="padding: 10px; border: 1px solid #e2e8f0">${t.priority}</td>
                     <td style="padding: 10px; border: 1px solid #e2e8f0">${DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy')}</td>
                  </tr>
               `
                 )
                 .join('')}
            </tbody>
          </table>
        `;
        const canvasTable = await html2canvas(reportElement, { backgroundColor: '#ffffff', scale: 2, windowWidth: 1000 });
        pages.push(canvasTable.toDataURL('image/png'));
      }

      await exportDashboardAsPDF('Executive Intelligence Report', pages, 'NeoSupport_Full_Report');
      reportElement.style.display = 'none';
    } catch (err) {
      console.error('Multi-page Export error:', err);
      alert('การส่งออกผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setExporting(false);
    }
  };

  const executePrint = () => {
    if (!pendingFormat) return;

    const dataToPrint = tickets.map((t) => ({
      'No.': t.ticket_no,
      Subject: t.subject,
      Status: t.status,
      Priority: t.priority,
      Created: DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy'),
    }));

    setShowPreview(false);
    printDataTable('Executive Intelligence Report', dataToPrint, `${dateRange.start} - ${dateRange.end}`);
  };

  const renderTabBar = () => {
    if (!showSupervisorTabs) return null;

    const tabs = [
      { id: 'team', label: 'ภาพรวมทีม' },
      { id: 'personal', label: 'ผลงานส่วนตัว' },
      { id: 'staff', label: 'สถิติพนักงาน' },
      { id: 'evaluation-360', label: 'ประเมิน 360 องศา' },
      { id: 'insights', label: 'คำแนะนำ AI' },
    ];

    return (
      <div className={styles.tabBarSticky}>
        <div className={styles.tabList} role="tablist" aria-label="หมวดหมู่วิเคราะห์ข้อมูล">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (activeTab === 'team' && loading && !aggregatedData) {
    return (
      <div className={`animate-page-in ${styles.pageStack}`}>
        {renderTabBar()}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Skeleton width={260} height={32} marginBottom={8} />
            <Skeleton width={200} height={16} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Skeleton width={120} height={36} borderRadius={8} />
            <Skeleton width={120} height={36} borderRadius={8} />
          </div>
        </div>
        <div className={styles.widgetGrid}>
          {DEFAULT_WIDGET_LAYOUT.map((_widgetId, i) => (
            <Card key={i}>
              <CardBody>
                <Skeleton width="45%" height={20} marginBottom={16} />
                <Skeleton width="100%" height={240} />
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === 'personal') {
    return (
      <div className="animate-page-in">
        {renderTabBar()}
        <PersonalAnalyticsPage />
      </div>
    );
  }
  if (activeTab === 'staff') {
    return (
      <div className="animate-page-in">
        {renderTabBar()}
        <StaffAnalyticsPage />
      </div>
    );
  }
  if (activeTab === 'evaluation-360') {
    return (
      <div className="animate-page-in">
        {renderTabBar()}
        <Evaluation360Page />
      </div>
    );
  }
  if (activeTab === 'insights') {
    return (
      <div className="animate-page-in">
        {renderTabBar()}
        <InsightsPage />
      </div>
    );
  }

  return (
    <div className={`animate-page-in ${styles.pageStack}`}>
      {renderTabBar()}

      <div
        id="report-portal"
        style={{
          display: 'none',
          width: '1000px',
          minHeight: '1410px',
          background: '#ffffff',
          padding: '60px',
          color: '#0f172a',
          position: 'absolute',
          top: 0,
          left: '-9999px',
        }}
      >
        <div style={{ borderBottom: '4px solid #1D4ED8', paddingBottom: '20px', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '32px', color: '#0f172a', marginBottom: '8px' }}>Executive Intelligence Report</h1>
          <p style={{ color: '#475569' }}>สรุปสถิติการดำเนินงาน • NEO SUPPORT DASHBOARD</p>
        </div>

        <div id="report-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px' }} />
        <div id="report-table-container" />
      </div>

      <PageHeader
        title="ศูนย์บริหารสถิติอัจฉริยะ"
        subtitle="จัดเรียงวิดเจ็ตสถิติและส่งออกรายงานตามช่วงเวลาที่ต้องการ"
        actions={
          <div className={styles.toolbarRow}>
            <div className={styles.dateRangeCluster}>
              <Input
                id="analytics-start-date"
                type="date"
                label="วันเริ่มต้น"
                value={dateRange.start || ''}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              />
              <Input
                id="analytics-end-date"
                type="date"
                label="วันสิ้นสุด"
                value={dateRange.end || ''}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              />
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={() => handleExport('excel')}
              disabled={exporting}
              leftIcon={<FileSpreadsheet size={16} color="var(--color-success)" aria-hidden="true" />}
            >
              Excel
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => handleExport('pdf')}
              loading={exporting}
              leftIcon={<Download size={16} aria-hidden="true" />}
            >
              {exporting ? 'กำลังส่งออก...' : 'รายงาน PDF'}
            </Button>
          </div>
        }
      />

      <div>
        <Button
          variant={showWidgetSelector ? 'primary' : 'secondary'}
          size="md"
          onClick={() => setShowWidgetSelector((prev) => !prev)}
          leftIcon={<LayoutGrid size={16} aria-hidden="true" />}
          aria-expanded={showWidgetSelector}
        >
          {showWidgetSelector ? 'ซ่อนเมนูเลือกวิดเจ็ต' : 'เพิ่มวิดเจ็ต'}
        </Button>

        {showWidgetSelector ? (
          <div className={styles.widgetDrawer}>
            <p className={styles.widgetDrawerTitle}>วิดเจ็ตสถิติที่เลือกเพิ่มได้</p>
            <div className={styles.widgetChipGrid}>
              {CHART_TYPES.map((ct) => {
                const isAdded = activeWidgets.includes(ct.id);
                return (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => !isAdded && setActiveWidgets([...activeWidgets, ct.id])}
                    disabled={isAdded}
                    className={`${styles.widgetChip} ${isAdded ? styles.widgetChipAdded : ''}`}
                  >
                    <ct.icon size={14} color={isAdded ? 'var(--color-success)' : 'var(--color-primary)'} aria-hidden="true" />
                    <span>{ct.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <SortableWidgetGrid
        activeWidgets={activeWidgets}
        setActiveWidgets={setActiveWidgets}
        CHART_TYPES={CHART_TYPES}
        chartDataMap={chartDataMap}
      />

      {loading ? (
        <div className={styles.loadingToast} role="status" aria-live="polite">
          <RefreshCw size={16} className="animate-spin" aria-hidden="true" />
          กำลังวิเคราะห์ข้อมูล...
        </div>
      ) : null}

      {previewData ? (
        <ExportPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={executeExport}
          onPrint={executePrint}
          data={previewData}
          loading={exporting}
        />
      ) : null}
    </div>
  );
}
