'use client';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Star,
  TrendingUp,
  PieChart as PieIcon,
  BarChart as BarIcon,
  Activity,
  RefreshCw,
  Bot,
  Check,
  ArrowRight,
  Download,
  FileDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart as RechartsBarChart,
  Bar,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import type { ToastNotif } from '@/types/notifications';
import { Badge, Button, Card, CardBody, CardHeader, EmptyState, Select } from '@/components/ui';
import styles from '@/components/analytics/analytics.module.css';

export interface TeamMemberStats {
  id: string;
  name: string;
  activeCount: number;
  resolvedCount: number;
  avgResolutionTime: number;
}

const CHART_COLORS = ['#1D4ED8', '#0D9488', '#059669', '#D97706', '#DC2626'];
const SLA_COLORS = ['#059669', '#DC2626'];

interface AIEvaluation {
  dimensions: {
    speed: { rating: number; feedback: string };
    quality: { rating: number; feedback: string };
    sla: { rating: number; feedback: string };
    csat: { rating: number; feedback: string };
  };
  strengths: string[];
  recommendations: string[];
  overallSummary: string;
  isSimulated?: boolean;
  isCached?: boolean;
}

interface StaffProfile {
  id: string;
  full_name: string;
  role: string;
  status: string;
}

interface StaffAnalyticsDashboardProps {
  data: AgentAnalyticsData;
  teamStats: TeamMemberStats[];
  selectedAgentId: string;
  selectedAgentName: string;
  dateRange: { start: string; end: string };
  staffList: StaffProfile[];
  handleAgentChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  addToast: (toast: ToastNotif) => void;
}

export function StaffAnalyticsDashboard({
  data,
  teamStats,
  selectedAgentId,
  selectedAgentName,
  dateRange,
  staffList,
  handleAgentChange,
  addToast,
}: StaffAnalyticsDashboardProps) {
  const [evaluation, setEvaluation] = useState<AIEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [aiCardExpanded, setAiCardExpanded] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);

  const [currentTimelinePage, setCurrentTimelinePage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const totalTimelinePages = useMemo(() => {
    if (!data?.timeline) return 0;
    return Math.ceil(data.timeline.length / ITEMS_PER_PAGE);
  }, [data?.timeline]);

  const paginatedTimeline = useMemo(() => {
    if (!data?.timeline) return [];
    const startIndex = (currentTimelinePage - 1) * ITEMS_PER_PAGE;
    return data.timeline.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [data?.timeline, currentTimelinePage]);

  useEffect(() => {
    setCurrentTimelinePage(1);
  }, [selectedAgentId, dateRange.start, dateRange.end]);

  const fetchExistingEvaluation = useCallback(async (agentId: string, start: string, end: string) => {
    if (!agentId) return;
    try {
      const { data: existing, error } = await supabase
        .from('staff_evaluations')
        .select('evaluation_data')
        .eq('agent_id', agentId)
        .eq('start_date', start)
        .eq('end_date', end)
        .maybeSingle();

      if (error) throw error;
      if (existing?.evaluation_data) {
        setEvaluation(existing.evaluation_data);
      } else {
        setEvaluation(null);
      }
    } catch (err) {
      console.error('Failed to fetch existing evaluation:', err);
      setEvaluation(null);
    }
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      void fetchExistingEvaluation(selectedAgentId, dateRange.start, dateRange.end);
    }
  }, [fetchExistingEvaluation, selectedAgentId, dateRange.start, dateRange.end]);

  const handleGenerateAIEvaluation = async (force = false) => {
    if (!selectedAgentId || !data) return;
    setEvalLoading(true);

    const kpiStats = {
      resolvedCount: data.stats.resolvedCount,
      totalClaimed: data.stats.totalClaimed,
      avgResolutionTime: data.stats.avgResolutionTime,
      slaComplianceRate: data.stats.slaComplianceRate,
      reworkRate: data.stats.reworkRate,
      reworkCount: data.stats.reworkCount,
      avgCsat: data.stats.avgCsat,
    };

    try {
      const res = await fetch(`/api/analytics/staff/evaluate${force ? '?force=true' : ''}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgentId,
          agentName: selectedAgentName,
          startDate: dateRange.start,
          endDate: dateRange.end,
          kpiStats,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate AI evaluation');
      const result = await res.json();
      setEvaluation(result);
      setAiCardExpanded(true);
      addToast({
        id: `eval-ok-${Date.now()}`,
        type: 'ticket',
        title: 'การประเมิน AI สำเร็จ',
        body: result.isSimulated ? 'สร้างผลการประเมินจำลองเรียบร้อยแล้ว' : 'วิเคราะห์ผลประเมินพนักงานรอบด้านสำเร็จ',
      });
    } catch (err) {
      console.error(err);
      addToast({
        id: `eval-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'การวิเคราะห์ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการติดต่อระบบประเมิน AI',
      });
    } finally {
      setEvalLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!evaluation || !data) return;
    setLoadingExport(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.top = '-9999px';
      printContainer.style.left = '0';
      printContainer.style.zIndex = '-9999';

      const applyStyles = (el: HTMLElement) => {
        el.style.width = '794px';
        el.style.padding = '40px';
        el.style.boxSizing = 'border-box';
        el.style.background = '#ffffff';
        el.style.color = '#1e293b';
        el.style.fontFamily = 'inherit';
        el.style.overflow = 'hidden';
      };

      const page1 = document.createElement('div');
      applyStyles(page1);
      page1.innerHTML = `
        <div style="border-bottom: 2px solid #1D4ED8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">รายงานการประเมินผลการปฏิบัติงานพนักงานด้วย AI</h1>
            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0 0;">NEO Intelligence Suite • AI Executive Performance Audit</p>
          </div>
          <div style="text-align: right;">
            <span style="background: rgba(29, 78, 216, 0.1); color: #1D4ED8; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px;">CONFIDENTIAL</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div>
            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">พนักงานผู้ถูกประเมิน (Staff Name)</p>
            <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a;">${selectedAgentName}</p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">รอบระยะเวลาประเมิน (Evaluation Period)</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #334155;">${dateRange.start} ถึง ${dateRange.end}</p>
          </div>
          <div>
            <p style="margin: 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">ประเมินโดย (Audited By)</p>
            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #334155;">ระบบอัตโนมัติ AI (Gemini)</p>
            <p style="margin: 10px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 700;">วันที่ออกเอกสาร (Issue Date)</p>
            <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 700; color: #334155;">${new Date().toLocaleDateString('th-TH')} น.</p>
          </div>
        </div>

        <div style="margin-bottom: 30px;">
          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">สถิติผลงานหลัก (Key Performance Indicators)</h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead>
               <tr style="background: #f1f5f9;">
                 <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">หัวข้อตัวชี้วัด (KPI Metric)</th>
                 <th style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">ผลงานที่ทำได้ (Achieved)</th>
               </tr>
            </thead>
            <tbody>
               <tr>
                 <td style="padding: 10px; border: 1px solid #cbd5e1;">จำนวนใบงานที่แก้ไขและปิดสำเร็จ (Resolved Tickets)</td>
                 <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${data.stats.resolvedCount} เคส / คอนเฟิร์ม ${data.stats.totalClaimed} เคส</td>
               </tr>
               <tr>
                 <td style="padding: 10px; border: 1px solid #cbd5e1;">เวลาเฉลี่ยในการปิดงาน (Avg Resolution Time)</td>
                 <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${data.stats.avgResolutionTime} ชั่วโมง</td>
               </tr>
               <tr>
                 <td style="padding: 10px; border: 1px solid #cbd5e1;">ความสอดคล้องตามข้อตกลง SLA (SLA Compliance Rate)</td>
                 <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${data.stats.slaComplianceRate}%</td>
               </tr>
               <tr>
                 <td style="padding: 10px; border: 1px solid #cbd5e1;">อัตราการส่งตั๋วกลับแก้ไขซ้ำ (Rework Rate)</td>
                 <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${data.stats.reworkRate}% (${data.stats.reworkCount} ครั้ง)</td>
               </tr>
               <tr>
                 <td style="padding: 10px; border: 1px solid #cbd5e1;">ความพึงพอใจของลูกค้าเฉลี่ย (Customer CSAT)</td>
                 <td style="padding: 10px; border: 1px solid #cbd5e1; font-weight: 700;">${data.stats.avgCsat > 0 ? data.stats.avgCsat + ' / 5 ดาว' : 'ไม่มีคะแนน'}</td>
               </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">มิติประเมินผลและฟีดแบ็คจาก AI</h3>
          <div style="display: flex; flex-direction: column; gap: 16px;">
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">มิติด้านความเร็วในการแก้ไข (Resolution Speed)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #1D4ED8;">${evaluation.dimensions.speed.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.speed.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">มิติด้านคุณภาพการแก้ปัญหา (Rework & Quality)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #059669;">${evaluation.dimensions.quality.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.quality.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">มิติด้านข้อตกลงและเงื่อนไขเวลา (SLA Compliance)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #0D9488;">${evaluation.dimensions.sla.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.sla.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">มิติด้านความพึงพอใจลูกค้าสัมพันธ์ (Customer CSAT)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #D97706;">${evaluation.dimensions.csat.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.csat.feedback}</p>
             </div>
          </div>
        </div>
      `;

      const page2 = document.createElement('div');
      applyStyles(page2);
      page2.innerHTML = `
        <div style="border-bottom: 2px solid #1D4ED8; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">(ต่อ) รายงานการประเมินผลการปฏิบัติงาน</h1>
            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0 0;">NEO Intelligence Suite • AI Executive Performance Audit</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
           <div style="background: rgba(5, 150, 105, 0.04); border: 1px solid rgba(5, 150, 105, 0.2); padding: 16px; border-radius: 8px;">
             <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #059669;">จุดแข็งสำคัญ (Key Strengths)</h4>
             <ul style="margin: 0; padding-left: 16px; font-size: 11.5px; color: #334155; line-height: 1.6;">
               ${evaluation.strengths.map((s: string) => `<li>${s}</li>`).join('')}
             </ul>
           </div>
           <div style="background: rgba(29, 78, 216, 0.04); border: 1px solid rgba(29, 78, 216, 0.2); padding: 16px; border-radius: 8px;">
             <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #1D4ED8;">ข้อเสนอแนะในการพัฒนา (Opportunities)</h4>
             <ul style="margin: 0; padding-left: 16px; font-size: 11.5px; color: #334155; line-height: 1.6;">
               ${evaluation.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
             </ul>
           </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
           <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 800; color: #0f172a;">สรุปความเห็นผู้ประเมินผล AI (Executive Summary)</h4>
           <p style="margin: 0; font-size: 12.5px; color: #334155; line-height: 1.6; font-style: italic;">"${evaluation.overallSummary}"</p>
         </div>
      `;

      printContainer.appendChild(page1);
      printContainer.appendChild(page2);
      document.body.appendChild(printContainer);

      const canvas1 = await html2canvas(page1, { scale: 2, useCORS: true, windowWidth: 794 });
      const canvas2 = await html2canvas(page2, { scale: 2, useCORS: true, windowWidth: 794 });

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;

      const imgHeight1 = (canvas1.height * imgWidth) / canvas1.width;
      pdf.addImage(canvas1.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight1);

      pdf.addPage();

      const imgHeight2 = (canvas2.height * imgWidth) / canvas2.width;
      pdf.addImage(canvas2.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight2);

      pdf.save(`AI_Evaluation_${selectedAgentName}_${dateRange.start}_to_${dateRange.end}.pdf`);
      document.body.removeChild(printContainer);

      addToast({
        id: `pdf-ok-${Date.now()}`,
        type: 'ticket',
        title: 'Export PDF สำเร็จ',
        body: 'ดาวน์โหลดใบรายงานผลประเมินพนักงานแบบ 2 หน้าเรียบร้อยแล้ว',
      });
    } catch (err) {
      console.error('PDF Export failed:', err);
      addToast({
        id: `pdf-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'Export PDF ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการสร้างไฟล์เอกสาร PDF',
      });
    } finally {
      setLoadingExport(false);
    }
  };

  const handleExportExcel = async () => {
    if (!evaluation || !data) return;
    try {
      const XLSX = await import('xlsx');

      const excelData = [
        ['รายงานการประเมินผลงานพนักงานด้วย AI'],
        ['ชื่อพนักงาน', selectedAgentName],
        ['ช่วงเวลาประเมิน', `${dateRange.start} ถึง ${dateRange.end}`],
        [],
        ['ตัวชี้วัดหลัก', 'ผลงานที่ได้'],
        ['จำนวนตั๋วงานที่แก้ไขแล้ว', `${data.stats.resolvedCount} เคส`],
        ['เวลาปิดงานเฉลี่ย', `${data.stats.avgResolutionTime} ชั่วโมง`],
        ['อัตราการรักษาสัญญา SLA', `${data.stats.slaComplianceRate}%`],
        ['อัตราการส่งกลับแก้ซ้ำ', `${data.stats.reworkRate}%`],
        ['คะแนนความพึงพอใจลูกค้า CSAT', data.stats.avgCsat > 0 ? data.stats.avgCsat : 'ไม่มีคะแนน'],
        [],
        ['มิติประเมิน', 'คะแนน (%)', 'ความคิดเห็น'],
        ['ความเร็วในการแก้ปัญหา', `${evaluation.dimensions.speed.rating}%`, evaluation.dimensions.speed.feedback],
        ['คุณภาพผลงานการแก้ไข', `${evaluation.dimensions.quality.rating}%`, evaluation.dimensions.quality.feedback],
        ['ความถูกต้องตาม SLA', `${evaluation.dimensions.sla.rating}%`, evaluation.dimensions.sla.feedback],
        ['ความพึงพอใจและการบริการลูกค้า', `${evaluation.dimensions.csat.rating}%`, evaluation.dimensions.csat.feedback],
        [],
        ['จุดแข็งหลัก'],
        ...evaluation.strengths.map((s: string, idx: number) => [`${idx + 1}. ${s}`]),
        [],
        ['ข้อเสนอแนะในการพัฒนา'],
        ...evaluation.recommendations.map((r: string, idx: number) => [`${idx + 1}. ${r}`]),
        [],
        ['สรุปภาพรวมผู้บริหาร', evaluation.overallSummary],
      ];

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'AI Evaluation');
      XLSX.writeFile(wb, `AI_Evaluation_${selectedAgentName}_${dateRange.start}_to_${dateRange.end}.xlsx`);

      addToast({
        id: `excel-ok-${Date.now()}`,
        type: 'ticket',
        title: 'Export Excel สำเร็จ',
        body: 'ดาวน์โหลดเอกสาร Excel เรียบร้อยแล้ว',
      });
    } catch (err) {
      console.error('Excel Export failed:', err);
      addToast({
        id: `excel-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'Export Excel ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการสร้างไฟล์ Excel',
      });
    }
  };

  const getActionTypeLabel = (action: string) => {
    switch (action) {
      case 'claim':
        return 'รับเรื่องสิทธิ์งาน';
      case 'resolve':
        return 'ดำเนินการแก้ไขเสร็จสิ้น';
      case 'close':
        return 'ปิดใบงานสำเร็จ';
      case 'reject':
        return 'ส่งงานกลับไปแก้ไขต่อ';
      case 'assign':
        return 'มอบหมายงาน';
      case 'escalate':
        return 'ส่งต่อเรื่อง';
      case 'transfer':
        return 'โอนย้ายแอดมิน';
      default:
        return action;
    }
  };

  const getActionBadgeVariant = (action: string): 'success' | 'primary' | 'danger' | 'neutral' => {
    switch (action) {
      case 'resolve':
      case 'close':
        return 'success';
      case 'claim':
      case 'assign':
        return 'primary';
      case 'reject':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const filteredSlaData = useMemo(() => {
    if (!data?.slaData) return [];
    return data.slaData.filter((d) => d.value > 0);
  }, [data?.slaData]);

  return (
    <div className={styles.pageStack}>
      {/* Executive Overview & Staff Selector */}
      <Card>
        <CardBody>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 260 }}>
              <div className={styles.kpiIconBox} style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }} aria-hidden="true">
                <Users size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
                  รายงานสรุปผลงานระดับรายบุคคล
                </h2>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginTop: 4 }}>
                  กำลังตรวจสอบสถิติการปฏิบัติงานของ <strong>{selectedAgentName}</strong> ตั้งแต่วันที่{' '}
                  {DateTime.fromISO(dateRange.start).toFormat('dd MMM')} ถึง {DateTime.fromISO(dateRange.end).toFormat('dd MMM yyyy')}
                </p>
              </div>
            </div>

            <div style={{ minWidth: 260, flexShrink: 0 }}>
              <Select
                id="staff-analytics-agent-select"
                label="เลือกรายชื่อพนักงานเพื่อดูสถิติ"
                value={selectedAgentId}
                onChange={handleAgentChange}
              >
                {staffList.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.full_name} ({staff.role})
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* AI Executive Performance Evaluation Card */}
      <Card style={{ borderColor: 'var(--color-primary)' }}>
        <CardHeader
          actions={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {!evaluation ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleGenerateAIEvaluation(false)}
                  loading={evalLoading}
                  leftIcon={<Bot size={14} aria-hidden="true" />}
                >
                  {evalLoading ? 'กำลังประเมิน...' : 'ประเมินผลด้วย AI'}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAiCardExpanded((prev) => !prev)}
                aria-expanded={aiCardExpanded}
              >
                {aiCardExpanded ? 'ย่อรายละเอียด' : 'ขยายรายละเอียด'}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className={styles.kpiIconBox} style={{ background: 'var(--color-info-soft)', color: 'var(--color-info)' }} aria-hidden="true">
              <Bot size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--color-text)' }}>
                  การประเมินผลงานด้วย AI
                </h2>
                {evaluation ? (
                  <Badge variant={evaluation.isSimulated ? 'warning' : 'success'} size="sm">
                    {evaluation.isSimulated ? 'SIMULATED AUDIT' : 'GEMINI ACTIVE AUDIT'}
                  </Badge>
                ) : null}
              </div>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 2 }}>
                วิเคราะห์ศักยภาพ ทักษะบริการ ความเร็ว และคุณภาพการดูแลลูกค้า
              </p>
            </div>
          </div>
        </CardHeader>

        {aiCardExpanded ? (
          <CardBody>
            {!evaluation ? (
              <EmptyState
                compact
                title={`ยังไม่ได้ประเมินผลงานสำหรับ ${selectedAgentName} ในช่วงเวลานี้`}
                description='กดปุ่ม "ประเมินผลด้วย AI" ด้านบนเพื่อวิเคราะห์ข้อมูล'
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {data.stats.resolvedCount === 0 ? (
                  <div
                    style={{
                      padding: '12px 16px',
                      background: 'var(--color-warning-soft)',
                      border: '1px solid var(--color-warning-border)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                    }}
                  >
                    <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                    <div>
                      <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-warning-text)' }}>
                        ข้อมูลผลงานไม่เพียงพอ
                      </h3>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5, marginTop: 2 }}>
                        พนักงานรายนี้ไม่มีประวัติการแก้ไขใบงานในช่วงเวลาที่เลือก บทวิเคราะห์อาจไม่สะท้อนผลงานที่แท้จริง
                      </p>
                    </div>
                  </div>
                ) : null}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                  {[
                    { key: 'speed', label: 'ประสิทธิภาพความเร็ว (Speed)', color: '#1D4ED8' },
                    { key: 'quality', label: 'คุณภาพการแก้ไข (Quality)', color: '#059669' },
                    { key: 'sla', label: 'การรักษาสัญญา SLA', color: '#0D9488' },
                    { key: 'csat', label: 'ความพึงพอใจลูกค้า (CSAT)', color: '#D97706' },
                  ].map((dim) => {
                    const val = evaluation.dimensions?.[dim.key as keyof AIEvaluation['dimensions']] || { rating: 75, feedback: '' };
                    return (
                      <div key={dim.key} className={styles.metricBox}>
                        <div className={styles.metricHeader}>
                          <span className={styles.metricLabel}>{dim.label}</span>
                          <span className={styles.metricScore} style={{ color: dim.color }}>
                            {val.rating}%
                          </span>
                        </div>
                        <div className={styles.capacityTrack} style={{ marginBottom: 10 }}>
                          <div className={styles.capacityFill} style={{ width: `${val.rating}%`, background: dim.color }} />
                        </div>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                          {val.feedback}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.twoColGrid}>
                  <div
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-success-soft)',
                      border: '1px solid var(--color-success-border)',
                    }}
                  >
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-success-text)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <Check size={16} aria-hidden="true" />
                      จุดแข็งหลักที่โดดเด่น
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {evaluation.strengths?.map((s: string, i: number) => (
                        <li key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', lineHeight: 1.5 }}>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div
                    style={{
                      padding: 'var(--space-4)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-primary-soft)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <ArrowRight size={16} aria-hidden="true" />
                      โอกาสการพัฒนาศักยภาพ
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {evaluation.recommendations?.map((r: string, i: number) => (
                        <li key={i} style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text)', lineHeight: 1.5 }}>
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className={styles.metricBox}>
                  <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
                    บทสรุปสำหรับผู้บริหาร
                  </h3>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                    &quot;{evaluation.overallSummary}&quot;
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleGenerateAIEvaluation(true)}
                    loading={evalLoading}
                    leftIcon={<RefreshCw size={14} aria-hidden="true" />}
                  >
                    ประเมินวิเคราะห์ใหม่อีกครั้ง
                  </Button>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleExportExcel}
                      leftIcon={<Download size={14} color="var(--color-success)" aria-hidden="true" />}
                    >
                      Export Excel
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleExportPDF}
                      loading={loadingExport}
                      leftIcon={<FileDown size={14} aria-hidden="true" />}
                    >
                      ดาวน์โหลดใบรับรอง PDF
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        ) : null}
      </Card>

      {/* KPI Analytics Grid */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'var(--color-success-soft)', color: 'var(--color-success)' }} aria-hidden="true">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className={styles.kpiLabel}>ใบงานที่ปิดแล้ว</p>
            <p className={styles.kpiValue}>{data.stats.resolvedCount}</p>
            <p className={styles.kpiSub}>จากทั้งหมด {data.stats.totalClaimed} เคส</p>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }} aria-hidden="true">
            <Clock size={20} />
          </div>
          <div>
            <p className={styles.kpiLabel}>เวลาปิดงานเฉลี่ย</p>
            <p className={styles.kpiValue}>
              {data.stats.avgResolutionTime} <span style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>ชม.</span>
            </p>
            <p className={styles.kpiSub}>SLA ผ่านเกณฑ์ {data.stats.slaComplianceRate}%</p>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }} aria-hidden="true">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className={styles.kpiLabel}>อัตราการส่งกลับแก้</p>
            <p className={styles.kpiValue}>{data.stats.reworkRate}%</p>
            <p className={styles.kpiSub}>โดนตีกลับ {data.stats.reworkCount} ครั้ง</p>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiIconBox} style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }} aria-hidden="true">
            <Star size={20} />
          </div>
          <div>
            <p className={styles.kpiLabel}>ความพึงพอใจ CSAT</p>
            <p className={styles.kpiValue}>
              {data.stats.avgCsat > 0 ? `${data.stats.avgCsat} / 5` : 'ไม่มีประเมิน'}
            </p>
            <div style={{ display: 'flex', gap: 2, marginTop: 6 }} aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star
                  key={i}
                  size={12}
                  fill={i < Math.round(data.stats.avgCsat) ? 'var(--color-warning)' : 'transparent'}
                  color="var(--color-warning)"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Executive Team Overview */}
      <div className={styles.twoColGrid}>
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={16} color="var(--color-primary)" aria-hidden="true" />
              ติดตามภาระงาน (Capacity Tracking)
            </h2>
          </CardHeader>
          <CardBody>
            <div className={styles.capacityList}>
              {[...teamStats]
                .sort((a, b) => b.activeCount - a.activeCount)
                .map((agent) => {
                  const MAX_CAPACITY = 15;
                  const pct = Math.min(100, (agent.activeCount / MAX_CAPACITY) * 100);
                  const isOverload = agent.activeCount >= MAX_CAPACITY;
                  const isWarning = agent.activeCount >= MAX_CAPACITY * 0.8;
                  const color = isOverload ? 'var(--color-danger)' : isWarning ? 'var(--color-warning)' : 'var(--color-success)';
                  return (
                    <div key={agent.id}>
                      <div className={styles.capacityHeader}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{agent.name}</span>
                        <span className="tabular-nums" style={{ fontWeight: 700, color }}>
                          {agent.activeCount} / {MAX_CAPACITY} เคส
                        </span>
                      </div>
                      <div className={styles.capacityTrack}>
                        <div className={styles.capacityFill} style={{ width: `${pct}%`, background: color }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarIcon size={16} color="var(--color-info)" aria-hidden="true" />
              แมทริกซ์ประสิทธิภาพ (Performance Matrix)
            </h2>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart margin={{ top: 12, right: 16, bottom: 12, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" dataKey="avgResolutionTime" name="เวลาเฉลี่ย (ชม.)" stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis type="number" dataKey="resolvedCount" name="จำนวนเคสที่ปิด" stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} />
                <ZAxis type="category" dataKey="name" name="พนักงาน" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)', fontSize: 12 }}
                  itemStyle={{ fontWeight: 600, color: 'var(--color-primary)' }}
                />
                <Scatter name="พนักงาน" data={teamStats.filter((s) => s.resolvedCount > 0 || s.avgResolutionTime > 0)} fill="#1D4ED8">
                  {teamStats
                    .filter((s) => s.resolvedCount > 0 || s.avgResolutionTime > 0)
                    .map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <p style={{ textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 8 }}>
              แกน X: เวลาเฉลี่ยในการปิดงาน (ชม.) • แกน Y: จำนวนงานที่ปิดได้
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Resolution Trend & SLA & Hospital Bar */}
      <div className={styles.twoColGrid}>
        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--color-primary)" aria-hidden="true" />
              แนวโน้มการแก้ไขงานรายวัน
            </h2>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.resolutionTrend}>
                <defs>
                  <linearGradient id="colorValueStaff" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1D4ED8" stopOpacity={0.22} />
                    <stop offset="95%" stopColor="#1D4ED8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)' }}
                  labelStyle={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text)' }}
                  itemStyle={{ color: 'var(--color-primary)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="value" stroke="#1D4ED8" strokeWidth={2.5} fillOpacity={1} fill="url(#colorValueStaff)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} color="var(--color-success)" aria-hidden="true" />
              อัตราการรักษาสัญญา SLA
            </h2>
          </CardHeader>
          <CardBody>
            {filteredSlaData.length === 0 ? (
              <EmptyState compact title="พนักงานไม่มีเคสที่ติดเงื่อนไข SLA" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: 16 }}>
                <ResponsiveContainer width={180} height={200}>
                  <PieChart>
                    <Pie data={filteredSlaData} innerRadius={50} outerRadius={76} paddingAngle={4} dataKey="value" strokeWidth={0}>
                      {filteredSlaData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={SLA_COLORS[index % SLA_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ marginBottom: 6 }}>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>ความถูกต้องตามเกณฑ์</p>
                    <p className="tabular-nums" style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-success-text)' }}>
                      {data.stats.slaComplianceRate}%
                    </p>
                  </div>
                  {filteredSlaData.map((entry, idx) => (
                    <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: SLA_COLORS[idx % SLA_COLORS.length] }} />
                      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--color-text)' }}>{entry.name}</span>
                      <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                        ({entry.value} ใบงาน)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className={styles.fullSpan}>
          <CardHeader>
            <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarIcon size={16} color="var(--color-info)" aria-hidden="true" />
              จำนวนองค์กรที่ถูกแก้ปัญหา
            </h2>
          </CardHeader>
          <CardBody>
            {!data.hospitalData || data.hospitalData.length === 0 ? (
              <EmptyState compact title="ไม่มีข้อมูลการแก้ปัญหาขององค์กร" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <RechartsBarChart layout="vertical" data={data.hospitalData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" stroke="var(--color-text-subtle)" fontSize={12} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--color-text-muted)" fontSize={12} axisLine={false} tickLine={false} width={150} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border-strong)', borderRadius: 'var(--radius-md)' }} />
                  <Bar dataKey="value" fill="#1D4ED8" radius={[0, 4, 4, 0]} barSize={16}>
                    {data.hospitalData.map((_entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </RechartsBarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Employee Activity Log */}
      <Card>
        <CardHeader>
          <h2 style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={16} color="var(--color-warning)" aria-hidden="true" />
            บันทึกประวัติการทำงานของพนักงานล่าสุด
          </h2>
        </CardHeader>
        <CardBody>
          {paginatedTimeline.length === 0 ? (
            <EmptyState compact title="ไม่มีบันทึกประวัติการทำงานล่าสุดในช่วงเวลานี้" />
          ) : (
            <>
              <div className={styles.timelineList}>
                {paginatedTimeline.map((item, idx) => (
                  <div key={item.id || idx} className={styles.timelineItem}>
                    <div className={styles.timelineBulletCol}>
                      <div
                        className={styles.timelineDot}
                        style={{
                          background:
                            item.action === 'resolve' || item.action === 'close'
                              ? 'var(--color-success)'
                              : item.action === 'reject'
                                ? 'var(--color-danger)'
                                : 'var(--color-primary)',
                        }}
                      />
                      {idx < paginatedTimeline.length - 1 ? <div className={styles.timelineLine} /> : null}
                    </div>

                    <div className={styles.timelineContent}>
                      <div className={styles.timelineHeader}>
                        <div className={styles.timelineMeta}>
                          <span className="tabular-nums" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--color-text)' }}>
                            {item.ticketNo}
                          </span>
                          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>{item.subject}</span>
                          <Badge variant={getActionBadgeVariant(item.action)} size="sm">
                            {getActionTypeLabel(item.action)}
                          </Badge>
                        </div>
                        <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                          {DateTime.fromISO(item.createdAt).toFormat('dd MMM yyyy, HH:mm น.')}
                        </span>
                      </div>

                      {item.note ? (
                        <div className={styles.timelineNote}>
                          <strong style={{ color: 'var(--color-text)', marginRight: 6 }}>บันทึก:</strong>
                          {item.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>

              {totalTimelinePages > 1 ? (
                <div className={styles.paginationBar}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentTimelinePage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentTimelinePage === 1}
                  >
                    ย้อนกลับ
                  </Button>
                  <span className="tabular-nums" style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    หน้า <strong style={{ color: 'var(--color-primary)' }}>{currentTimelinePage}</strong> จาก {totalTimelinePages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentTimelinePage((prev) => Math.min(prev + 1, totalTimelinePages))}
                    disabled={currentTimelinePage === totalTimelinePages}
                  >
                    ถัดไป
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
