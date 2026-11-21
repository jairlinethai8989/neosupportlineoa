/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import {
  Presentation,
  Loader2,
  Sliders,
  Sparkles,
  X,
  Bot,
  Layers,
  FileText,
  Info,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import dynamic from 'next/dynamic';
import { Button, EmptyState, Input, PageHeader, Select, Textarea } from '@/components/ui';
import styles from '@/components/reports/reports.module.css';

const PresentationViewer = dynamic(() => import('@/components/reports/PresentationViewer'), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Loader2 className="animate-spin" color="var(--color-primary)" />
    </div>
  ),
});

let html2CanvasPromise: Promise<(typeof import('html2canvas'))['default']> | null = null;
let jsPdfPromise: Promise<(typeof import('jspdf'))['jsPDF']> | null = null;
let pptxGenPromise: Promise<any> | null = null;

async function loadExportModules() {
  if (!html2CanvasPromise) {
    html2CanvasPromise = import('html2canvas').then((m) => m.default);
  }
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf').then((m) => m.jsPDF);
  }
  if (!pptxGenPromise) {
    pptxGenPromise = import('pptxgenjs').then((m) => m.default);
  }
  const [html2canvas, jsPDF, pptxgen] = await Promise.all([html2CanvasPromise, jsPdfPromise, pptxGenPromise]);
  return { html2canvas, jsPDF, pptxgen };
}

type PresentationData = {
  dateRange: { start: string; end: string };
  summary: {
    totalTickets: number;
    resolvedTickets: number;
    resolvedRate: number;
    topHospital: { name: string; count: number };
    topCategory: { name: string; count: number };
  };
  categories: { name: string; count: number }[];
  topOrganizations: {
    name: string;
    totalTickets: number;
    resolvedTickets: number;
    tickets: {
      id: string;
      subject: string;
      status: string;
      issue_type: string;
      created_at: string;
    }[];
  }[];
};

type GeminiInsights = {
  executiveSummary: string;
  keyChallenges: { title: string; description: string }[];
  actionItems: { action: string; owner: string; targetDate: string }[];
  hospitalInsights: Record<string, string>;
  isSimulated: boolean;
  errorMsg?: string;
};

const PRESET_PROMPTS = [
  {
    id: 'executive',
    label: 'เน้นสรุปภาพรวมเชิงบริหาร (Executive Focus)',
    prompt: 'โปรดเน้นเขียนสรุปภาพรวมผู้บริหารแบบเฉียบคม สรุปความเสี่ยงทางเทคนิคที่พบ และคำแนะนำเพื่อแก้ไขปัญหาอย่างยั่งยืน',
  },
  {
    id: 'technical',
    label: 'เจาะลึกความเสี่ยงเชิงเทคนิค (Technical & SLA Focus)',
    prompt: 'โปรดวิเคราะห์ตั๋วที่ค้างชี้ชัดว่าองค์กร/บริษัทไหนมีปัญหาคอขวดสูงสุด ปัญหาเชิงเทคนิคหลักคืออะไร และขั้นตอนการแก้ไขด่วนตามกำหนดเวลา SLA',
  },
  {
    id: 'motivational',
    label: 'เน้นส่งเสริมทีมงานและการประสานงาน (Team Focus)',
    prompt: 'โปรดสรุปผลงานในโทนสร้างบวกและให้กำลังใจ ชื่นชมจุดที่ปิดงานได้เร็ว และเสนอแนะจุดที่สามารถเพิ่มประสิทธิผลร่วมกันระหว่างผู้ใช้บริการและทีมซัพพอร์ต',
  },
];

type TemplateName = 'dark-executive' | 'ocean-cobalt' | 'brutalist-steel' | 'minimalist-light';

const getThemeStyles = (template: TemplateName) => {
  switch (template) {
    case 'ocean-cobalt':
      return {
        bg: '#0b1017',
        cardBg: '#111822',
        border: '1px solid #233042',
        borderThin: '1px solid #233042',
        textMain: '#f1f5f9',
        textMuted: '#94a3b8',
        accent1: '#3b82f6',
        accent2: '#0d9488',
        accent3: '#38bdf8',
        fontFamily: 'var(--font-sans)',
        headerBorder: '1px solid #233042',
        gradientBg: 'linear-gradient(135deg, #0b1017 0%, #111822 100%)',
        accent1Light: 'rgba(59, 130, 246, 0.14)',
        accent2Light: 'rgba(13, 148, 136, 0.14)',
        accent3Light: 'rgba(56, 189, 248, 0.14)',
        tableHeaderBg: '#17202e',
        shadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        glowText: 'none',
      };
    case 'brutalist-steel':
      return {
        bg: '#18181b',
        cardBg: '#27272a',
        border: '2px solid #f8fafc',
        borderThin: '1px solid #52525b',
        textMain: '#f8fafc',
        textMuted: '#a1a1aa',
        accent1: '#f8fafc',
        accent2: '#fbbf24',
        accent3: '#38bdf8',
        fontFamily: 'var(--font-sans)',
        headerBorder: '2px solid #f8fafc',
        gradientBg: 'linear-gradient(135deg, #18181b, #27272a)',
        accent1Light: 'rgba(255, 255, 255, 0.08)',
        accent2Light: 'rgba(251, 191, 36, 0.15)',
        accent3Light: 'rgba(56, 189, 248, 0.15)',
        tableHeaderBg: '#3f3f46',
        shadow: '0 4px 16px rgba(0, 0, 0, 0.45)',
        glowText: 'none',
      };
    case 'minimalist-light':
      return {
        bg: '#f5f7fa',
        cardBg: '#ffffff',
        border: '1px solid #cbd5e1',
        borderThin: '1px solid #e2e8f0',
        textMain: '#0f172a',
        textMuted: '#475569',
        accent1: '#1d4ed8',
        accent2: '#d97706',
        accent3: '#0284c7',
        fontFamily: 'var(--font-sans)',
        headerBorder: '1px solid #cbd5e1',
        gradientBg: 'linear-gradient(135deg, #ffffff 0%, #f0f4f8 100%)',
        accent1Light: 'rgba(29, 78, 216, 0.08)',
        accent2Light: 'rgba(217, 119, 6, 0.08)',
        accent3Light: 'rgba(2, 132, 199, 0.08)',
        tableHeaderBg: '#f1f5f9',
        shadow: '0 2px 12px rgba(15, 23, 42, 0.06)',
        glowText: 'none',
      };
    case 'dark-executive':
    default:
      return {
        bg: '#0f172a',
        cardBg: '#1e293b',
        border: '1px solid #334155',
        borderThin: '1px solid #334155',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        accent1: '#10b981',
        accent2: '#f59e0b',
        accent3: '#38bdf8',
        fontFamily: 'var(--font-sans)',
        headerBorder: '1px solid #334155',
        gradientBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        accent1Light: 'rgba(16, 185, 129, 0.12)',
        accent2Light: 'rgba(245, 158, 11, 0.12)',
        accent3Light: 'rgba(56, 189, 248, 0.12)',
        tableHeaderBg: '#1e293b',
        shadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
        glowText: 'none',
      };
  }
};

export default function PresentationPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<PresentationData | null>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(true);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('ocean-cobalt');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('executive');
  const [userApiKey] = useState('');
  const [aiInsights, setAiInsights] = useState<GeminiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInputMode, setAiInputMode] = useState<'preset' | 'custom'>('preset');

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    const end = new Date();
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [tempDateRange, setTempDateRange] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(now.setDate(diff));
    const end = new Date();
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const presentationRef = useRef<HTMLDivElement>(null);
  const { addToast } = useNotificationContext();

  const activeTheme = getThemeStyles(selectedTemplate);

  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isDrawerOpen]);

  const fetchPresentationData = async (start: string, end: string, shouldCloseDrawer = false) => {
    setLoading(true);
    if (shouldCloseDrawer) {
      setIsDrawerOpen(false);
    }
    try {
      const res = await fetch(`/api/reports/presentation?start=${start}&end=${end}`);
      if (!res.ok) throw new Error('Failed to fetch presentation data');
      const payload = await res.json();
      setData(payload);
      setIsPreviewVisible(true);
      setAiInsights(null);
      setCurrentSlideIndex(0);
      return payload;
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `err-fetch-${Date.now()}`,
        type: 'sla_warning',
        title: 'Error',
        body: err instanceof Error ? err.message : 'Unable to load presentation data',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAIInsights = async () => {
    setAiLoading(true);
    const preset = PRESET_PROMPTS.find((p) => p.id === selectedPresetId);
    const finalPrompt =
      aiInputMode === 'custom'
        ? customPrompt.trim()
        : preset
          ? preset.prompt
          : PRESET_PROMPTS[0].prompt;

    if (aiInputMode === 'custom' && !finalPrompt) {
      addToast({
        id: `ai-empty-${Date.now()}`,
        type: 'sla_warning',
        title: 'Prompt ว่างเปล่า',
        body: 'กรุณากรอกคำสั่ง Prompt ก่อนดำเนินการวิเคราะห์ด้วย AI',
      });
      setAiLoading(false);
      return;
    }

    try {
      const freshData = await fetchPresentationData(tempDateRange.start, tempDateRange.end, false);
      if (!freshData) {
        throw new Error('Unable to retrieve new statistics data for the selected period.');
      }

      const res = await fetch('/api/reports/presentation/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketData: freshData,
          customPrompt: finalPrompt,
          userApiKey: userApiKey.trim() || undefined,
        }),
      });

      if (!res.ok) throw new Error('Failed to fetch AI insights from server');
      const payload: GeminiInsights = await res.json();

      setDateRange({ start: tempDateRange.start, end: tempDateRange.end });
      setAiInsights(payload);
      setIsPreviewVisible(true);

      addToast({
        id: `ai-success-${Date.now()}`,
        type: 'ticket',
        title: payload.isSimulated ? 'โหลดการวิเคราะห์จำลองสำเร็จ' : 'วิเคราะห์ด้วย Gemini สำเร็จ',
        body: payload.isSimulated
          ? 'ระบบเรนเดอร์ข้อมูลวิเคราะห์จำลองเรียบร้อยแล้ว'
          : 'Gemini อัปเดตบทวิเคราะห์ระดับผู้บริหารลงในสไลด์เสร็จสิ้น',
      });
      setIsDrawerOpen(false);
      setCurrentSlideIndex(0);
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `ai-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'AI Analytics Fail',
        body: err instanceof Error ? err.message : 'Unable to connect to Gemini API',
      });
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data) return;
      const totalSlides = 2 + (aiInsights ? 1 : 0) + (data?.topOrganizations?.length || 0);
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data, aiInsights]);

  const handleExportPDF = async () => {
    if (!data || !presentationRef.current) return;
    setExporting(true);
    setIsDrawerOpen(false);
    const toastId = `export-pdf-${Date.now()}`;
    addToast({
      id: toastId,
      type: 'ticket',
      title: 'กำลังสร้างไฟล์ PDF...',
      body: 'โปรดรอสักครู่ ระบบกำลังจับภาพสไลด์และสร้างไฟล์ PDF',
    });

    try {
      const { html2canvas, jsPDF } = await loadExportModules();
      const slides = presentationRef.current.querySelectorAll('.pdf-slide-page') as NodeListOf<HTMLElement>;

      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i];

        const originalDisplay = slideElement.style.display;
        slideElement.style.display = 'flex';
        slideElement.style.position = 'absolute';
        slideElement.style.top = '0';
        slideElement.style.left = '0';
        slideElement.style.opacity = '1';
        slideElement.style.zIndex = '-10';
        slideElement.style.transform = 'none';

        const canvas = await html2canvas(slideElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: activeTheme.bg,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');

        slideElement.style.display = originalDisplay;
        slideElement.style.position = '';
        slideElement.style.top = '';
        slideElement.style.left = '';
        slideElement.style.opacity = '';
        slideElement.style.zIndex = '';
        slideElement.style.transform = '';

        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      }

      pdf.save(`Weekly_Presentation_${dateRange.start}_to_${dateRange.end}.pdf`);

      addToast({
        id: `export-success-${Date.now()}`,
        type: 'ticket',
        title: 'สร้าง PDF สำเร็จ',
        body: 'ดาวน์โหลดไฟล์ Presentation เรียบร้อยแล้ว',
      });
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `export-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'เกิดข้อผิดพลาด',
        body: 'ไม่สามารถสร้างไฟล์ PDF ได้ โปรดลองอีกครั้ง',
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportPPTX = async () => {
    if (!data || !presentationRef.current) return;
    setExporting(true);
    setIsDrawerOpen(false);
    const toastId = `export-pptx-${Date.now()}`;
    addToast({
      id: toastId,
      type: 'ticket',
      title: 'กำลังสร้างไฟล์ PowerPoint...',
      body: 'โปรดรอสักครู่ ระบบกำลังจัดเตรียมไฟล์ PowerPoint',
    });

    try {
      const { html2canvas, pptxgen } = await loadExportModules();
      const slides = presentationRef.current.querySelectorAll('.pdf-slide-page') as NodeListOf<HTMLElement>;

      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i];

        const originalDisplay = slideElement.style.display;
        slideElement.style.display = 'flex';
        slideElement.style.position = 'absolute';
        slideElement.style.top = '0';
        slideElement.style.left = '0';
        slideElement.style.opacity = '1';
        slideElement.style.zIndex = '-10';
        slideElement.style.transform = 'none';

        const canvas = await html2canvas(slideElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: activeTheme.bg,
          logging: false,
        });

        const imgData = canvas.toDataURL('image/png');

        slideElement.style.display = originalDisplay;
        slideElement.style.position = '';
        slideElement.style.top = '';
        slideElement.style.left = '';
        slideElement.style.opacity = '';
        slideElement.style.zIndex = '';
        slideElement.style.transform = '';

        const slide = pptx.addSlide();
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: 10,
          h: 5.625,
        });
      }

      pptx.writeFile({ fileName: `Weekly_Presentation_${dateRange.start}_to_${dateRange.end}.pptx` });

      addToast({
        id: `export-success-${Date.now()}`,
        type: 'ticket',
        title: 'สร้าง PowerPoint สำเร็จ',
        body: 'ดาวน์โหลดไฟล์ Presentation (.pptx) เรียบร้อยแล้ว',
      });
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `export-fail-${Date.now()}`,
        type: 'sla_warning',
        title: 'เกิดข้อผิดพลาด',
        body: 'ไม่สามารถสร้างไฟล์ PowerPoint ได้ โปรดลองอีกครั้ง',
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={`animate-page-in ${styles.pageStack}`} style={{ minHeight: 'calc(100vh - 140px)' }}>
      <PageHeader
        title="Weekly Presentation"
        subtitle="สร้างสไลด์รายงานสรุปผลการดำเนินการประจำสัปดาห์ด้วยเทมเพลตและ AI"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setIsPreviewVisible((prev) => !prev)}
              leftIcon={isPreviewVisible ? <EyeOff size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
            >
              {isPreviewVisible ? 'ซ่อนรายงาน' : 'แสดงรายงาน'}
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={handleExportPDF}
              disabled={exporting || !data}
              loading={exporting}
              leftIcon={<FileText size={15} color="var(--color-danger)" aria-hidden="true" />}
            >
              ส่งออก PDF
            </Button>

            <Button
              variant="secondary"
              size="md"
              onClick={handleExportPPTX}
              disabled={exporting || !data}
              loading={exporting}
              leftIcon={<Presentation size={15} color="var(--color-warning)" aria-hidden="true" />}
            >
              ส่งออก PPTX
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={() => setIsDrawerOpen(true)}
              leftIcon={<Sliders size={16} aria-hidden="true" />}
            >
              ตั้งค่ารายงาน & AI
            </Button>
          </div>
        }
      />

      {!isPreviewVisible ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--color-surface)',
            border: '1px dashed var(--color-border-strong)',
            borderRadius: 'var(--radius-lg)',
            padding: 40,
          }}
        >
          <EmptyState
            icon={<Presentation size={36} color="var(--color-primary)" aria-hidden="true" />}
            title="ย่อพรีวิวรายงานสไลด์ไว้"
            description="คุณสามารถขยายเพื่อแสดงภาพพรีวิวสไลด์รายงาน Weekly Presentation ได้ทุกเมื่อ"
            action={
              <Button variant="primary" onClick={() => setIsPreviewVisible(true)} leftIcon={<Eye size={16} aria-hidden="true" />}>
                ขยายแสดงพรีวิวสไลด์
              </Button>
            }
          />
        </div>
      ) : (
        <div className={styles.presentationStage}>
          {!data && !loading ? (
            <div style={{ margin: 'auto', padding: 40 }}>
              <EmptyState
                icon={<Presentation size={40} color="#3b82f6" aria-hidden="true" />}
                title={<span style={{ color: '#f1f5f9' }}>Weekly Presentation Report</span>}
                description={
                  <span style={{ color: '#94a3b8' }}>
                    รายงานสถิติและบทวิเคราะห์ประจำสัปดาห์ยังไม่ได้ดึงข้อมูล กดปุ่มตั้งค่าเพื่อเริ่มต้น
                  </span>
                }
                action={
                  <Button variant="primary" onClick={() => setIsDrawerOpen(true)} leftIcon={<Sliders size={16} aria-hidden="true" />}>
                    ตั้งค่ารายงาน & AI เพื่อเริ่มต้น
                  </Button>
                }
              />
            </div>
          ) : null}

          {loading ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: '#3b82f6' }}>
              <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: '#f1f5f9' }}>
                กำลังดึงข้อมูลสถิติประจำสัปดาห์...
              </p>
            </div>
          ) : null}

          {data && !loading ? (
            <PresentationViewer
              data={data}
              aiInsights={aiInsights}
              currentSlideIndex={currentSlideIndex}
              setCurrentSlideIndex={setCurrentSlideIndex}
              activeTheme={activeTheme}
              presentationRef={presentationRef}
            />
          ) : null}
        </div>
      )}

      {isDrawerOpen ? (
        <div
          className={styles.drawerBackdrop}
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsDrawerOpen(false);
          }}
        />
      ) : null}

      <aside
        aria-label="ตั้งค่ารายงาน & AI"
        aria-hidden={!isDrawerOpen}
        className={styles.drawerPanel}
        style={{ transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sliders size={18} color="var(--color-primary)" aria-hidden="true" />
            <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--color-text)' }}>
              ตั้งค่ารายงาน & AI
            </h2>
          </div>
          <Button variant="ghost" size="sm" iconOnly onClick={() => setIsDrawerOpen(false)} aria-label="ปิดหน้าต่างตั้งค่า">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, flex: 1 }}>
          <div>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              ช่วงเวลารายงาน
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Input
                id="presentation-start-date"
                type="date"
                label="เริ่มวันที่"
                value={tempDateRange.start}
                onChange={(e) => setTempDateRange((prev) => ({ ...prev, start: e.target.value }))}
              />
              <Input
                id="presentation-end-date"
                type="date"
                label="สิ้นสุดวันที่"
                value={tempDateRange.end}
                onChange={(e) => setTempDateRange((prev) => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                color: 'var(--color-info-text)',
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                background: 'var(--color-info-soft)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-info-border)',
                lineHeight: 1.4,
              }}
            >
              {loading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Info size={14} style={{ flexShrink: 0 }} aria-hidden="true" />}
              <span>{loading ? 'กำลังประมวลผลวิเคราะห์ข้อมูลใหม่...' : 'เปลี่ยนช่วงเวลาแล้ว กดปุ่มสร้างรายงานด้านล่างเพื่ออัปเดตสไลด์'}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Layers size={14} aria-hidden="true" />
              เลือกดีไซน์เทมเพลตสไลด์
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {(['ocean-cobalt', 'dark-executive', 'brutalist-steel', 'minimalist-light'] as TemplateName[]).map((themeName) => {
                const isSelected = selectedTemplate === themeName;
                return (
                  <button
                    key={themeName}
                    type="button"
                    onClick={() => setSelectedTemplate(themeName)}
                    style={{
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? 'var(--color-primary-soft)' : 'var(--color-surface-subtle)',
                      border: isSelected ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                      textAlign: 'center',
                      textTransform: 'uppercase',
                    }}
                  >
                    {themeName.replace('-', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16 }}>
            <p style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Bot size={14} aria-hidden="true" />
              วิเคราะห์ด้วย AI (Gemini)
            </p>

            <div className={styles.segmentedGroup} style={{ width: '100%', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => setAiInputMode('preset')}
                className={`${styles.segmentedBtn} ${aiInputMode === 'preset' ? styles.segmentedBtnActive : ''}`}
                style={{ flex: 1 }}
              >
                AI Presets
              </button>
              <button
                type="button"
                onClick={() => setAiInputMode('custom')}
                className={`${styles.segmentedBtn} ${aiInputMode === 'custom' ? styles.segmentedBtnActive : ''}`}
                style={{ flex: 1 }}
              >
                Custom Prompt
              </button>
            </div>

            {aiInputMode === 'preset' ? (
              <div style={{ marginBottom: 16 }}>
                <Select
                  id="presentation-preset-select"
                  label="รูปแบบบทวิเคราะห์สำเร็จรูป"
                  value={selectedPresetId}
                  onChange={(e) => setSelectedPresetId(e.target.value)}
                >
                  {PRESET_PROMPTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </Select>
                <div
                  style={{
                    marginTop: 8,
                    padding: 10,
                    background: 'var(--color-surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--color-border)',
                    fontSize: 'var(--text-xs)',
                    color: 'var(--color-text-muted)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>คำสั่งที่ใช้:</strong> {PRESET_PROMPTS.find((p) => p.id === selectedPresetId)?.prompt}
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <Textarea
                  id="presentation-custom-prompt"
                  label="ระบุ Prompt เพื่อให้ AI วิเคราะห์ตามสั่ง"
                  placeholder="ตัวอย่างเช่น: 'เน้นสรุปประเด็นขององค์กรนางรองเป็นพิเศษ', 'วิเคราะห์เคสปิดช้าเกินเกณฑ์'"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                loading={loading}
                leftIcon={<Presentation size={16} aria-hidden="true" />}
                onClick={async () => {
                  const payload = await fetchPresentationData(tempDateRange.start, tempDateRange.end, true);
                  if (payload) {
                    setDateRange({ start: tempDateRange.start, end: tempDateRange.end });
                    addToast({
                      id: `fetch-success-${Date.now()}`,
                      type: 'ticket',
                      title: 'สร้างรายงานสำเร็จ',
                      body: `ดึงข้อมูลสถิติตั้งแต่วันที่ ${tempDateRange.start} ถึง ${tempDateRange.end} เรียบร้อยแล้ว`,
                    });
                  }
                }}
              >
                {loading ? 'กำลังดึงข้อมูล...' : 'ดึงข้อมูลและสร้างรายงาน'}
              </Button>

              <Button
                variant="primary"
                size="md"
                fullWidth
                loading={aiLoading}
                leftIcon={<Sparkles size={16} aria-hidden="true" />}
                onClick={handleGenerateAIInsights}
              >
                {aiLoading ? 'กำลังส่งไปให้ AI ประมวลผล...' : 'วิเคราะห์ข้อมูลด้วย Gemini'}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
