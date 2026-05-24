'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ArrowLeft,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ChevronDown,
  Bot,
  Check,
  ArrowRight,
  Download,
  FileDown
} from 'lucide-react';
import Link from 'next/link';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { analyticsQueries, type AgentAnalyticsData } from '@/lib/tickets/analyticsQueries';
import { supabase } from '@/lib/supabase';
import { DateTime } from 'luxon';
import {
  ResponsiveContainer,
  AreaChart, Area,
  PieChart, Pie, Cell,
  BarChart as RechartsBarChart, Bar,
  ScatterChart, Scatter, ZAxis,
  XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';

const CHART_COLORS = ['#00f2fe', '#7367f0', '#28c76f', '#ff9f43', '#ea5455'];
const SLA_COLORS = ['#28c76f', '#ea5455'];

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

export default function StaffAnalyticsPage() {
  const { userProfile } = useAppContext();
  const { locale } = useStaffLocale();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Staff Profiles List
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedAgentName, setSelectedAgentName] = useState<string>('');
  
  const [data, setData] = useState<AgentAnalyticsData | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamStats, setTeamStats] = useState<any[]>([]);
  
  const [dateRange, setDateRange] = useState({
    start: DateTime.now().minus({ days: 30 }).toISODate()!,
    end: DateTime.now().toISODate()!
  });

  const [activeRange, setActiveRange] = useState<'30days' | '7days'>('30days');

  const { addToast } = useNotificationContext();
  const [evaluation, setEvaluation] = useState<AIEvaluation | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [aiCardExpanded, setAiCardExpanded] = useState(true);

  // Security authorization check
  const hasAccess = useMemo(() => {
    if (!userProfile) return false;
    if (userProfile.role === 'Administrator') return true;
    return userProfile.permissions?.analytics_staff === 'view' || userProfile.permissions?.analytics_staff === 'edit';
  }, [userProfile]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch all staff members to populate the selector
  const fetchStaffList = useCallback(async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, status')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setStaffList(profiles || []);

      if (profiles && profiles.length > 0) {
        setSelectedAgentId(profiles[0].id);
        setSelectedAgentName(profiles[0].full_name);
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hasAccess && mounted) {
      void fetchStaffList();
    } else if (mounted) {
      setLoading(false);
    }
  }, [fetchStaffList, hasAccess, mounted]);

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

  // Fetch performance data for the selected agent
  const fetchAgentPerformance = useCallback(async (agentId: string) => {
    if (!agentId) return;
    setLoadingStats(true);
    try {
      const [stats, tStats] = await Promise.all([
        analyticsQueries.getAgentAnalytics(agentId, dateRange.start, dateRange.end),
        analyticsQueries.getTeamAnalytics(dateRange.start, dateRange.end),
        fetchExistingEvaluation(agentId, dateRange.start, dateRange.end)
      ]);
      setData(stats);
      setTeamStats(tStats);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoadingStats(false);
    }
  }, [dateRange.start, dateRange.end, fetchExistingEvaluation]);

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
      avgCsat: data.stats.avgCsat
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
          kpiStats
        })
      });

      if (!res.ok) throw new Error('Failed to generate AI evaluation');
      const result = await res.json();
      setEvaluation(result);
      addToast({
        id: `eval-ok-${Date.now()}`,
        type: 'ticket',
        title: 'การประเมิน AI สำเร็จ',
        body: result.isSimulated ? 'สร้างผลการประเมินจำลองเรียบร้อยแล้ว' : 'วิเคราะห์ผลประเมินพนักงานรอบด้านสำเร็จ'
      });
    } catch (err) {
      console.error(err);
      addToast({
        id: `eval-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'การวิเคราะห์ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการติดต่อระบบประเมิน AI'
      });
    } finally {
      setEvalLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!evaluation || !data) return;
    setLoadingStats(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const printContainer = document.createElement('div');
      // Position absolute and top -9999 prevents viewport clipping bugs in html2canvas
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
        el.style.fontFamily = 'system-ui, sans-serif';
        el.style.overflow = 'hidden';
      };

      const page1 = document.createElement('div');
      applyStyles(page1);
      page1.innerHTML = `
        <div style="border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">รายงานการประเมินผลการปฏิบัติงานพนักงานด้วย AI</h1>
            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0 0;">NEO Intelligence Suite • AI Executive Performance Audit</p>
          </div>
          <div style="text-align: right;">
            <span style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 4px;">CONFIDENTIAL</span>
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
            <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #334155;">ระบบอัตโนมัติ AI (Gemini 3.5 Flash)</p>
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
          <h3 style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 16px;">มิติประเมินผลและฟี้ดแบ็คจาก AI (Multidimensional Ratings & Feedback)</h3>
          <div style="display: flex; flex-direction: column; gap: 16px;">
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">⚡ มิติด้านความเร็วในการแก้ไข (Resolution Speed)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #0ea5e9;">${evaluation.dimensions.speed.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.speed.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">🛡️ มิติด้านคุณภาพการแก้ปัญหา (Rework & Quality)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #10b981;">${evaluation.dimensions.quality.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.quality.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">⏰ มิติด้านข้อตกลงและเงื่อนไขเวลา (SLA Compliance)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #8b5cf6;">${evaluation.dimensions.sla.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.sla.feedback}</p>
             </div>
             <div>
               <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                 <span style="font-size: 13px; font-weight: 700; color: #0f172a;">⭐ มิติด้านความพึงพอใจลูกค้าสัมพันธ์ (Customer CSAT)</span>
                 <span style="font-size: 13px; font-weight: 800; color: #f59e0b;">${evaluation.dimensions.csat.rating}%</span>
               </div>
               <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">${evaluation.dimensions.csat.feedback}</p>
             </div>
          </div>
        </div>
      `;

      const page2 = document.createElement('div');
      applyStyles(page2);
      page2.innerHTML = `
        <div style="border-bottom: 2px solid #0ea5e9; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h1 style="font-size: 22px; font-weight: 800; color: #0f172a; margin: 0;">(ต่อ) รายงานการประเมินผลการปฏิบัติงาน</h1>
            <p style="font-size: 13px; color: #64748b; margin: 5px 0 0 0;">NEO Intelligence Suite • AI Executive Performance Audit</p>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
           <div style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.15); padding: 16px; border-radius: 8px;">
             <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #10b981;">🌟 จุดแข็งสำคัญ (Key Strengths)</h4>
             <ul style="margin: 0; padding-left: 16px; font-size: 11.5px; color: #334155; line-height: 1.6;">
               ${evaluation.strengths.map((s: string) => `<li>${s}</li>`).join('')}
             </ul>
           </div>
           <div style="background: rgba(14, 165, 233, 0.03); border: 1px solid rgba(14, 165, 233, 0.15); padding: 16px; border-radius: 8px;">
             <h4 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; color: #0ea5e9;">🚀 ข้อเสนอแนะในการพัฒนา (Opportunities)</h4>
             <ul style="margin: 0; padding-left: 16px; font-size: 11.5px; color: #334155; line-height: 1.6;">
               ${evaluation.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
             </ul>
           </div>
        </div>

        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px;">
           <h4 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 800; color: #0f172a;">📊 สรุปความเห็นผู้ประเมินผล AI (Executive Summary)</h4>
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
        body: 'ดาวน์โหลดใบรายงานผลประเมินพนักงานแบบ 2 หน้าเรียบร้อยแล้ว'
      });
    } catch (err) {
      console.error('PDF Export failed:', err);
      addToast({
        id: `pdf-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'Export PDF ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการสร้างไฟล์เอกสาร PDF'
      });
    } finally {
      setLoadingStats(false);
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
        ['สรุปภาพรวมผู้บริหาร', evaluation.overallSummary]
      ];

      const ws = XLSX.utils.aoa_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AI Evaluation");
      XLSX.writeFile(wb, `AI_Evaluation_${selectedAgentName}_${dateRange.start}_to_${dateRange.end}.xlsx`);

      addToast({
        id: `excel-ok-${Date.now()}`,
        type: 'ticket',
        title: 'Export Excel สำเร็จ',
        body: 'ดาวน์โหลดเอกสาร Excel เรียบร้อยแล้ว'
      });
    } catch (err) {
      console.error('Excel Export failed:', err);
      addToast({
        id: `excel-err-${Date.now()}`,
        type: 'sla_warning',
        title: 'Export Excel ล้มเหลว',
        body: 'เกิดข้อผิดพลาดในการสร้างไฟล์ Excel'
      });
    }
  };

  useEffect(() => {
    if (selectedAgentId) {
      void fetchAgentPerformance(selectedAgentId);
    }
  }, [fetchAgentPerformance, selectedAgentId]);

  const handleAgentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedAgentId(id);
    const agent = staffList.find(s => s.id === id);
    if (agent) {
      setSelectedAgentName(agent.full_name);
    }
  };

  const handleRangeChange = (range: '30days' | '7days') => {
    setActiveRange(range);
    if (range === '30days') {
      setDateRange({
        start: DateTime.now().minus({ days: 30 }).toISODate()!,
        end: DateTime.now().toISODate()!
      });
    } else {
      setDateRange({
        start: DateTime.now().minus({ days: 7 }).toISODate()!,
        end: DateTime.now().toISODate()!
      });
    }
  };

  const getActionTypeLabel = (action: string) => {
    switch (action) {
      case 'claim': return 'รับเรื่องสิทธิ์งาน';
      case 'resolve': return 'ดำเนินการแก้ไขเสร็จสิ้น';
      case 'close': return 'ปิดใบงานสำเร็จ';
      case 'reject': return 'ส่งงานกลับไปแก้ไขต่อ';
      case 'assign': return 'มอบหมายงาน';
      case 'escalate': return 'ส่งต่อเรื่อง';
      case 'transfer': return 'โอนย้ายแอดมิน';
      default: return action;
    }
  };

  const getActionBadgeStyle = (action: string) => {
    switch (action) {
      case 'resolve':
      case 'close':
        return { background: 'rgba(40, 199, 111, 0.1)', color: 'var(--success)', border: '1px solid rgba(40, 199, 111, 0.2)' };
      case 'claim':
      case 'assign':
        return { background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)', border: '1px solid rgba(0, 242, 254, 0.2)' };
      case 'reject':
        return { background: 'rgba(234, 84, 85, 0.1)', color: 'var(--danger)', border: '1px solid rgba(234, 84, 85, 0.2)' };
      default:
        return { background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255, 255, 255, 0.1)' };
    }
  };

  const filteredSlaData = useMemo(() => {
    if (!data?.slaData) return [];
    return data.slaData.filter(d => d.value > 0);
  }, [data?.slaData]);

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

  // Reset timeline page when agent or dates change
  useEffect(() => {
    setCurrentTimelinePage(1);
  }, [selectedAgentId, dateRange.start, dateRange.end]);

  const showFullPageLoader = useMemo(() => {
    return loading || (loadingStats && !data);
  }, [loading, loadingStats, data]);

  if (!mounted) return null;

  // Unauthorised fallback view
  if (!loading && !hasAccess) {
    return (
      <div className="flex-center" style={{ height: '70vh', animation: 'fadeIn 0.5s ease-out' }}>
        <div className="glass" style={{ maxWidth: '480px', padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '16px', borderRadius: '50%', color: 'var(--danger)' }}>
            <ShieldAlert size={48} />
          </div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-main)' }}>คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            สิทธิ์การเข้าถึงข้อมูลแดชบอร์ดสถิติพนักงานระดับบริหารนี้ ถูกกำหนดไว้เฉพาะผู้ดูแลระบบหลักหรือผู้ได้รับมอบหมายพิเศษเท่านั้น
          </p>
          <Link href="/" className="glass-interactive" style={{ padding: '12px 24px', background: 'var(--primary)', color: '#0a0e14', fontWeight: '800', borderRadius: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <ArrowLeft size={16} /> กลับหน้าหลัก
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Top Header Selector Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1', color: 'var(--text-main)' }}>
            {locale === 'th' ? 'สถิติผลงานพนักงาน' : 'Staff Performance Analytics'}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>
            Executive Dashboards & Performance Insights
          </p>
        </div>

        {/* Date Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Range Selection */}
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <button 
              onClick={() => handleRangeChange('30days')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeRange === '30days' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeRange === '30days' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              30 วันล่าสุด
            </button>
            <button 
              onClick={() => handleRangeChange('7days')}
              style={{
                padding: '8px 16px',
                borderRadius: '10px',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                background: activeRange === '7days' ? 'rgba(255,255,255,0.08)' : 'transparent',
                color: activeRange === '7days' ? 'var(--primary)' : 'var(--text-dim)',
                transition: 'all 0.2s'
              }}
            >
              7 วันล่าสุด
            </button>
          </div>

          <button 
            onClick={() => selectedAgentId && fetchAgentPerformance(selectedAgentId)}
            className="glass-interactive"
            style={{ padding: '10px', borderRadius: '12px', color: 'var(--text-muted)' }}
          >
            {loadingStats ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
          </button>
        </div>
      </div>

      {showFullPageLoader ? (
        <div className="flex-center" style={{ height: '50vh' }}>
          <Loader2 className="animate-spin" size={40} color="var(--primary)" />
        </div>
      ) : !data ? (
        <div className="glass flex-center" style={{ padding: '64px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>ไม่มีข้อมูลสรุปสำหรับพนักงานคนนี้</p>
        </div>
      ) : (
        <>
          {/* Executive Overview Banner */}
          <div className="glass" style={{ padding: '24px 32px', marginBottom: '32px', background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.05) 0%, rgba(115, 103, 240, 0.05) 100%)', border: '1px solid var(--border-active)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: '1', minWidth: '280px' }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.12)', padding: '16px', borderRadius: '16px', color: 'var(--primary)', boxShadow: '0 0 15px rgba(0, 242, 254, 0.15)' }}>
                  <Users size={32} />
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>รายงานสรุปผลงานระดับรายบุคคล</h2>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.5' }}>
                    กำลังตรวจสอบสถิติการปฏิบัติงานของ <strong>{selectedAgentName}</strong> ตั้งแต่วันที่ {DateTime.fromISO(dateRange.start).toFormat('dd MMM')} ถึง {DateTime.fromISO(dateRange.end).toFormat('dd MMM yyyy')} รวมประวัติและ CSAT ย้อนหลังทั้งหมด
                  </p>
                </div>
              </div>

              {/* Stylized Employee Dropdown */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '250px', flexShrink: 0 }}>
                <span style={{ fontSize: '11px', fontWeight: '750', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>เลือกรายชื่อพนักงานเพื่อดูสถิติ</span>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedAgentId}
                    onChange={handleAgentChange}
                    style={{
                      width: '100%',
                      background: 'var(--bg-input)',
                      border: '1px solid rgba(8, 145, 178, 0.35)',
                      borderRadius: '14px',
                      padding: '12px 42px 12px 18px',
                      color: 'var(--text-main)',
                      fontWeight: '700',
                      fontSize: '14px',
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none',
                      backdropFilter: 'blur(12px)',
                      WebkitBackdropFilter: 'blur(12px)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                    }}
                    onFocus={(e) => {
                      e.target.style.border = '1px solid var(--primary)';
                      e.target.style.boxShadow = '0 0 15px rgba(0, 242, 254, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.target.style.border = '1px solid rgba(8, 145, 178, 0.35)';
                      e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
                    }}
                  >
                    {staffList.map((staff) => (
                      <option key={staff.id} value={staff.id} style={{ background: 'var(--bg-card)', color: 'var(--text-main)' }}>
                        {staff.full_name} ({staff.role})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={18} color="var(--primary)" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                </div>
              </div>
            </div>
          </div>
 
          {/* AI Executive Performance Evaluation Card */}
          <div 
            className="glass" 
            style={{ 
              padding: '24px 32px', 
              marginBottom: '32px', 
              border: '1px solid rgba(0, 242, 254, 0.3)', 
              background: 'var(--bg-card)',
              boxShadow: '0 8px 32px rgba(0, 242, 254, 0.08)',
              borderRadius: '16px',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {/* Card Header (Expand / Collapse) */}
            <div 
              onClick={() => setAiCardExpanded(!aiCardExpanded)}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(14, 165, 233, 0.12)', padding: '10px', borderRadius: '12px', color: '#0ea5e9' }}>
                  <Bot size={22} style={{ filter: 'drop-shadow(0 0 4px rgba(14, 165, 233, 0.4))' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>การประเมินผลงานระดับบริหารด้วย AI (Gemini Agent Audit)</span>
                    {evaluation && (
                      <span style={{ fontSize: '10px', fontWeight: '800', background: evaluation.isSimulated ? 'rgba(234, 84, 85, 0.12)' : 'rgba(40, 199, 111, 0.12)', color: evaluation.isSimulated ? 'var(--danger)' : 'var(--success)', padding: '2px 8px', borderRadius: '20px', border: evaluation.isSimulated ? '1px solid rgba(234, 84, 85, 0.2)' : '1px solid rgba(40, 199, 111, 0.2)' }}>
                        {evaluation.isSimulated ? 'SIMULATED AUDIT' : 'GEMINI ACTIVE AUDIT'}
                      </span>
                    )}
                  </h3>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                    วิเคราะห์ศักยภาพ ทักษะบริการ ความเร็ว และคุณภาพการดูแลลูกค้า 360 องศา
                  </p>
                </div>
              </div>
              <button 
                className="glass-interactive flex-center"
                style={{ fontSize: '12px', fontWeight: '800', color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.08)', padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(14, 165, 233, 0.2)' }}
              >
                {aiCardExpanded ? 'ย่อรายละเอียด ▲' : 'ขยายรายละเอียด ▼'}
              </button>
            </div>

            {/* Collapsible Content */}
            {aiCardExpanded && (
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '24px' }}>
                {!evaluation ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center', gap: '16px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', lineHeight: '1.6' }}>
                      ยังไม่ได้ประเมินผลงานสำหรับ <strong>{selectedAgentName}</strong> ในช่วงเวลานี้ กดปุ่มด้านล่างเพื่อปลุกพลัง AI (Gemini 3.5 Flash) ทำการประเมินมิติผลงานทันที
                    </p>
                    <button
                      onClick={() => handleGenerateAIEvaluation(false)}
                      disabled={evalLoading}
                      className="glass-interactive flex-center animate-pulse-subtle"
                      style={{
                        padding: '12px 28px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.95) 0%, rgba(99, 102, 241, 0.95) 100%)',
                        border: 'none',
                        color: '#ffffff',
                        fontWeight: '800',
                        fontSize: '14px',
                        gap: '8px',
                        boxShadow: '0 8px 25px rgba(14, 165, 233, 0.3)',
                        cursor: evalLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {evalLoading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          <span>กำลังดึงสถิติและประมวลผลประเมิน...</span>
                        </>
                      ) : (
                        <>
                          <Bot size={18} style={{ color: '#ffffff' }} />
                          <span>เริ่มการประเมินผลงานด้วย AI (Gemini)</span>
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {data.stats.resolvedCount === 0 && (
                      <div className="glass" style={{ padding: '16px 20px', background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', alignItems: 'flex-start', gap: '12px', borderRadius: '12px' }}>
                        <AlertTriangle size={20} color="var(--warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '13px', fontWeight: '800', color: 'var(--warning)' }}>ข้อมูลผลงานไม่เพียงพอ</h4>
                          <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                            พนักงานรายนี้ไม่มีประวัติการแก้ไขใบงานในช่วงเวลาที่เลือก ส่งผลให้ AI ประเมินผลงานด้วยข้อมูลที่เป็นศูนย์ (0) ซึ่งบทวิเคราะห์อาจไม่สะท้อนผลงานที่แท้จริง
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Multidimensional Rating Bars */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                      {[
                        { key: 'speed', label: '⚡ ประสิทธิภาพความเร็ว (Speed)', color: '#0ea5e9', glow: 'rgba(14, 165, 233, 0.3)' },
                        { key: 'quality', label: '🛡️ คุณภาพการแก้ไข (Quality)', color: '#28c76f', glow: 'rgba(40, 199, 111, 0.3)' },
                        { key: 'sla', label: '⏰ การรักษาสัญญา SLA (SLA Compliance)', color: '#7367f0', glow: 'rgba(115, 103, 240, 0.3)' },
                        { key: 'csat', label: '⭐ ความพึงพอใจลูกค้า (Customer CSAT)', color: '#ff9f43', glow: 'rgba(255, 159, 67, 0.3)' }
                      ].map((dim) => {
                        const val = evaluation.dimensions?.[dim.key as keyof AIEvaluation['dimensions']] || { rating: 75, feedback: '' };
                        return (
                          <div key={dim.key} className="glass" style={{ padding: '18px 20px', background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>{dim.label}</span>
                              <span style={{ fontSize: '13px', fontWeight: '900', color: dim.color }}>{val.rating}%</span>
                            </div>
                            <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                              <div style={{ height: '100%', width: `${val.rating}%`, background: dim.color, borderRadius: '3px', boxShadow: `0 0 8px ${dim.glow}` }} />
                            </div>
                            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: '1.5' }}>{val.feedback}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strengths & Recommendations */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
                      {/* Key Strengths */}
                      <div className="glass" style={{ padding: '20px 24px', background: 'rgba(40, 199, 111, 0.05)', border: '1px solid rgba(40, 199, 111, 0.2)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '800', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Check size={16} /> จุดแข็งหลักที่โดดเด่น (Key Strengths)
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {evaluation.strengths?.map((s: string, i: number) => (
                            <li key={i} style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: '1.5' }}>{s}</li>
                          ))}
                        </ul>
                      </div>

                      {/* Growth Opportunities */}
                      <div className="glass" style={{ padding: '20px 24px', background: 'rgba(14, 165, 233, 0.05)', border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ArrowRight size={16} /> โอกาสการพัฒนาศักยภาพ (Growth Opportunities)
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {evaluation.recommendations?.map((r: string, i: number) => (
                            <li key={i} style={{ fontSize: '12.5px', color: 'var(--text-dim)', lineHeight: '1.5' }}>{r}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Executive Summary Paragraph */}
                    <div className="glass" style={{ padding: '20px 24px', background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                      <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📊 บทสรุปสำหรับผู้บริหาร (Executive Overview)
                      </h4>
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6', fontStyle: 'italic' }}>
                        &quot;{evaluation.overallSummary}&quot;
                      </p>
                    </div>

                    {/* Footer Controls & Export Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                      <button
                        onClick={() => handleGenerateAIEvaluation(true)}
                        disabled={evalLoading}
                        className="glass-interactive flex-center animate-pulse-subtle"
                        style={{ 
                          padding: '10px 22px', 
                          borderRadius: '10px', 
                          fontSize: '12.5px', 
                          fontWeight: '800', 
                          color: '#ffffff', 
                          background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.9) 0%, rgba(99, 102, 241, 0.9) 100%)', 
                          border: 'none',
                          boxShadow: '0 4px 15px rgba(14, 165, 233, 0.2)'
                        }}
                      >
                        {evalLoading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        <span>ประเมินวิเคราะห์ใหม่อีกครั้ง</span>
                      </button>

                      <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Export Excel */}
                        <button
                          onClick={handleExportExcel}
                          className="glass-interactive flex-center"
                          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '12.5px', fontWeight: '800', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                        >
                          <Download size={14} /> Export Excel
                        </button>

                        {/* Export PDF */}
                        <button
                          onClick={handleExportPDF}
                          disabled={loadingStats}
                          className="glass-interactive flex-center"
                          style={{ padding: '10px 20px', borderRadius: '10px', fontSize: '12.5px', fontWeight: '850', color: '#0a0e14', background: 'var(--primary)', border: 'none', boxShadow: '0 0 10px rgba(0, 242, 254, 0.2)' }}
                        >
                          {loadingStats ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                          <span>ดาวน์โหลดใบรับรอง PDF</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Wrapper for Stats Content with Loading Overlay */}
          <div style={{ position: 'relative', minHeight: '300px' }}>
            {loadingStats && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(10, 14, 20, 0.45)',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10,
                animation: 'fadeIn 0.3s ease-out'
              }}>
                <div className="glass" style={{ padding: '20px 32px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(0, 242, 254, 0.2)', background: 'rgba(15, 23, 42, 0.8)' }}>
                  <Loader2 className="animate-spin" size={24} color="var(--primary)" />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>กำลังอัปเดตข้อมูล...</span>
                </div>
              </div>
            )}

            {/* Content to dim during loading */}
            <div style={{ opacity: loadingStats ? 0.6 : 1, transition: 'opacity 0.3s ease' }}>
              {/* KPI Analytics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '12px', borderRadius: '14px' }}>
                    <CheckCircle size={24} color="var(--success)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ใบงานที่ปิดแล้ว</p>
                    <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>{data.stats.resolvedCount}</h3>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>จากทั้งหมด {data.stats.totalClaimed} เคส</span>
                  </div>
                </div>

                <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '12px', borderRadius: '14px' }}>
                    <Clock size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>เวลาปิดงานเฉลี่ย</p>
                    <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                      {data.stats.avgResolutionTime} <span style={{ fontSize: '14px', fontWeight: '600' }}>ชม.</span>
                    </h3>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>SLA ผ่านเกณฑ์ {data.stats.slaComplianceRate}%</span>
                  </div>
                </div>

                <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '12px', borderRadius: '14px' }}>
                    <AlertTriangle size={24} color="var(--danger)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>อัตราการส่งกลับแก้</p>
                    <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                      {data.stats.reworkRate}%
                    </h3>
                    <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>โดนตีกลับ {data.stats.reworkCount} ครั้ง</span>
                  </div>
                </div>

                <div className="glass" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ background: 'rgba(255, 159, 67, 0.1)', padding: '12px', borderRadius: '14px' }}>
                    <Star size={24} color="var(--warning)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>ความพึงพอใจ CSAT</p>
                    <h3 style={{ fontSize: '28px', fontWeight: '850', color: 'var(--text-main)', marginTop: '4px' }}>
                      {data.stats.avgCsat > 0 ? `${data.stats.avgCsat} / 5` : 'ไม่มีประเมิน'}
                    </h3>
                    <div style={{ display: 'flex', gap: '2px', marginTop: '4px' }}>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Star 
                          key={i} 
                          size={10} 
                          fill={i < Math.round(data.stats.avgCsat) ? 'var(--warning)' : 'transparent'} 
                          color="var(--warning)" 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW SECTION: Executive Team Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Workload & Capacity Tracking */}
                <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}>
                        <Activity size={16} />
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>ติดตามภาระงาน (Capacity Tracking)</h3>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '300px', paddingRight: '10px' }}>
                    {teamStats.sort((a,b) => b.activeCount - a.activeCount).map((agent) => {
                      const MAX_CAPACITY = 15;
                      const pct = Math.min(100, (agent.activeCount / MAX_CAPACITY) * 100);
                      const isOverload = agent.activeCount >= MAX_CAPACITY;
                      const isWarning = agent.activeCount >= MAX_CAPACITY * 0.8;
                      const color = isOverload ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--success)';
                      return (
                        <div key={agent.id}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{agent.name}</span>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: color }}>{agent.activeCount} / {MAX_CAPACITY} เคส</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                width: `${pct}%`,
                                background: color,
                                borderRadius: '4px',
                                transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: `0 0 10px ${color}80`
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Agent Scatter Matrix */}
                <div className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--secondary)' }}>
                        <BarIcon size={16} />
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>แมทริกซ์ประสิทธิภาพ (Performance Matrix)</h3>
                    </div>
                  </div>
                  
                  <div style={{ flex: 1, minHeight: '300px' }}>
                     <ResponsiveContainer width="100%" height={300}>
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                          <XAxis type="number" dataKey="avgResolutionTime" name="เวลาเฉลี่ย (ชม.)" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                          <YAxis type="number" dataKey="resolvedCount" name="จำนวนเคสที่ปิด" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                          <ZAxis type="category" dataKey="name" name="พนักงาน" />
                          <Tooltip 
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '12px' }}
                            itemStyle={{ fontWeight: '700', color: 'var(--primary)' }}
                          />
                          <Scatter name="พนักงาน" data={teamStats.filter(s => s.resolvedCount > 0 || s.avgResolutionTime > 0)} fill="var(--primary)">
                            {teamStats.filter(s => s.resolvedCount > 0 || s.avgResolutionTime > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                     </ResponsiveContainer>
                     <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>แกน X: เวลาเฉลี่ยในการปิดงาน (ชม.) • แกน Y: จำนวนงานที่ปิดได้</p>
                  </div>
                </div>
              </div>

              {/* Existing Charts Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Resolution Trend Chart */}
                <div className="glass" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--primary)' }}>
                      <TrendingUp size={16} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>แนวโน้มการแก้ไขงานรายวัน</h3>
                  </div>

                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={data.resolutionTrend}>
                      <defs>
                        <linearGradient id="colorValueStaff" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                      <YAxis stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip 
                        contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}
                        labelStyle={{ fontWeight: '700', fontSize: '12px', color: 'var(--text-main)' }}
                        itemStyle={{ color: 'var(--primary)', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3} fillOpacity={1} fill="url(#colorValueStaff)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* SLA Compliance Gauge Chart */}
                <div className="glass" style={{ padding: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--success)' }}>
                      <PieIcon size={16} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>อัตราการรักษาสัญญา SLA</h3>
                  </div>

                  {filteredSlaData.length === 0 ? (
                    <div className="flex-center" style={{ height: '260px', color: 'var(--text-muted)' }}>พนักงานไม่มีเคสที่ติดเงื่อนไข SLA</div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', flexWrap: 'wrap', gap: '16px' }}>
                      <ResponsiveContainer width={180} height={200}>
                        <PieChart>
                          <Pie
                            data={filteredSlaData}
                            innerRadius={50}
                            outerRadius={75}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {filteredSlaData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={SLA_COLORS[index % SLA_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ความถูกต้องตามเกณฑ์</p>
                          <p style={{ fontSize: '24px', fontWeight: '900', color: 'var(--success)' }}>{data.stats.slaComplianceRate}%</p>
                        </div>
                        {filteredSlaData.map((entry, idx) => (
                          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '4px', background: SLA_COLORS[idx % SLA_COLORS.length] }} />
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>{entry.name}</span>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({entry.value} ใบงาน)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Problem Category horizontal Bar Chart */}
                <div className="glass" style={{ padding: '24px', gridColumn: 'span 2' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                    <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--secondary)' }}>
                      <BarIcon size={16} />
                    </div>
                    <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>สัดส่วนประเภทปัญหาที่ดูแลสูงสุด (Top Categories Handled)</h3>
                  </div>

                  {data.categoryData.length === 0 ? (
                    <div className="flex-center" style={{ height: '240px', color: 'var(--text-muted)' }}>ไม่มีข้อมูลบันทึกประเภทปัญหา</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <RechartsBarChart layout="vertical" data={data.categoryData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" stroke="var(--text-dim)" fontSize={11} axisLine={false} tickLine={false} width={150} />
                        <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }} />
                        <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={16}>
                          {data.categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </RechartsBarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Timeline and History log */}
              <div className="glass" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
                  <div style={{ background: 'rgba(255, 159, 67, 0.1)', padding: '6px', borderRadius: '8px', color: 'var(--warning)' }}>
                    <Activity size={16} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>บันทึกประวัติการทำงานของพนักงานล่าสุด (Employee Activity Log)</h3>
                </div>

                {paginatedTimeline.length === 0 ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    ไม่มีบันทึกประวัติการทำงานล่าสุดในช่วงเวลานี้
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {paginatedTimeline.map((item, idx) => (
                      <div key={item.id || idx} style={{ display: 'flex', gap: '16px', borderBottom: idx < paginatedTimeline.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', paddingBottom: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <div style={{ 
                            width: '12px', 
                            height: '12px', 
                            borderRadius: '50%', 
                            background: item.action === 'resolve' || item.action === 'close' ? 'var(--success)' : item.action === 'reject' ? 'var(--danger)' : 'var(--primary)',
                            boxShadow: '0 0 10px rgba(0,242,254,0.3)',
                            marginTop: '4px'
                          }} />
                          {idx < paginatedTimeline.length - 1 && (
                            <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.05)', marginTop: '8px' }} />
                          )}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)' }}>{item.ticketNo}</span>
                              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{item.subject}</span>
                              <span 
                                style={{ 
                                    fontSize: '10px', 
                                    padding: '2px 8px', 
                                    borderRadius: '6px', 
                                    fontWeight: '800', 
                                    ...getActionBadgeStyle(item.action) 
                                }}
                              >
                                {getActionTypeLabel(item.action)}
                              </span>
                            </div>

                            <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                              {DateTime.fromISO(item.createdAt).toFormat('dd MMM yyyy, HH:mm น.')}
                            </span>
                          </div>

                          {item.note && (
                            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '10px 14px', marginTop: '8px', fontSize: '13px', color: 'var(--text-dim)' }}>
                              <span style={{ fontWeight: '700', color: 'var(--text-muted)', marginRight: '6px' }}>บันทึก:</span>
                              {item.note}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Pagination Controls */}
                    {totalTimelinePages > 1 && (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        gap: '16px', 
                        marginTop: '24px', 
                        paddingTop: '20px', 
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                      }}>
                        <button
                          onClick={() => setCurrentTimelinePage(prev => Math.max(prev - 1, 1))}
                          disabled={currentTimelinePage === 1}
                          className="glass-interactive"
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: currentTimelinePage === 1 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: currentTimelinePage === 1 ? 'var(--text-dim)' : 'var(--text-main)',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: currentTimelinePage === 1 ? 'not-allowed' : 'pointer',
                            opacity: currentTimelinePage === 1 ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          ย้อนกลับ
                        </button>
                        
                        <span style={{ 
                          fontSize: '13px', 
                          color: 'var(--text-muted)', 
                          fontWeight: '600'
                        }}>
                          หน้า <span style={{ color: 'var(--primary)', fontWeight: '800' }}>{currentTimelinePage}</span> จาก {totalTimelinePages}
                        </span>
                        
                        <button
                          onClick={() => setCurrentTimelinePage(prev => Math.min(prev + 1, totalTimelinePages))}
                          disabled={currentTimelinePage === totalTimelinePages}
                          className="glass-interactive"
                          style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            background: currentTimelinePage === totalTimelinePages ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            color: currentTimelinePage === totalTimelinePages ? 'var(--text-dim)' : 'var(--text-main)',
                            fontSize: '13px',
                            fontWeight: '700',
                            cursor: currentTimelinePage === totalTimelinePages ? 'not-allowed' : 'pointer',
                            opacity: currentTimelinePage === totalTimelinePages ? 0.4 : 1,
                            transition: 'all 0.2s ease',
                          }}
                        >
                          ถัดไป
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
