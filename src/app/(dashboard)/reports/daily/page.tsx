'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Download,
  Loader2,
  AlignLeft,
  Filter,
  ArrowUpDown,
  Search,
  X,
  Share2,
} from 'lucide-react';
import Skeleton from '@/components/ui/Skeleton';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useAppContext } from '@/contexts/AppContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  ExportPreviewModal,
  Input,
  PageHeader,
  type ExportPreviewData,
} from '@/components/ui';
import { useNotificationContext } from '@/contexts/NotificationContext';
import styles from '@/components/reports/reports.module.css';

type ExportUtilsModule = typeof import('@/lib/utils/exportUtils');

let printUtilsPromise: Promise<ExportUtilsModule> | null = null;

async function loadExportUtils(): Promise<ExportUtilsModule> {
  if (!printUtilsPromise) {
    printUtilsPromise = import('@/lib/utils/exportUtils');
  }
  return printUtilsPromise;
}

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
} | null;

type ReportColumn = {
  id: string;
  label: string;
  sortKey: string;
};

const INITIAL_COLUMN_WIDTHS: Record<string, number> = {
  sequence: 72,
  status: 96,
  date: 120,
  organization: 170,
  customer: 130,
  subject: 190,
  additionalDetails: 180,
  resolution: 250,
  assignee: 170,
  source: 125,
  module: 120,
  type: 120,
  createdTime: 120,
  resolvedTime: 120,
  timeUsed: 150,
};

type DailyPreviewRow = {
  id: string;
  status: string;
  created_at: string;
  resolved_at: string | null;
  subject_only: string;
  description: string;
  resolution_summary: string;
  source: string;
  module: string;
  issue_type: string;
  priority: string;
  hospital_name: string;
  customer_name: string;
  assignee_name: string;
  assignee_color: string;
  duration_ms: number;
};

export default function DailyReportPage() {
  const { t } = useStaffLocale();
  const { userProfile, companySettings } = useAppContext();
  const [tickets, setTickets] = useState<DailyPreviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const [preset, setPreset] = useState('today');
  const [isExporting, setIsExporting] = useState(false);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [filterText, setFilterText] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(INITIAL_COLUMN_WIDTHS);

  useEffect(() => {
    if (userProfile?.id) {
      try {
        const saved = localStorage.getItem(`neo_report_columnWidths_${userProfile.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          setColumnWidths((prev) => ({ ...prev, ...parsed }));
        }
      } catch {}
    }
  }, [userProfile?.id]);

  useEffect(() => {
    if (userProfile?.id && columnWidths !== INITIAL_COLUMN_WIDTHS) {
      const timeoutId = setTimeout(() => {
        localStorage.setItem(`neo_report_columnWidths_${userProfile.id}`, JSON.stringify(columnWidths));
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [columnWidths, userProfile?.id]);

  const { addToast } = useNotificationContext();

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<ExportPreviewData | null>(null);

  const [isExportingGSheets, setIsExportingGSheets] = useState(false);
  const [isExportingLark, setIsExportingLark] = useState(false);

  const columns: ReportColumn[] = useMemo(
    () => [
      { id: 'sequence', label: t('reports.columns.sequence') || 'ลำดับ', sortKey: 'sequence' },
      { id: 'status', label: t('reports.columns.status'), sortKey: 'status' },
      { id: 'date', label: t('reports.columns.date'), sortKey: 'date' },
      { id: 'organization', label: t('reports.columns.organization'), sortKey: 'organization' },
      { id: 'customer', label: t('reports.columns.customer'), sortKey: 'customer' },
      { id: 'subject', label: t('reports.columns.subject'), sortKey: 'subject' },
      { id: 'additionalDetails', label: t('reports.columns.additionalDetails'), sortKey: 'description' },
      { id: 'resolution', label: t('reports.columns.resolution'), sortKey: 'resolution' },
      { id: 'assignee', label: t('reports.columns.assignee'), sortKey: 'agent' },
      { id: 'source', label: t('reports.columns.source'), sortKey: 'source' },
      { id: 'module', label: t('reports.columns.module'), sortKey: 'module' },
      { id: 'type', label: t('reports.columns.type'), sortKey: 'type' },
      { id: 'createdTime', label: t('reports.columns.createdTime'), sortKey: 'date' },
      { id: 'resolvedTime', label: t('reports.columns.resolvedTime'), sortKey: 'resolved_at' },
      { id: 'timeUsed', label: t('reports.columns.timeUsed'), sortKey: 'duration' },
    ],
    [t]
  );

  const tableMinWidth = useMemo(
    () => columns.reduce((sum, column) => sum + (columnWidths[column.id] ?? 120), 0),
    [columns, columnWidths]
  );

  const getColWidth = useCallback(
    (id: string) => {
      const width = columnWidths[id] ?? 120;
      return { width: `${width}px`, minWidth: `${width}px`, maxWidth: `${width}px` };
    },
    [columnWidths]
  );

  const fetchTickets = async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/daily/preview?start=${start}&end=${end}`);
      if (!res.ok) throw new Error(`Failed to load daily preview (${res.status})`);
      const payload = (await res.json()) as { rows?: DailyPreviewRow[] };
      setTickets(payload.rows || []);
    } catch (err: any) {
      console.error('Fetch error:', err.message);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTickets(dateRange.start, dateRange.end);
  }, [dateRange]);

  const applyPreset = (type: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (type === 'today') {
      start = now;
      end = now;
    } else if (type === 'week') {
      start = new Date();
      start.setDate(start.getDate() - 7);
      end = new Date();
    } else if (type === 'month') {
      start = new Date();
      start.setDate(start.getDate() - 30);
      end = new Date();
    }

    setDateRange({
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    });
    setPreset(type);
  };

  const getDurationMs = (start: string, end: string | null) => {
    if (!end) return 0;
    return new Date(end).getTime() - new Date(start).getTime();
  };

  const getDurationStr = (start: string, end: string | null) => {
    const diff = getDurationMs(start, end);
    if (!end || diff <= 0) return '-';
    const mins = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    if (hours > 0) return `${hours} ชม. ${m} น.`;
    return `${m} น.`;
  };

  const processedTickets = useMemo(() => {
    let result = [...tickets];

    if (filterText) {
      const lower = filterText.toLowerCase();
      result = result.filter(
        (ticket) =>
          ticket.subject_only.toLowerCase().includes(lower) ||
          ticket.description.toLowerCase().includes(lower) ||
          ticket.customer_name.toLowerCase().includes(lower) ||
          ticket.hospital_name.toLowerCase().includes(lower) ||
          ticket.assignee_name.toLowerCase().includes(lower) ||
          ticket.status.toLowerCase().includes(lower) ||
          ticket.module.toLowerCase().includes(lower)
      );
    }

    if (sortConfig) {
      result.sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        switch (sortConfig.key) {
          case 'status':
            valA = a.status;
            valB = b.status;
            break;
          case 'date':
            valA = a.created_at;
            valB = b.created_at;
            break;
          case 'organization':
            valA = a.hospital_name;
            valB = b.hospital_name;
            break;
          case 'customer':
            valA = a.customer_name || a.assignee_name;
            valB = b.customer_name || b.assignee_name;
            break;
          case 'subject':
            valA = a.subject_only;
            valB = b.subject_only;
            break;
          case 'description':
            valA = a.description;
            valB = b.description;
            break;
          case 'resolution':
            valA = a.resolution_summary;
            valB = b.resolution_summary;
            break;
          case 'agent':
            valA = a.assignee_name;
            valB = b.assignee_name;
            break;
          case 'source':
            valA = a.source;
            valB = b.source;
            break;
          case 'module':
            valA = a.module;
            valB = b.module;
            break;
          case 'type':
            valA = a.issue_type;
            valB = b.issue_type;
            break;
          case 'resolved_at':
            valA = a.resolved_at || '';
            valB = b.resolved_at || '';
            break;
          case 'duration':
            valA = a.duration_ms;
            valB = b.duration_ms;
            break;
          default:
            valA = a.created_at;
            valB = b.created_at;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tickets, filterText, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      return { key, direction: 'asc' };
    });
  };

  const handleResizeStart = useCallback(
    (columnId: string, event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = columnWidths[columnId] ?? 120;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const nextWidth = Math.max(90, startWidth + (moveEvent.clientX - startX));
        setColumnWidths((prev) => ({ ...prev, [columnId]: nextWidth }));
      };

      const onMouseUp = () => {
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [columnWidths]
  );

  const handleExportExcel = () => {
    const preview: ExportPreviewData = {
      format: 'excel',
      title: t('reports.dailyTitle'),
      subtitle: t('reports.dailySubtitle'),
      totalRecords: processedTickets.length,
      dateRange: `${dateRange.start} - ${dateRange.end}`,
      columns: columns.map((c) => c.label),
    };
    setPreviewData(preview);
    setShowPreview(true);
  };

  const executeExport = async () => {
    setIsExporting(true);
    setShowPreview(false);

    const toastId = `excel-export-${Date.now()}`;
    addToast({
      id: toastId,
      type: 'ticket',
      title: 'กำลังส่งออกข้อมูล Excel',
      body: 'ระบบกำลังจัดเตรียมไฟล์ข้อมูลการรายงาน กรุณารอสักครู่...',
    });

    try {
      const res = await fetch(
        `/api/reports/daily/export?start=${dateRange.start}&end=${dateRange.end}`,
        { method: 'GET' }
      );
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const fileName =
        (res.headers.get('content-disposition') || '')
          .split('filename=')[1]
          ?.replaceAll('"', '')
          ?.trim() ||
        `Daily_Issues_${dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start}_to_${dateRange.end}`}.xlsx`;

      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);

      addToast({
        id: `excel-success-${Date.now()}`,
        type: 'ticket',
        title: 'ส่งออก Excel สำเร็จ',
        body: `ดาวน์โหลดไฟล์ ${fileName} เรียบร้อยแล้ว`,
      });
    } catch (error: any) {
      console.error('Daily export failed:', error);
      addToast({
        id: `excel-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'ส่งออก Excel ล้มเหลว',
        body: error.message || 'เกิดข้อผิดพลาดในการสร้างไฟล์ Excel กรุณาลองใหม่อีกครั้ง',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleLarkExportClick = () => {
    const larkToken = (companySettings as any)?.lark_spreadsheet_token;
    const larkSheetId = (companySettings as any)?.lark_sheet_id || '0bdfef';

    if (!larkToken || !larkToken.startsWith('sht')) {
      addToast({
        id: `lark-missing-token-${Date.now()}`,
        type: 'sla_warning',
        title: 'ยังไม่ได้ตั้งค่า Lark Sheet Token',
        body: 'กรุณากรอกและบันทึก Lark Spreadsheet Token ในเมนู การตั้งค่า > ข้อมูลพื้นฐาน ก่อนใช้งาน',
      });
      return;
    }

    void executeLarkExportDirect(larkToken, larkSheetId);
  };

  const executeLarkExportDirect = async (token: string, sheetId: string) => {
    setIsExportingLark(true);
    const toastId = `lark-export-${Date.now()}`;
    addToast({
      id: toastId,
      type: 'ticket',
      title: 'กำลังส่งออก Lark Sheets',
      body: 'ระบบกำลังนำส่งข้อมูลไปยัง Lark Sheets...',
    });

    try {
      const res = await fetch('/api/reports/daily/lark-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: dateRange.start,
          end: dateRange.end,
          spreadsheetToken: token,
          sheetId: sheetId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to export to Lark Sheets');
      }

      addToast({
        id: `lark-success-${Date.now()}`,
        type: 'ticket',
        title: 'ส่งออก Lark Sheets สำเร็จ',
        body: `ส่งออกข้อมูลจำนวน ${data.count} แถวไปยัง Lark Sheets เรียบร้อยแล้ว`,
      });
    } catch (error: any) {
      console.error('Lark Sheets Export failed:', error);
      addToast({
        id: `lark-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'ส่งออก Lark Sheets ล้มเหลว',
        body: error.message || 'เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง Lark Sheets',
      });
    } finally {
      setIsExportingLark(false);
    }
  };

  const handleGSheetsExportClick = () => {
    const sheetsUrl = (companySettings as any)?.google_sheets_url;
    if (!sheetsUrl || !sheetsUrl.startsWith('http')) {
      addToast({
        id: `gsheets-missing-url-${Date.now()}`,
        type: 'sla_warning',
        title: 'ยังไม่ได้ตั้งค่า Google Sheets URL',
        body: 'กรุณากรอกและบันทึกลิงก์ Web App URL ในเมนู การตั้งค่า > ข้อมูลพื้นฐาน ก่อนใช้งาน',
      });
      return;
    }
    void executeGSheetsExportDirect(sheetsUrl);
  };

  const executeGSheetsExportDirect = async (sheetsUrl: string) => {
    setIsExportingGSheets(true);
    const toastId = `gsheets-export-${Date.now()}`;
    addToast({
      id: toastId,
      type: 'ticket',
      title: 'กำลังส่งออก Google Sheets',
      body: 'ระบบกำลังนำส่งข้อมูลไปยัง Google Sheets...',
    });

    try {
      const res = await fetch('/api/reports/daily/google-sheets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start: dateRange.start,
          end: dateRange.end,
          targetUrl: sheetsUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to export');
      }

      addToast({
        id: `gsheets-success-${Date.now()}`,
        type: 'ticket',
        title: 'ส่งออก Google Sheets สำเร็จ',
        body: `ส่งออกข้อมูลจำนวน ${data.count} แถวไปยัง Google Sheets เรียบร้อยแล้ว`,
      });
    } catch (error: any) {
      console.error('Google Sheets Export failed:', error);
      addToast({
        id: `gsheets-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'ส่งออก Google Sheets ล้มเหลว',
        body: error.message || 'เกิดข้อผิดพลาดในการส่งข้อมูลไปยัง Google Sheets',
      });
    } finally {
      setIsExportingGSheets(false);
    }
  };

  const executePrint = async () => {
    const { printDataTable } = await loadExportUtils();
    const formatData = processedTickets.map((ticket) => {
      const createdAt = new Date(ticket.created_at);
      const resolvedAt = ticket.resolved_at ? new Date(ticket.resolved_at) : null;

      return {
        [t('reports.columns.status')]: ticket.status,
        [t('reports.columns.date')]: createdAt.toLocaleDateString('th-TH'),
        [t('reports.columns.organization')]: ticket.hospital_name || '-',
        [t('reports.columns.customer')]: ticket.customer_name || ticket.assignee_name || '-',
        [t('reports.columns.subject')]: ticket.subject_only || '-',
        [t('reports.columns.additionalDetails')]: ticket.description || '-',
        [t('reports.columns.resolution')]: ticket.resolution_summary || '-',
        [t('reports.columns.assignee')]: ticket.assignee_name || '-',
        [t('reports.columns.source')]: ticket.source || 'Line',
        [t('reports.columns.module')]: ticket.module || '-',
        [t('reports.columns.type')]: ticket.issue_type || ticket.priority || 'PB',
        [t('reports.columns.createdTime')]: createdAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
        [t('reports.columns.resolvedTime')]: resolvedAt ? resolvedAt.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-',
        [t('reports.columns.timeUsed')]: getDurationStr(ticket.created_at, ticket.resolved_at),
      };
    });

    setShowPreview(false);
    printDataTable(t('reports.dailyTitle'), formatData, `${dateRange.start} - ${dateRange.end}`);
  };

  if (loading && tickets.length === 0) {
    return (
      <div className={`animate-page-in ${styles.pageStack}`}>
        <Skeleton width={280} height={36} marginBottom={8} />
        <Card>
          <CardBody>
            <Skeleton width="100%" height={360} borderRadius={8} />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className={`animate-page-in ${styles.dailyContainer}`}>
        <PageHeader
          title={t('reports.dailyTitle')}
          subtitle={t('reports.dailySubtitle')}
          actions={
            <div className={styles.toolbarGroup}>
              <div className={styles.segmentedGroup} role="group" aria-label="เลือกช่วงเวลา">
                {[
                  { label: t('dashboard.daily'), value: 'today' },
                  { label: t('dashboard.weekly'), value: 'week' },
                  { label: t('dashboard.monthly'), value: 'month' },
                ].map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => applyPreset(p.value)}
                    className={`${styles.segmentedBtn} ${preset === p.value ? styles.segmentedBtnActive : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <Input
                id="daily-report-start"
                type="date"
                aria-label="วันเริ่มต้นรายงาน"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, start: e.target.value }));
                  setPreset('custom');
                }}
              />
              <Input
                id="daily-report-end"
                type="date"
                aria-label="วันสิ้นสุดรายงาน"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange((prev) => ({ ...prev, end: e.target.value }));
                  setPreset('custom');
                }}
              />

              {showFilter ? (
                <Input
                  id="daily-report-filter-search"
                  type="text"
                  aria-label="ค้นหาในรายงานประจำวัน"
                  placeholder="ค้นหารายการ..."
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  leftIcon={<Search size={15} aria-hidden="true" />}
                  rightAdornment={
                    filterText ? (
                      <button
                        type="button"
                        onClick={() => setFilterText('')}
                        aria-label="ล้างคำค้นหา"
                        style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', display: 'inline-flex' }}
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    ) : null
                  }
                />
              ) : null}

              <Button
                variant={showFilter ? 'primary' : 'secondary'}
                size="md"
                iconOnly
                onClick={() => setShowFilter((prev) => !prev)}
                aria-label="เปิด/ปิดช่องค้นหา"
                aria-expanded={showFilter}
              >
                <Filter size={16} aria-hidden="true" />
              </Button>

              <Button
                variant="primary"
                size="md"
                onClick={handleExportExcel}
                disabled={isExporting || processedTickets.length === 0}
                loading={isExporting}
                leftIcon={<Download size={16} aria-hidden="true" />}
              >
                {t('reports.exportExcel')}
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={handleGSheetsExportClick}
                disabled={isExportingGSheets || processedTickets.length === 0}
                loading={isExportingGSheets}
                leftIcon={<Share2 size={15} color="var(--color-success)" aria-hidden="true" />}
              >
                Google Sheets
              </Button>

              <Button
                variant="secondary"
                size="md"
                onClick={handleLarkExportClick}
                disabled={isExportingLark || processedTickets.length === 0}
                loading={isExportingLark}
                leftIcon={<Share2 size={15} color="var(--color-info)" aria-hidden="true" />}
              >
                Lark Sheets
              </Button>
            </div>
          }
        />

        <div className={styles.tableCard}>
          <div className={styles.tableScroll}>
            <table className={styles.dataTable} style={{ minWidth: `${tableMinWidth}px` }}>
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.id} style={getColWidth(column.id)}>
                      <button
                        type="button"
                        onClick={() => handleSort(column.sortKey)}
                        className={styles.thSortBtn}
                      >
                        <span className="truncate">{column.label}</span>
                        <ArrowUpDown
                          size={12}
                          style={{ opacity: sortConfig?.key === column.sortKey ? 1 : 0.5, flexShrink: 0 }}
                          aria-hidden="true"
                        />
                      </button>
                      <div
                        onMouseDown={(event) => handleResizeStart(column.id, event)}
                        className={styles.resizeHandle}
                        aria-hidden="true"
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && tickets.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40 }}>
                      <Loader2 className="animate-spin" style={{ margin: '0 auto' }} />
                    </td>
                  </tr>
                ) : processedTickets.length === 0 ? (
                  <tr>
                    <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                      {filterText ? t('common.messages.noResults') : t('reports.noDataRange')}
                    </td>
                  </tr>
                ) : (
                  processedTickets.map((ticket, idx) => {
                    const isDone = ticket.status === 'Resolved' || ticket.status === 'Closed';
                    return (
                      <tr key={ticket.id || idx}>
                        <td style={{ textAlign: 'center', fontWeight: 700, ...getColWidth('sequence') }}>
                          {idx + 1}
                        </td>
                        <td style={{ textAlign: 'center', ...getColWidth('status') }}>
                          <Badge variant={isDone ? 'success' : ticket.status === 'New' ? 'info' : 'warning'} size="sm">
                            {ticket.status}
                          </Badge>
                        </td>
                        <td style={getColWidth('date')}>{new Date(ticket.created_at).toLocaleDateString('th-TH')}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-text)', ...getColWidth('organization') }}>
                          {ticket.hospital_name || '-'}
                        </td>
                        <td style={getColWidth('customer')}>
                          {ticket.customer_name || ticket.assignee_name || '-'}
                        </td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...getColWidth('subject') }}>
                          <AlignLeft size={12} style={{ display: 'inline', marginRight: 6, opacity: 0.5 }} aria-hidden="true" />
                          {ticket.subject_only || '-'}
                        </td>
                        <td style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--color-text-muted)', ...getColWidth('additionalDetails') }}>
                          {ticket.description || '-'}
                        </td>
                        <td style={{ color: 'var(--color-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, ...getColWidth('resolution') }}>
                          {ticket.resolution_summary || '-'}
                        </td>
                        <td style={getColWidth('assignee')}>
                          {ticket.assignee_name ? (
                            <Badge variant="neutral" size="sm" dot={ticket.assignee_color || '#1D4ED8'}>
                              {ticket.assignee_name}
                            </Badge>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td style={{ color: 'var(--color-success-text)', ...getColWidth('source') }}>
                          {ticket.source || 'Line กลุ่ม'}
                        </td>
                        <td style={getColWidth('module')}>{ticket.module || '-'}</td>
                        <td style={getColWidth('type')}>
                          <Badge variant="primary" size="sm">
                            {ticket.issue_type || ticket.priority || 'PB'}
                          </Badge>
                        </td>
                        <td style={getColWidth('createdTime')}>
                          {new Date(ticket.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </td>
                        <td style={getColWidth('resolvedTime')}>
                          {ticket.resolved_at
                            ? `${new Date(ticket.resolved_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
                            : '-'}
                        </td>
                        <td style={{ fontWeight: 600, color: ticket.resolved_at ? 'var(--color-success-text)' : 'inherit', ...getColWidth('timeUsed') }}>
                          {getDurationStr(ticket.created_at, ticket.resolved_at)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.tableFooter}>
            <span className="tabular-nums">
              {t('tickets.list')} {processedTickets.length} {t('tickets.workspaceDescription').split(' ')[0]}{' '}
              {filterText && `(${t('dashboard.tabs.all')} ${tickets.length})`}
            </span>
            <span className="tabular-nums">
              {t('reports.dailySubtitle')} ({dateRange.start} {t('tickets.to')} {dateRange.end})
            </span>
          </div>
        </div>
      </div>

      {previewData ? (
        <ExportPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          onDownload={executeExport}
          onPrint={executePrint}
          data={previewData}
          loading={isExporting}
        />
      ) : null}
    </>
  );
}
