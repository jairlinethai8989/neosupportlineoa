/* eslint-disable @typescript-eslint/no-explicit-any, react/no-unescaped-entities, @typescript-eslint/no-unused-vars */
'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Calendar, 
  Presentation,
  Loader2,
  Sliders,
  Sparkles,
  X,
  Bot,
  CheckCircle2,
  Layers,
  FileText
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';

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
  topHospitals: {
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
    label: '💼 เน้นสรุปภาพรวมเชิงบริหาร (Executive Focus)',
    prompt: 'โปรดเน้นเขียนสรุปภาพรวมผู้บริหารแบบเฉียบคม สรุปความเสี่ยงทางเทคนิคที่พบ และคำแนะนำเพื่อแก้ไขปัญหาอย่างยั่งยืน'
  },
  {
    id: 'technical',
    label: '🛠️ เจาะลึกความเสี่ยงเชิงเทคนิค (Technical & SLA Focus)',
    prompt: 'โปรดวิเคราะห์ตั๋วที่ค้างชี้ชัดว่าโรงพยาบาลไหนมีปัญหาคอขวดสูงสุด ปัญหาเชิงเทคนิคหลักคืออะไร และขั้นตอนการแก้ไขด่วนตามกำหนดเวลา SLA'
  },
  {
    id: 'motivational',
    label: '🌟 เน้นส่งเสริมทีมงานและการประสานงาน (Team Focus)',
    prompt: 'โปรดสรุปผลงานในโทนสร้างบวกและให้กำลังใจ ชื่นชมจุดที่ปิดงานได้เร็ว และเสนอแนะจุดที่สามารถเพิ่มประสิทธิผลร่วมกันระหว่างผู้ใช้บริการและทีมซัพพอร์ต'
  }
];

type TemplateName = 'dark-executive' | 'cyber-neon' | 'brutalist-steel' | 'minimalist-light';

const getThemeStyles = (template: TemplateName) => {
  switch (template) {
    case 'cyber-neon':
      return {
        bg: '#000000',
        cardBg: '#08080c',
        border: '2px solid #39FF14',
        borderThin: '1px solid rgba(57, 255, 20, 0.2)',
        textMain: '#FFFFFF',
        textMuted: '#888899',
        accent1: '#39FF14', // Neon Green
        accent2: '#FF5F1F', // Neon Orange
        accent3: '#00E5FF', // Neon Blue
        fontFamily: 'Courier New, monospace',
        headerBorder: '1px solid rgba(57, 255, 20, 0.3)',
        gradientBg: 'radial-gradient(circle at top right, #39ff1410, #000000 60%)',
        accent1Light: 'rgba(57, 255, 20, 0.1)',
        accent2Light: 'rgba(255, 95, 31, 0.1)',
        accent3Light: 'rgba(0, 229, 255, 0.1)',
        tableHeaderBg: '#0f0f14',
        shadow: '0 0 15px rgba(57, 255, 20, 0.2)',
        glowText: '0 0 5px #39FF14'
      };
    case 'brutalist-steel':
      return {
        bg: '#18181b',
        cardBg: '#27272a',
        border: '3px solid #f8fafc',
        borderThin: '2px solid #f8fafc',
        textMain: '#f8fafc',
        textMuted: '#a1a1aa',
        accent1: '#f8fafc', // Stark White
        accent2: '#fbbf24', // Bold Gold
        accent3: '#38bdf8', // Sky Blue
        fontFamily: 'Arial Black, Impact, sans-serif',
        headerBorder: '3px solid #f8fafc',
        gradientBg: 'linear-gradient(135deg, #18181b, #27272a)',
        accent1Light: 'rgba(255, 255, 255, 0.08)',
        accent2Light: 'rgba(251, 191, 36, 0.15)',
        accent3Light: 'rgba(56, 189, 248, 0.15)',
        tableHeaderBg: '#3f3f46',
        shadow: '8px 8px 0px rgba(248, 250, 252, 0.15)',
        glowText: 'none'
      };
    case 'minimalist-light':
      return {
        bg: '#fafaf9',
        cardBg: '#ffffff',
        border: '1px solid #1c1917',
        borderThin: '1px solid #e7e5e4',
        textMain: '#1c1917',
        textMuted: '#57534e',
        accent1: '#1c1917', // Elegant Charcoal
        accent2: '#c2410c', // Rust Red
        accent3: '#0369a1', // Muted Cyan
        fontFamily: 'Georgia, serif',
        headerBorder: '1px solid #1c1917',
        gradientBg: 'radial-gradient(circle at top right, #f5f5f4, #fafaf9 80%)',
        accent1Light: 'rgba(28, 25, 23, 0.05)',
        accent2Light: 'rgba(194, 65, 12, 0.05)',
        accent3Light: 'rgba(3, 105, 161, 0.05)',
        tableHeaderBg: '#f5f5f4',
        shadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        glowText: 'none'
      };
    case 'dark-executive':
    default:
      return {
        bg: '#0f172a',
        cardBg: '#1e293b',
        border: '1px solid #1e293b',
        borderThin: '1px solid rgba(30, 41, 59, 0.5)',
        textMain: '#f8fafc',
        textMuted: '#94a3b8',
        accent1: '#10b981', // Emerald
        accent2: '#f59e0b', // Gold
        accent3: '#0ea5e9', // Sky Blue
        fontFamily: 'Inter, sans-serif',
        headerBorder: '1px solid #1e293b',
        gradientBg: 'radial-gradient(circle at top right, #10b98115, #0f172a 40%)',
        accent1Light: 'rgba(16, 185, 129, 0.1)',
        accent2Light: 'rgba(245, 158, 11, 0.1)',
        accent3Light: 'rgba(14, 165, 233, 0.1)',
        tableHeaderBg: '#1e293b',
        shadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
        glowText: 'none'
      };
  }
};

export default function PresentationPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<PresentationData | null>(null);
  
  // Custom states for Drawer, Templates & AI
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateName>('dark-executive');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('executive');
  const [userApiKey, setUserApiKey] = useState('');
  const [aiInsights, setAiInsights] = useState<GeminiInsights | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // By default select current week (Monday to Sunday)
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    const start = new Date(now.setDate(diff));
    const end = new Date();
    return {
      start: start.toISOString().split('T')[0],
      end: end.toISOString().split('T')[0],
    };
  });

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [hasGlobalApiKey, setHasGlobalApiKey] = useState(false);
  const presentationRef = useRef<HTMLDivElement>(null);
  const { addToast } = useNotificationContext();

  const activeTheme = getThemeStyles(selectedTemplate);

  useEffect(() => {
    async function checkGlobalApiKey() {
      try {
        const { data: c } = await supabase.from('company_settings').select('gemini_api_key').limit(1).maybeSingle();
        if (c?.gemini_api_key) {
          setHasGlobalApiKey(true);
        }
      } catch (err) {
        console.error('Error checking global api key:', err);
      }
    }
    checkGlobalApiKey();
  }, []);

  const fetchPresentationData = async (shouldCloseDrawer = false) => {
    setLoading(true);
    if (shouldCloseDrawer) {
      setIsDrawerOpen(false);
    }
    try {
      const res = await fetch(`/api/reports/presentation?start=${dateRange.start}&end=${dateRange.end}`);
      if (!res.ok) throw new Error('Failed to fetch presentation data');
      const payload = await res.json();
      setData(payload);
      setAiInsights(null); // Clear previous AI analytics when loading new data
      setCurrentSlideIndex(0);
    } catch (err: unknown) {
      console.error(err);
      addToast({
        id: `err-fetch-${Date.now()}`,
        type: 'sla_warning',
        title: 'Error',
        body: err instanceof Error ? err.message : 'Unable to load presentation data',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPresentationData(false);
  }, [dateRange.start, dateRange.end]);

  const handleGenerateAIInsights = async () => {
    if (!data) return;
    setAiLoading(true);
    const preset = PRESET_PROMPTS.find(p => p.id === selectedPresetId);
    const finalPrompt = customPrompt.trim() || (preset ? preset.prompt : PRESET_PROMPTS[0].prompt);

    try {
      const res = await fetch('/api/reports/presentation/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketData: data,
          customPrompt: finalPrompt,
          userApiKey: userApiKey.trim() || undefined
        })
      });

      if (!res.ok) throw new Error('Failed to fetch AI insights from server');
      const payload: GeminiInsights = await res.json();
      setAiInsights(payload);

      addToast({
        id: `ai-success-${Date.now()}`,
        type: 'ticket',
        title: payload.isSimulated ? 'โหลดการวิเคราะห์จำลองสำเร็จ' : 'วิเคราะห์ด้วย Gemini สำเร็จ',
        body: payload.isSimulated 
          ? 'ระบบเรนเดอร์ข้อมูลวิเคราะห์จำลองที่สมบูรณ์แบบเรียบร้อยแล้ว ✨' 
          : 'Gemini อัปเดตบทวิเคราะห์ระดับผู้อำนวยการลงในสไลด์เสร็จสิ้น 🚀'
      });
      setIsDrawerOpen(false);
      setCurrentSlideIndex(0); // Return to cover slide to review insights
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
      const totalSlides = 2 + (aiInsights ? 1 : 0) + (data?.topHospitals?.length || 0);
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
      body: 'โปรดรอสักครู่ ระบบกำลังจับภาพสไลด์และสร้างไฟล์ PDF ⏳'
    });

    try {
      const { html2canvas, jsPDF } = await loadExportModules();
      const slides = presentationRef.current.querySelectorAll('.pdf-slide-page') as NodeListOf<HTMLElement>;
      
      const pdf = new jsPDF('landscape', 'mm', 'a4'); // 297 x 210 mm
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i];
        
        // Temporarily force display block/flex for capturing
        const originalDisplay = slideElement.style.display;
        slideElement.style.display = 'flex';
        slideElement.style.position = 'absolute';
        slideElement.style.top = '0';
        slideElement.style.left = '0';
        slideElement.style.opacity = '1';
        slideElement.style.zIndex = '-10'; // render offscreen
        slideElement.style.transform = 'none';

        const canvas = await html2canvas(slideElement, {
          scale: 2, // High resolution
          useCORS: true,
          backgroundColor: activeTheme.bg,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Revert styles
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
        body: 'ดาวน์โหลดไฟล์ Presentation เรียบร้อยแล้ว 🎉'
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
      body: 'โปรดรอสักครู่ ระบบกำลังจัดเตรียมไฟล์ PowerPoint ⏳'
    });

    try {
      const { html2canvas, pptxgen } = await loadExportModules();
      const slides = presentationRef.current.querySelectorAll('.pdf-slide-page') as NodeListOf<HTMLElement>;
      
      const pptx = new pptxgen();
      pptx.layout = 'LAYOUT_16x9';

      for (let i = 0; i < slides.length; i++) {
        const slideElement = slides[i];
        
        // Temporarily force display block/flex for capturing
        const originalDisplay = slideElement.style.display;
        slideElement.style.display = 'flex';
        slideElement.style.position = 'absolute';
        slideElement.style.top = '0';
        slideElement.style.left = '0';
        slideElement.style.opacity = '1';
        slideElement.style.zIndex = '-10'; // render offscreen
        slideElement.style.transform = 'none';

        const canvas = await html2canvas(slideElement, {
          scale: 2, // High resolution
          useCORS: true,
          backgroundColor: activeTheme.bg,
          logging: false
        });

        const imgData = canvas.toDataURL('image/png');
        
        // Revert styles
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
          h: 5.625
        });
      }

      pptx.writeFile({ fileName: `Weekly_Presentation_${dateRange.start}_to_${dateRange.end}.pptx` });
      
      addToast({
        id: `export-success-${Date.now()}`,
        type: 'ticket',
        title: 'สร้าง PowerPoint สำเร็จ',
        body: 'ดาวน์โหลดไฟล์ Presentation (.pptx) เรียบร้อยแล้ว 🎉'
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

  const hasAI = !!aiInsights;
  const totalSlides = data ? 2 + (hasAI ? 1 : 0) + (data.topHospitals?.length || 0) : 0;

  return (
    <div className="animate-page-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingRight: '24px' }}>
      
      {/* Control Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexShrink: 0 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ background: '#10b98120', padding: '10px', borderRadius: '4px', border: '1px solid #10b98140' }}>
              <Presentation size={24} color="#10b981" />
            </div>
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text-main)', textTransform: 'uppercase' }}>
                Weekly Presentation
              </h1>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>
                สร้างสไลด์รายงานสรุปผลการดำเนินการประจำสัปดาห์ด้วยเทมเพลตพรีเมียมและ AI
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingRight: '12px' }}>
          {/* Export Buttons */}
          <button
            onClick={handleExportPDF}
            disabled={exporting || !data}
            className="glass-interactive"
            style={{
              height: '44px',
              padding: '0 16px',
              borderRadius: '4px',
              border: '1px solid #ef4444',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#f87171',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: (exporting || !data) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.05)',
              transition: 'all 0.2s'
            }}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            ส่งออก PDF
          </button>

          <button
            onClick={handleExportPPTX}
            disabled={exporting || !data}
            className="glass-interactive"
            style={{
              height: '44px',
              padding: '0 16px',
              borderRadius: '4px',
              border: '1px solid #f97316',
              background: 'rgba(249, 115, 22, 0.08)',
              color: '#fb923c',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              cursor: (exporting || !data) ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              boxShadow: '0 4px 12px rgba(249, 115, 22, 0.05)',
              transition: 'all 0.2s'
            }}
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Presentation size={14} />}
            ส่งออก PPTX
          </button>

          <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />

          {/* Main settings trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="glass-interactive"
            style={{
              height: '44px',
              padding: '0 20px',
              borderRadius: '4px',
              border: '1px solid #10b981',
              background: '#10b98110',
              color: '#10b981',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.1)'
            }}
          >
            <Sliders size={18} />
            ตั้งค่ารายงาน & AI
          </button>
        </div>
      </div>

      {/* Main presentation area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#070a13', borderRadius: '6px', border: '1px solid #1e293b', position: 'relative', overflow: 'hidden' }}>
        
        {!data && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
            <Presentation size={64} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>ยังไม่ได้โหลดข้อมูลนำเสนอ</h2>
            <p style={{ fontSize: '13px', marginTop: '8px', color: '#475569' }}>กรุณากดปุ่ม "ตั้งค่ารายงาน & AI" เพื่อกำหนดช่วงเวลาและสร้างผลงาน</p>
          </div>
        )}

        {loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#10b981' }}>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px' }}>กำลังดึงข้อมูลสถิติประจำสัปดาห์...</h2>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Arrow Navigation Overlays */}
            <button 
              onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
              disabled={currentSlideIndex === 0}
              style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid #1e293b', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentSlideIndex === 0 ? 0.3 : 1, backdropFilter: 'blur(8px)', transition: 'all 0.3s' }}
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, totalSlides - 1))}
              disabled={currentSlideIndex === totalSlides - 1}
              style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: 'rgba(15, 23, 42, 0.65)', border: '1px solid #1e293b', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlideIndex === totalSlides - 1 ? 'not-allowed' : 'pointer', opacity: currentSlideIndex === totalSlides - 1 ? 0.3 : 1, backdropFilter: 'blur(8px)', transition: 'all 0.3s' }}
            >
              <ChevronRight size={24} />
            </button>

            {/* Slide Index Counter Badge */}
            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: 'rgba(15, 23, 42, 0.85)', border: '1px solid #1e293b', padding: '6px 16px', borderRadius: '24px', fontSize: '12px', fontWeight: '700', color: '#94a3b8', backdropFilter: 'blur(8px)' }}>
              SLIDE <span style={{ color: '#f8fafc' }}>{currentSlideIndex + 1}</span> / {totalSlides}
              {hasAI && <span style={{ marginLeft: '8px', color: '#10b981', fontSize: '10px' }}>● AI POPULATED</span>}
            </div>

            {/* Slide Player Container */}
            <div style={{ flex: 1, padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <div 
                ref={presentationRef}
                style={{ 
                  width: '100%', 
                  maxWidth: '1280px', 
                  aspectRatio: '16/9', 
                  position: 'relative', 
                  background: activeTheme.bg,
                  boxShadow: activeTheme.shadow,
                  border: activeTheme.border,
                  overflow: 'hidden',
                  fontFamily: activeTheme.fontFamily,
                  transition: 'all 0.5s ease'
                }}
              >
                
                {/* 
                  Slide 1: Executive Cover Slide
                */}
                <div 
                  className="pdf-slide-page" 
                  style={{ 
                    display: currentSlideIndex === 0 ? 'flex' : 'none', 
                    width: '100%', height: '100%', padding: '50px 60px', flexDirection: 'column',
                    background: activeTheme.gradientBg
                  }}
                >
                  <div style={{ color: activeTheme.accent1, fontSize: '14px', fontWeight: '800', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px', textShadow: activeTheme.glowText }}>
                    Neo Support Line OA
                  </div>
                  <h1 style={{ fontSize: '44px', fontWeight: '900', color: activeTheme.textMain, letterSpacing: '-1.5px', lineHeight: 1.1, maxWidth: '900px', marginBottom: '20px' }}>
                    WEEKLY SERVICE INTELLIGENCE REPORT
                  </h1>
                  
                  {/* Executive Summary Insight Block */}
                  <div style={{ fontSize: '15px', color: activeTheme.textMuted, fontWeight: '500', lineHeight: 1.6, maxWidth: '980px', padding: '16px 20px', background: activeTheme.accent1Light, borderLeft: `4px solid ${activeTheme.accent1}`, marginBottom: 'auto' }}>
                    {aiInsights ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: activeTheme.accent1, fontSize: '11px', fontWeight: '800', letterSpacing: '1px' }}>
                          <Bot size={14} /> AI EXECUTIVE SUMMARY
                        </div>
                        {aiInsights.executiveSummary}
                      </div>
                    ) : (
                      `สัปดาห์วันที่ ${data.dateRange.start} ถึง ${data.dateRange.end} - ระบบได้ทำการจัดทำสถิติรายงานรอบสัปดาห์ดึงข้อมูลตั๋วงาน ปัญหาคอขวดหลัก และการให้บริการรายโรงพยาบาล เพื่อใช้สำหรับประชุมปรับปรุงประสิทธิภาพและวิเคราะห์ความเสถียรของหน้างานตามเกณฑ์มาตรฐาน SLA`
                    )}
                  </div>

                  {/* Core Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr', gap: '20px', marginTop: '30px' }}>
                    <div style={{ borderLeft: `2px solid ${activeTheme.textMuted}`, paddingLeft: '20px' }}>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Total Volume</div>
                      <div style={{ fontSize: '56px', fontWeight: '900', color: activeTheme.textMain, lineHeight: 1, letterSpacing: '-2px' }}>
                        {data.summary.totalTickets}
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>เคสทั้งหมดสะสม</div>
                    </div>
                    <div style={{ borderLeft: `2px solid ${activeTheme.accent1}`, paddingLeft: '20px' }}>
                      <div style={{ fontSize: '11px', color: activeTheme.accent1, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Resolution Rate</div>
                      <div style={{ fontSize: '56px', fontWeight: '900', color: activeTheme.accent1, lineHeight: 1, letterSpacing: '-2px', textShadow: activeTheme.glowText }}>
                        {data.summary.resolvedRate}%
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>ปิดงานสำเร็จ {data.summary.resolvedTickets} เคส</div>
                    </div>
                    <div style={{ borderLeft: `2px solid ${activeTheme.accent2}`, paddingLeft: '20px' }}>
                      <div style={{ fontSize: '11px', color: activeTheme.accent2, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Top Hospital</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: activeTheme.textMain, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {data.summary.topHospital.name}
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>รายงานสูงสุด {data.summary.topHospital.count} เคส</div>
                    </div>
                    <div style={{ borderLeft: `2px solid ${activeTheme.accent3}`, paddingLeft: '20px' }}>
                      <div style={{ fontSize: '11px', color: activeTheme.accent3, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Dominant Challenge</div>
                      <div style={{ fontSize: '24px', fontWeight: '800', color: activeTheme.textMain, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {data.summary.topCategory.name}
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>พบข้อขัดข้อง {data.summary.topCategory.count} ครั้ง</div>
                    </div>
                  </div>
                </div>

                {/* 
                  Slide 2: Category Landscape & Key Challenges
                */}
                <div 
                  className="pdf-slide-page" 
                  style={{ 
                    display: currentSlideIndex === 1 ? 'flex' : 'none', 
                    width: '100%', height: '100%', padding: '50px 60px', flexDirection: 'column',
                    background: activeTheme.bg
                  }}
                >
                  <div style={{ borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: activeTheme.accent3, fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>operational Analysis</div>
                      <h2 style={{ fontSize: '30px', fontWeight: '800', color: activeTheme.textMain, letterSpacing: '-0.5px', margin: 0 }}>Issue Category & Challenges</h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '22px', fontWeight: '900', color: activeTheme.accent3 }}>{data.categories.length}</div>
                      <div style={{ fontSize: '10px', color: activeTheme.textMuted, textTransform: 'uppercase', fontWeight: '700' }}>Unique Categories</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', flex: 1, minHeight: 0 }}>
                    {/* Left Column: Category Bars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                      <div style={{ fontSize: '12px', fontWeight: '700', color: activeTheme.textMuted, textTransform: 'uppercase', marginBottom: '4px' }}>หมวดหมู่ปัญหาแยกตามสถิติความถี่</div>
                      {data.categories.slice(0, 7).map((cat, idx) => {
                        const maxCount = Math.max(...data.categories.map(c => c.count));
                        const widthPct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '20px', fontSize: '11px', fontWeight: '800', color: activeTheme.textMuted, textAlign: 'right' }}>
                              {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: activeTheme.textMain }}>{cat.name}</span>
                                <span style={{ fontSize: '13px', fontWeight: '800', color: activeTheme.accent3 }}>{cat.count}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: activeTheme.accent1Light, borderRadius: '0px' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: activeTheme.accent3 }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Column: AI Critical Challenges or Standard Placeholder */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {aiInsights ? (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: '800', color: activeTheme.accent2, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Sparkles size={14} /> AI CRITICAL CHALLENGES (จุดวิกฤตคอขวด)
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {aiInsights.keyChallenges.map((item, keyIdx) => (
                              <div key={keyIdx} style={{ padding: '12px 16px', background: activeTheme.accent2Light, borderLeft: `3px solid ${activeTheme.accent2}`, border: activeTheme.borderThin }}>
                                <div style={{ fontSize: '14px', fontWeight: '800', color: activeTheme.accent2, marginBottom: '4px' }}>
                                  {keyIdx + 1}. {item.title}
                                </div>
                                <div style={{ fontSize: '12px', color: activeTheme.textMain, lineHeight: 1.5 }}>
                                  {item.description}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '24px', background: activeTheme.accent1Light, border: activeTheme.borderThin, textAlign: 'center', color: activeTheme.textMuted }}>
                          <Bot size={40} style={{ opacity: 0.3, marginBottom: '12px' }} />
                          <h4 style={{ fontSize: '14px', fontWeight: '800', color: activeTheme.textMain }}>ไม่มีข้อมูลการวิเคราะห์ความท้าทายด้วย AI</h4>
                          <p style={{ fontSize: '12px', marginTop: '6px', maxWidth: '300px' }}>
                            เปิดลิ้นชักการตั้งค่าและกด "วิเคราะห์ข้อมูลด้วย Gemini" เพื่อแสดงข้อมูลสรุปคอขวดที่นี่
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 
                  Slide 3: AI Strategic Action Plan (RENDER ONLY IF HAS AI)
                */}
                {hasAI && aiInsights && (
                  <div 
                    className="pdf-slide-page" 
                    style={{ 
                      display: currentSlideIndex === 2 ? 'flex' : 'none', 
                      width: '100%', height: '100%', padding: '50px 60px', flexDirection: 'column',
                      background: activeTheme.bg
                    }}
                  >
                    <div style={{ borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                      <div>
                        <div style={{ color: activeTheme.accent1, fontSize: '11px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>Strategic Operations</div>
                        <h2 style={{ fontSize: '30px', fontWeight: '800', color: activeTheme.textMain, letterSpacing: '-0.5px', margin: 0 }}>AI-Recommended Action Plan</h2>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: activeTheme.accent1Light, border: activeTheme.borderThin, padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', color: activeTheme.accent1 }}>
                        <CheckCircle2 size={12} /> แผนงานแนะนำประจำสัปดาห์
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', flex: 1 }}>
                      {aiInsights.actionItems.map((item, actionIdx) => (
                        <div key={actionIdx} style={{ display: 'flex', flexDirection: 'column', background: activeTheme.cardBg, border: activeTheme.borderThin, padding: '20px', boxShadow: activeTheme.shadow, position: 'relative' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: activeTheme.accent1, background: activeTheme.accent1Light, padding: '3px 8px', borderRadius: '2px' }}>
                              STEP {actionIdx + 1}
                            </span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: activeTheme.accent2 }}>
                              📅 {item.targetDate}
                            </span>
                          </div>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: activeTheme.textMain, lineHeight: 1.5, marginBottom: 'auto' }}>
                            {item.action}
                          </p>
                          <div style={{ borderTop: activeTheme.headerBorder, paddingTop: '10px', marginTop: '16px', fontSize: '11px', color: activeTheme.textMuted }}>
                            <span style={{ fontWeight: '800', color: activeTheme.textMain }}>ผู้รับผิดชอบ: </span> {item.owner}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 
                  Slides 4-13 (Dynamic): Top Hospitals Deep Dive
                */}
                {data.topHospitals.map((hospital, index) => {
                  const slideNum = index + 2 + (hasAI ? 1 : 0); // adjust dynamic offset
                  const isActive = currentSlideIndex === slideNum;
                  
                  const customInsight = aiInsights?.hospitalInsights?.[hospital.name];
                  
                  return (
                    <div 
                      key={`h-${index}`}
                      className="pdf-slide-page" 
                      style={{ 
                        display: isActive ? 'flex' : 'none', 
                        width: '100%', height: '100%', padding: '50px 60px', flexDirection: 'column',
                        background: activeTheme.bg
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '20px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <div style={{ background: activeTheme.accent2, color: activeTheme.bg, fontSize: '10px', fontWeight: '900', padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Rank #{String(index + 1).padStart(2, '0')}
                            </div>
                            <div style={{ color: activeTheme.textMuted, fontSize: '11px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              Hospital Operational Detail
                            </div>
                          </div>
                          <h2 style={{ fontSize: '26px', fontWeight: '800', color: activeTheme.textMain, letterSpacing: '-0.5px', margin: 0, maxWidth: '650px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hospital.name}
                          </h2>
                        </div>
                        <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: activeTheme.textMain, lineHeight: 1 }}>{hospital.totalTickets}</div>
                            <div style={{ fontSize: '10px', color: activeTheme.textMuted, textTransform: 'uppercase', fontWeight: '700', marginTop: '4px' }}>Tickets</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '28px', fontWeight: '900', color: activeTheme.accent1, lineHeight: 1, textShadow: activeTheme.glowText }}>{hospital.resolvedTickets}</div>
                            <div style={{ fontSize: '10px', color: activeTheme.accent1, textTransform: 'uppercase', fontWeight: '700', marginTop: '4px' }}>Resolved</div>
                          </div>
                        </div>
                      </div>

                      {/* Content Table */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ border: activeTheme.borderThin, background: activeTheme.cardBg, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                              <tr style={{ background: activeTheme.tableHeaderBg, color: activeTheme.textMuted, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '1px', borderBottom: activeTheme.headerBorder }}>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700', width: '100px' }}>Date</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700' }}>Subject</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700', width: '150px' }}>Category</th>
                                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '700', width: '100px' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hospital.tickets.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ padding: '16px', textAlign: 'center', color: activeTheme.textMuted }}>ไม่มีข้อมูลตั๋วในสัปดาห์นี้</td>
                                </tr>
                              ) : (
                                hospital.tickets.slice(0, 4).map((t, tIdx) => {
                                  const isResolved = t.status === 'Resolved' || t.status === 'Closed';
                                  return (
                                    <tr key={tIdx} style={{ borderTop: activeTheme.borderThin }}>
                                      <td style={{ padding: '10px 16px', color: activeTheme.textMuted }}>
                                        {new Date(t.created_at).toLocaleDateString('en-GB')}
                                      </td>
                                      <td style={{ padding: '10px 16px', color: activeTheme.textMain, fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
                                        {t.subject}
                                      </td>
                                      <td style={{ padding: '10px 16px', color: activeTheme.textMain }}>
                                        {t.issue_type}
                                      </td>
                                      <td style={{ padding: '10px 16px' }}>
                                        {isResolved ? (
                                          <span style={{ color: activeTheme.accent1, background: activeTheme.accent1Light, padding: '2px 6px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Resolved</span>
                                        ) : t.status === 'In Progress' ? (
                                          <span style={{ color: activeTheme.accent3, background: activeTheme.accent3Light, padding: '2px 6px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>In Progress</span>
                                        ) : (
                                          <span style={{ color: activeTheme.accent2, background: activeTheme.accent2Light, padding: '2px 6px', fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>New</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Asymmetric / Dynamic Analyst Box */}
                        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                          <div style={{ padding: '12px 16px', background: activeTheme.accent1Light, border: activeTheme.borderThin, borderLeft: `4px solid ${customInsight ? activeTheme.accent1 : activeTheme.accent2}` }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', color: customInsight ? activeTheme.accent1 : activeTheme.accent2, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Bot size={14} /> {customInsight ? 'AI ANALYST INSIGHT & RECOMMENDATION' : 'WEEKLY LOCAL NOTES'}
                            </div>
                            <p style={{ fontSize: '12px', color: activeTheme.textMain, lineHeight: 1.5, margin: 0 }}>
                              {customInsight || `โรงพยาบาล ${hospital.name} มีปริมาณงานสะสมรวม ${hospital.totalTickets} เคสในรอบสัปดาห์ ควรติดตามการอัปเกรดความเสถียรและประสานงานสุ่มตรวจสอบข้อมูลการทำงานของตั๋วอย่างใกล้ชิด`}
                            </p>
                          </div>
                        </div>

                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          </>
        )}
      </div>

      {/* Right sliding Drawer Background Overlay */}
      {isDrawerOpen && (
        <div 
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 999,
            backdropFilter: 'blur(4px)',
            transition: 'opacity 0.3s ease'
          }}
        />
      )}

      {/* Settings Drawer Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          background: 'rgba(15, 23, 42, 0.92)',
          backdropFilter: 'blur(20px)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          padding: '30px',
          color: '#f8fafc',
          overflowY: 'auto'
        }}
      >
        {/* Drawer Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={20} color="#10b981" />
            <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.3px' }}>ตั้งค่ารายงาน & AI</span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', padding: '4px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
          
          {/* Section 1: Date Range */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>
              ช่วงเวลารายงาน (Date Period)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>เริ่มวันที่ (Start Date)</span>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '10px', color: '#f8fafc', outline: 'none', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>สิ้นสุดวันที่ (End Date)</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '10px', color: '#f8fafc', outline: 'none', fontSize: '13px' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontSize: '11px', fontWeight: '750', background: 'rgba(16, 185, 129, 0.06)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={14} />}
              <span>{loading ? 'กำลังดึงข้อมูลสถิติใหม่...' : '✓ อัปเดตข้อมูลสถิติอัตโนมัติเรียบร้อยแล้ว'}</span>
            </div>
          </div>

          {/* Section 2: Visual Style Templates Selection */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={14} /> เลือกดีไซน์เทมเพลต (Themes)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {(['dark-executive', 'cyber-neon', 'brutalist-steel', 'minimalist-light'] as TemplateName[]).map((themeName) => {
                const isSelected = selectedTemplate === themeName;
                return (
                  <button
                    key={themeName}
                    onClick={() => setSelectedTemplate(themeName)}
                    style={{
                      padding: '12px 8px',
                      borderRadius: '4px',
                      background: isSelected ? 'rgba(16, 185, 129, 0.12)' : '#1e293b',
                      border: isSelected ? '2px solid #10b981' : '1px solid #334155',
                      color: isSelected ? '#10b981' : '#cbd5e1',
                      cursor: 'pointer',
                      fontSize: '11px',
                      fontWeight: '700',
                      textAlign: 'center',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      transition: 'all 0.2s'
                    }}
                  >
                    {themeName.replace('-', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Gemini AI Prompt Setup */}
          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
            <label style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={14} /> ปลุกพลังการวิเคราะห์ด้วย AI (Gemini)
            </label>
            


            {/* Presets Prompt Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
              <span style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}>รูปแบบบทวิเคราะห์สำเร็จรูป (AI Presets)</span>
              <select
                value={selectedPresetId}
                onChange={(e) => {
                  setSelectedPresetId(e.target.value);
                  const preset = PRESET_PROMPTS.find(p => p.id === e.target.value);
                  if (preset) setCustomPrompt(preset.prompt);
                }}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '10px', color: '#f8fafc', outline: 'none', fontSize: '13px', cursor: 'pointer' }}
              >
                {PRESET_PROMPTS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Custom Prompt Text Area */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>ปรับแต่ง Prompt เพิ่มเติมตามต้องการ</span>
                <span style={{ fontSize: '9px', color: '#10b981' }}>CUSTOMIZABLE</span>
              </div>
              <textarea
                placeholder="ป้อนคำสั่ง Prompt ของคุณที่นี่ หรือแก้ไข Preset ด้านบน..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '4px', padding: '12px 14px', color: '#f8fafc', outline: 'none', fontSize: '12px', resize: 'none', fontFamily: 'inherit', height: '240px', lineHeight: '1.6' }}
              />
            </div>

            <button
              onClick={handleGenerateAIInsights}
              disabled={aiLoading || !data}
              className="glass-interactive"
              style={{
                width: '100%',
                height: '42px',
                borderRadius: '4px',
                border: 'none',
                background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                color: '#0f172a',
                fontWeight: '900',
                fontSize: '13px',
                cursor: (aiLoading || !data) ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)',
                textShadow: '0 0 1px rgba(255,255,255,0.2)'
              }}
            >
              {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {aiLoading ? 'กำลังส่งไปให้ AI ประมวลผล...' : 'วิเคราะห์ข้อมูลด้วย Gemini'}
            </button>
          </div>



        </div>
      </div>

    </div>
  );
}
