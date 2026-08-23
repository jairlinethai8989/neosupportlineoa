'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart as BarChartIcon, 
  PieChart as PieChartIcon, 
  LineChart as LineChartIcon,
  Calendar,
  Download,
  FileSpreadsheet,
  Settings,
  LayoutGrid,
  FileText as FileIcon,
  RefreshCw,
} from 'lucide-react';
import dynamic from 'next/dynamic';
const SortableWidgetGrid = dynamic(
  () => import('@/components/analytics/SortableWidgetGrid').then(m => m.SortableWidgetGrid),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="glass" style={{ height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
            กำลังโหลดกราฟ...
          </div>
        ))}
      </div>
    ),
  }
);
import { DateTime } from 'luxon';
import { exportDashboardAsPDF, printDataTable } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';
import { ExportPreviewModal, type ExportPreviewData } from '@/components/ui/ExportPreviewModal';

const PersonalAnalyticsPage = dynamic(() => import('./personal/page'));
const StaffAnalyticsPage = dynamic(() => import('./staff/page'));
const Evaluation360Page = dynamic(() => import('./staff/evaluation-360/page'));
const InsightsPage = dynamic(() => import('./insights/page'));
import { useAppContext } from '@/contexts/AppContext';
import useSWR from 'swr';
import {
  getAnalyticsDashboardAction,
  getDashboardExportTicketsAction,
} from '@/app/actions/dashboardActions';

/**
 * 1. Define Chart Types & Mock Logic for 16 variations
 */
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
  { id: 'scatter-load', name: 'ภาระงานรายวัน (Daily Load)', icon: LayoutGrid, type: 'scatter' }
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

/**
 * 2. Main Analytics Page
 */
export default function AdvancedAnalyticsPage() {
  const { userProfile } = useAppContext();
  
  // Tab permissions
  const showSupervisorTabs = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  const [activeTab, setActiveTab] = useState<string>('team');

  useEffect(() => {
    if (userProfile) {
      if (!showSupervisorTabs) {
        setActiveTab('personal');
      }
    }
  }, [userProfile, showSupervisorTabs]);

  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGET_LAYOUT);
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ months: 1 }).toISODate(),
    end: DateTime.now().toISODate()
  });

  const fetcher = async () => {
    return getAnalyticsDashboardAction({
      from: `${dateRange.start}T00:00:00.000Z`,
      to: `${dateRange.end}T23:59:59.999Z`,
    });
  };

  const currentKey = `analytics_${dateRange.start}_${dateRange.end}`;
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
      'area-volume': aggregatedData.trend_data || [], // Reuse trend for volume
      'bar-category': aggregatedData.category_data || [],
      'area-peak': aggregatedData.peak_data || [],
      'bar-resolution': aggregatedData.resolution_data || [],
      'line-csat': aggregatedData.csat_data || [],
      'pie-sla': aggregatedData.sla_data || [],
      'pie-channel': [
        { name: 'LINE OA', value: aggregatedData.total_records || 0 },
        { name: 'Web Portal', value: 0 },
        { name: 'API', value: 0 }
      ],
      // Map mock charts to actual database aggregates
      'radar-agent': (aggregatedData.priority_data || []).map((p: any) => ({
        name: p.name,
        value: p.value * 10 // scale up to look like performance index
      })),
      'scatter-response': (aggregatedData.resolution_data || []).map((r: any, idx: number) => ({
        x: idx + 1,
        y: r.value
      })),
      'scatter-load': (aggregatedData.peak_data || []).map((pk: any) => ({
        x: parseInt(pk.name.split(':')[0]) || 0,
        y: pk.value
      })),
    };
  }, [aggregatedData]);



  const handleExport = async (format: 'excel' | 'pdf') => {
    setExporting(true);
    let currentTickets = tickets;
    if (!currentTickets.length) {
      try {
        currentTickets = await getDashboardExportTicketsAction({
          from: `${dateRange.start}T00:00:00.000Z`,
          to: `${dateRange.end}T23:59:59.999Z`,
        });
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
      columns: format === 'excel' 
        ? ['No.', 'Subject', 'Status', 'Priority', 'Created']
        : ['Dashboard Summary', 'Statistics Charts', 'Data Tables']
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
          `/api/reports/analytics/export?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`,
          { method: 'GET' }
        );
        if (!res.ok) throw new Error(`Export failed (${res.status})`);

        const blob = await res.blob();
        const fileName =
          (res.headers.get('content-disposition') || '')
            .split('filename=')[1]
            ?.replaceAll('"', '')
            ?.trim() ||
          'Analytics_Report.xlsx';

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
          `/api/reports/analytics/export-pdf?start=${encodeURIComponent(dateRange.start)}&end=${encodeURIComponent(dateRange.end)}`,
          { method: 'GET' }
        );
        if (!res.ok) throw new Error(`Export failed (${res.status})`);

        const blob = await res.blob();
        const fileName =
          (res.headers.get('content-disposition') || '')
            .split('filename=')[1]
            ?.replaceAll('"', '')
            ?.trim() ||
          'Analytics_Report.pdf';

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
        alert('à¹„à¸¡à¹ˆà¸ªà¸²à¸¡à¸²à¸£à¸–à¸ªà¹ˆà¸‡à¸­à¸­à¸ PDF à¹„à¸”à¹‰ à¸à¸£à¸¸à¸“à¸²à¸¥à¸­à¸‡à¹ƒà¸«à¸¡à¹ˆà¸­à¸µà¸à¸„à¸£à¸±à¹‰à¸‡');
      } finally {
        setExporting(false);
      }
      return;
    }

    // Professional Multi-Page PDF Export
    setExporting(true);
    try {
      const html2canvas = await loadHtml2Canvas();
      const pages: string[] = [];
      const reportElement = document.getElementById('report-portal');
      const chartContainer = reportElement?.querySelector('#report-charts-grid');
      const tableContainer = reportElement?.querySelector('#report-table-container');
      
      if (!reportElement || !chartContainer || !tableContainer) return;

      // Prepare Chart Snapshots
      const capturedCharts: { name: string, image: string }[] = [];
      for (const id of activeWidgets) {
        const element = document.getElementById(`widget-${id}`);
        if (element) {
          const btn = element.querySelector('button');
          if (btn) btn.style.visibility = 'hidden';
          const canvas = await html2canvas(element, { backgroundColor: '#0a0e14', scale: 2, useCORS: true });
          if (btn) btn.style.visibility = 'visible';
          const info = CHART_TYPES.find(c => c.id === id);
          capturedCharts.push({ name: info?.name || 'Chart', image: canvas.toDataURL('image/png') });
        }
      }

      reportElement.style.display = 'block';

      // --- PAGE 1: Intro + First 4 Charts ---
      chartContainer.innerHTML = capturedCharts.slice(0, 4).map(c => `
        <div style="border: 1px solid #eeeeee; padding: 15px; border-radius: 12px; height: 100%; display: flex; flex-direction: column;">
           <p style="font-weight: 800; margin-bottom: 10px; font-size: 14px;">${c.name}</p>
           <img src="${c.image}" style="width: 100%; height: auto; border-radius: 4px;" />
        </div>
      `).join('');
      tableContainer.innerHTML = ''; 
      
      const canvas1 = await html2canvas(reportElement, { backgroundColor: '#ffffff', scale: 2, windowWidth: 1000 });
      pages.push(canvas1.toDataURL('image/png'));

      // --- PAGE 2: Next Charts (if any) ---
      if (capturedCharts.length > 4) {
        chartContainer.innerHTML = capturedCharts.slice(4, 10).map(c => `
          <div style="border: 1px solid #eeeeee; padding: 15px; border-radius: 12px;">
             <p style="font-weight: 800; margin-bottom: 10px; font-size: 14px;">${c.name}</p>
             <img src="${c.image}" style="width: 100%; height: auto; border-radius: 4px;" />
          </div>
        `).join('');
        const canvas2 = await html2canvas(reportElement, { backgroundColor: '#ffffff', scale: 2, windowWidth: 1000 });
        pages.push(canvas2.toDataURL('image/png'));
      }

      // --- PAGE 3+: Paginated Table ---
      const rowsPerPage = 22;
      for (let i = 0; i < tickets.length; i += rowsPerPage) {
        chartContainer.innerHTML = ''; 
        const chunk = tickets.slice(i, i + rowsPerPage);
        tableContainer.innerHTML = `
          <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 25px; color: #7367f0; border-left: 5px solid #7367f0; padding-left: 15px;">ตารางสรุปข้อมูล (หน้าที่ ${Math.floor(i/rowsPerPage) + 1})</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 40px;">
            <thead>
               <tr style="background: #7367f0; color: #ffffff;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #7367f0;">No.</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #7367f0;">Subject</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #7367f0;">Status</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #7367f0;">Priority</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #7367f0;">Created</th>
               </tr>
            </thead>
            <tbody>
               ${chunk.map((t, idx) => `
                  <tr style="background: ${idx % 2 === 0 ? '#fafafa' : '#ffffff'}">
                     <td style="padding: 10px; border: 1px solid #eeeeee">${t.ticket_no}</td>
                     <td style="padding: 10px; border: 1px solid #eeeeee">${t.subject}</td>
                     <td style="padding: 10px; border: 1px solid #eeeeee">${t.status}</td>
                     <td style="padding: 10px; border: 1px solid #eeeeee">${t.priority}</td>
                     <td style="padding: 10px; border: 1px solid #eeeeee">${DateTime.fromISO(t.created_at).toFormat('dd/MM/yyyy')}</td>
                  </tr>
               `).join('')}
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
    printDataTable(
      'Executive Intelligence Report',
      dataToPrint,
      `${dateRange.start} - ${dateRange.end}`
    );
  };

  if (activeTab === 'team' && loading && !aggregatedData) {
    return (
      <div className="animate-page-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
          <div style={{ flex: '1', minWidth: '300px' }}>
            <Skeleton width="50%" height={36} marginBottom={8} />
            <Skeleton width="40%" height={16} />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
             <Skeleton width={260} height={42} borderRadius={12} />
             <div style={{ display: 'flex', gap: '8px' }}>
                <Skeleton width={100} height={42} borderRadius={12} />
                <Skeleton width={100} height={42} borderRadius={12} />
             </div>
          </div>
        </div>

        <Skeleton width={200} height={36} borderRadius={20} marginBottom={32} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
              {DEFAULT_WIDGET_LAYOUT.map((widgetId, i) => (
                 <div key={i} className="glass" style={{ height: '340px', padding: '16px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Skeleton width={32} height={32} borderRadius={8} />
                      <Skeleton width={150} height={20} />
                   </div>
                   <Skeleton width={60} height={26} borderRadius={8} />
                </div>
                <div style={{ flex: 1, padding: '20px' }}>
                   <Skeleton width="100%" height="80%" marginBottom={16} />
                   <div style={{ display: 'flex', gap: '8px' }}>
                      <Skeleton width={80} height={20} />
                      <Skeleton width={80} height={20} />
                   </div>
                </div>
             </div>
          ))}
        </div>
      </div>
    );
  }

  // Tab Bar Render
  const renderTabBar = () => {
    if (!showSupervisorTabs) return null;
    
    const tabs = [
      { id: 'team', label: '📊 ภาพรวมทีม' },
      { id: 'personal', label: '👤 ผลงานส่วนตัว' },
      { id: 'staff', label: '🔍 สถิติพนักงาน' },
      { id: 'evaluation-360', label: '🏆 ประเมิน 360 องศา' },
      { id: 'insights', label: '🤖 คำแนะนำ AI' }
    ];

    return (
      <div 
        style={{ 
          position: 'sticky', 
          top: '-24px', 
          zIndex: 50, 
          background: 'var(--bg-deep)', 
          paddingTop: '16px', 
          paddingBottom: '16px', 
          borderBottom: '1px solid var(--border)', 
          marginRight: '-24px', 
          marginLeft: '-24px', 
          paddingRight: '24px', 
          paddingLeft: '24px',
          marginBottom: '24px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div 
          style={{ 
            display: 'inline-flex', 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '6px', 
            gap: '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            flexWrap: 'wrap'
          }}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="glass-interactive"
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: isActive ? '850' : '600',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 4px 15px rgba(0, 242, 254, 0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

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
    <div className="animate-page-in">
      {renderTabBar()}
      {/* Hidden Report Template for PDF Capture */}
      <div id="report-portal" style={{ 
        display: 'none', 
        width: '1000px', 
        minHeight: '1410px',
        background: '#ffffff', 
        padding: '60px', 
        color: '#000000',
        position: 'absolute',
        top: 0,
        left: '-9999px'
      }}>
        <div style={{ borderBottom: '4px solid #7367f0', paddingBottom: '20px', marginBottom: '40px' }}>
           <h1 style={{ fontSize: '32px', color: '#000000', marginBottom: '8px' }}>Executive Intelligence Report</h1>
           <p style={{ color: '#666666' }}>สรุปสถิติการดำเนินงาน • NEO SUPPORT DASHBOARD</p>
        </div>

        <div id="report-charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '20px' }}>
           {/* Injected JS */}
        </div>

        <div id="report-table-container">
           {/* Injected JS */}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '24px', marginBottom: '32px' }}>
        <div style={{ flex: '1', minWidth: '300px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '4px' }}>ศูนย์บริหารสถิติอัจฉริยะ</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>EXECUTIVE INTELLIGENCE CENTER (EIC) • Drag & Drop Workspace</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
           <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--border)', alignItems: 'center' }}>
              <Calendar size={14} color="var(--primary)" />
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange({...dateRange, start: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', fontWeight: '600', outline: 'none', width: '130px' }} 
              />
              <span style={{ color: 'var(--text-muted)' }}>-</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange({...dateRange, end: e.target.value})}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontSize: '14px', fontWeight: '600', outline: 'none', width: '130px' }} 
              />
           </div>

           <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => handleExport('excel')} 
                disabled={exporting}
                className="glass-interactive flex-center" 
                style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--success)', gap: '8px', fontWeight: 'bold', fontSize: '13px', opacity: exporting ? 0.5 : 1 }}
              >
                 <FileSpreadsheet size={18} /> EXCEL
              </button>
              <button 
                onClick={() => handleExport('pdf')} 
                disabled={exporting}
                className="glass-interactive flex-center" 
                style={{ height: '42px', padding: '0 16px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--danger)', gap: '8px', fontWeight: 'bold', fontSize: '13px', opacity: exporting ? 0.5 : 1 }}
              >
                 {exporting ? <RefreshCw size={18} className="animate-spin" /> : <Download size={18} />}
                 {exporting ? 'EXPORTING...' : 'PDF REPORT'}
              </button>
           </div>
        </div>
      </div>

      {/* Widget Selector Drawer */}
      <div style={{ marginBottom: '32px' }}>
         <button 
           onClick={() => setShowWidgetSelector(!showWidgetSelector)}
           className="glass-interactive"
           style={{ 
             padding: '8px 20px', 
             borderRadius: '20px', 
             border: '1px solid var(--primary)', 
             background: 'rgba(54, 153, 255, 0.1)',
             color: 'var(--primary)',
             fontSize: '13px', 
             fontWeight: '800', 
             display: 'flex', 
             alignItems: 'center', 
             gap: '10px',
             cursor: 'pointer',
             marginBottom: showWidgetSelector ? '20px' : '0'
           }}>
           <LayoutGrid size={16} /> 
           {showWidgetSelector ? 'ซ่อนเมนูเลือกวิดเจ็ต (Hide Drawer)' : 'เพิ่มวิดเจ็ต (Add Widgets)'}
         </button>

         <div style={{ 
            maxHeight: showWidgetSelector ? '1000px' : '0',
            overflow: 'hidden',
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            opacity: showWidgetSelector ? 1 : 0,
            borderBottom: showWidgetSelector ? '1px solid var(--border)' : 'none',
            paddingBottom: showWidgetSelector ? '24px' : '0'
         }}>
            <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-dim)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Available Statistics Widgets</p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
               {CHART_TYPES.map(ct => {
                 const isAdded = activeWidgets.includes(ct.id);
                 return (
                   <button 
                     key={ct.id}
                     onClick={() => !isAdded && setActiveWidgets([...activeWidgets, ct.id])}
                     disabled={isAdded}
                     className="glass-interactive"
                     style={{ 
                       padding: '8px 14px', 
                       borderRadius: '10px', 
                       border: '1px solid ' + (isAdded ? 'var(--success)' : 'var(--border)'), 
                       fontSize: '12.5px', 
                       fontWeight: '700',
                       display: 'flex', 
                       alignItems: 'center', 
                       gap: '8px',
                       background: isAdded ? 'rgba(40, 199, 111, 0.05)' : 'rgba(255,255,255,0.03)',
                       cursor: isAdded ? 'default' : 'pointer',
                       color: isAdded ? 'var(--success)' : 'var(--text-muted)',
                       transition: 'all 0.2s ease',
                       minWidth: '180px',
                       justifyContent: 'flex-start'
                     }}>
                     <ct.icon size={14} color={isAdded ? 'var(--success)' : 'var(--primary)'} /> 
                     <span style={{ color: isAdded ? 'var(--success)' : 'inherit' }}>{ct.name}</span>
                   </button>
                 );
               })}
            </div>
         </div>
      </div>

      {/* Dashboard Grid with DND */}
      <SortableWidgetGrid
        activeWidgets={activeWidgets}
        setActiveWidgets={setActiveWidgets}
        CHART_TYPES={CHART_TYPES}
        chartDataMap={chartDataMap}
      />

      {loading && (
        <div style={{ position: 'fixed', bottom: '40px', left: '50%', transform: 'translateX(-50%)', background: 'var(--primary)', color: 'black', padding: '12px 24px', borderRadius: '30px', fontWeight: '900', boxShadow: '0 8px 32px rgba(0,242,254,0.4)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <RefreshCw size={20} className="animate-spin" />
          กำลังวิเคราะห์ข้อมูล...
        </div>
      )}

      {previewData && (
        <ExportPreviewModal 
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={executeExport}
          onPrint={executePrint}
          data={previewData}
          loading={exporting}
        />
      )}
    </div>
  );
}
