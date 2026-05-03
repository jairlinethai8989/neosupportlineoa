'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';

// Dynamic import: recharts (~300KB) and dnd useSortable loaded only when Analytics page is visited
const SortableWidget = dynamic(
  () => import('@/components/analytics/SortableWidget').then(m => m.SortableWidget),
  {
    ssr: false,
    loading: () => (
      <div className="glass" style={{ height: '340px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
        กำลังโหลดกราฟ...
      </div>
    ),
  }
);
import { DateTime } from 'luxon';
import { supabase } from '@/lib/supabase';
import { exportDashboardAsPDF, printDataTable } from '@/lib/utils/exportUtils';
import Skeleton from '@/components/ui/Skeleton';
import { ExportPreviewModal, type ExportPreviewData } from '@/components/ui/ExportPreviewModal';

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

function getTicketCategoryLabel(ticket: any): string {
  const issueType = String(ticket?.issue_type || '').trim();
  if (issueType) return issueType;

  const subject = String(ticket?.subject || '').trim();
  if (!subject) return 'Other';

  const separatorIndex = subject.indexOf(':');
  if (separatorIndex > 0) {
    return subject.slice(0, separatorIndex).trim() || subject;
  }

  return subject;
}

/**
 * 2. Main Analytics Page
 */
export default function AdvancedAnalyticsPage() {
  const [activeWidgets, setActiveWidgets] = useState<string[]>(DEFAULT_WIDGET_LAYOUT);
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ months: 1 }).toISODate(),
    end: DateTime.now().toISODate()
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);
  const [pendingFormat, setPendingFormat] = useState<'excel' | 'pdf' | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [ticketsRes, csatRes] = await Promise.all([
        supabase
          .from('tickets')
          .select(`
            id,
            ticket_no,
            subject,
            status,
            priority,
            issue_type,
            created_at,
            resolved_at
          `)
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end)
          .order('created_at', { ascending: false }),
        supabase
          .from('csat_surveys')
          .select('rating, score, created_at')
          .or('rating.not.is.null,score.not.is.null')
          .gte('created_at', dateRange.start)
          .lte('created_at', dateRange.end)
      ]);

      setTickets(ticketsRes.data || []);
      // Pre-calculate CSAT to state or helper
      (window as any)._csat_data = csatRes.data || [];
    } catch (err) {
      console.error('Fetch analytics failed:', err);
    } finally {
      setLoading(false);
    }
  }, [dateRange.end, dateRange.start]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const chartDataMap = useMemo(() => {
    if (!tickets.length) return {};
    
    // 1. Status & Priority
    const statusCounts = tickets.reduce((acc: any, t) => { acc[t.status] = (acc[t.status] || 0) + 1; return acc; }, {});
    const priorityCounts = tickets.reduce((acc: any, t) => { acc[t.priority] = (acc[t.priority] || 0) + 1; return acc; }, {});
    const categoryCounts = tickets.reduce((acc: any, t) => { 
      const cat = getTicketCategoryLabel(t);
      acc[cat] = (acc[cat] || 0) + 1; 
      return acc; 
    }, {});

    // 2. Trend (Date Grouping)
    const dailyCounts = tickets.reduce((acc: any, t) => {
      const date = DateTime.fromISO(t.created_at).toFormat('dd MMM');
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});
    const trendData = Object.entries(dailyCounts).map(([name, value]) => ({ name, value })).sort((a,b) => a.name.localeCompare(b.name));

    // 3. Peak Hours
    const hourlyCounts = tickets.reduce((acc: any, t) => {
      const hour = DateTime.fromISO(t.created_at).hour;
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {});
    const peakData = Array.from({ length: 24 }, (_, i) => ({ name: `${i}:00`, value: hourlyCounts[i] || 0 }));

    // 4. Resolution Time (Hours)
    const resolutionData = tickets
      .filter(t => t.resolved_at)
      .map(t => {
        const diff = DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours;
        return { name: t.ticket_no, value: parseFloat(diff.toFixed(1)) };
      }).slice(0, 10);

    // 5. CSAT
    const csatRaw = (window as any)._csat_data || [];
    const csatData = csatRaw.reduce((acc: any, c: any) => {
      // Standardization: use 'score' as canonical, fallback to 'rating' for legacy data
      const score = c.score || c.rating || 0;
      if (score === 0) return acc;
      acc[score] = (acc[score] || 0) + 1;
      return acc;
    }, {});

    return {
      'bar-status': Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      'pie-priority': Object.entries(priorityCounts).map(([name, value]) => ({ name, value })),
      'line-trend': trendData,
      'area-volume': trendData, // Reuse trend for volume
      'bar-category': Object.entries(categoryCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => Number(b.value) - Number(a.value))
        .slice(0, 12),
      'area-peak': peakData,
      'bar-resolution': resolutionData,
      'line-csat': Object.entries(csatData).map(([name, value]) => ({ name: `Score ${name}`, value })),
      'pie-sla': [
        { name: 'Compliant', value: tickets.filter(t => !t.resolved_at || DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours < 24).length },
        { name: 'Breached', value: tickets.filter(t => t.resolved_at && DateTime.fromISO(t.resolved_at).diff(DateTime.fromISO(t.created_at), 'hours').hours >= 24).length },
      ],
      'pie-channel': [
        { name: 'LINE OA', value: tickets.length },
        { name: 'Web Portal', value: 0 },
        { name: 'API', value: 0 }
      ],
      // Remaining are Mock
      'radar-agent': [
        { name: 'Speed', value: 80 }, { name: 'CSAT', value: 95 }, { name: 'Volume', value: 70 }, 
        { name: 'FCR', value: 60 }, { name: 'Tech', value: 85 }
      ],
      'scatter-response': Array.from({ length: 20 }, (_, i) => ({ x: i, y: (i * 13 + 20) % 100 })),
    };
  }, [tickets]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setActiveWidgets((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleExport = (format: 'excel' | 'pdf') => {
    const preview: ExportPreviewData = {
      format,
      title: 'Executive Intelligence Report',
      subtitle: 'สรุปสถิติการดำเนินงาน • NEO SUPPORT',
      totalRecords: tickets.length,
      dateRange: `${dateRange.start} - ${dateRange.end}`,
      columns: format === 'excel' 
        ? ['No.', 'Subject', 'Status', 'Priority', 'Created']
        : ['Dashboard Summary', 'Statistics Charts', 'Data Tables']
    };
    setPendingFormat(format);
    setPreviewData(preview);
    setShowPreview(true);
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

  if (loading && !tickets.length) {
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

  return (
    <div className="animate-page-in">
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
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={activeWidgets} strategy={rectSortingStrategy}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '24px' }}>
            {activeWidgets.map(id => {
              const chart = CHART_TYPES.find(c => c.id === id);
              if (!chart) return null;
              return (
                <SortableWidget 
                  key={id} 
                  id={id} 
                  chart={chart} 
                  data={chartDataMap[id as keyof typeof chartDataMap] || []}
                  onRemove={(rid: string) => setActiveWidgets(prev => prev.filter(w => w !== rid))}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

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
