'use client';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Calendar, 
  Presentation,
  Loader2
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';

let html2CanvasPromise: Promise<(typeof import('html2canvas'))['default']> | null = null;
let jsPdfPromise: Promise<(typeof import('jspdf'))['jsPDF']> | null = null;

async function loadExportModules() {
  if (!html2CanvasPromise) {
    html2CanvasPromise = import('html2canvas').then((m) => m.default);
  }
  if (!jsPdfPromise) {
    jsPdfPromise = import('jspdf').then((m) => m.jsPDF);
  }
  const [html2canvas, jsPDF] = await Promise.all([html2CanvasPromise, jsPdfPromise]);
  return { html2canvas, jsPDF };
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

export default function PresentationPage() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<PresentationData | null>(null);
  
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
  const presentationRef = useRef<HTMLDivElement>(null);
  const { addToast } = useNotificationContext();

  const fetchPresentationData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/presentation?start=${dateRange.start}&end=${dateRange.end}`);
      if (!res.ok) throw new Error('Failed to fetch presentation data');
      const payload = await res.json();
      setData(payload);
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!data) return;
      const totalSlides = 2 + (data?.topHospitals?.length || 0);
      if (e.key === 'ArrowRight') {
        setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentSlideIndex((prev) => Math.max(prev - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [data]);

  const handleExportPDF = async () => {
    if (!data || !presentationRef.current) return;
    setExporting(true);
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
        
        // Temporarily force display block for capturing
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
          backgroundColor: '#0f172a',
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

  const totalSlides = data ? 2 + (data.topHospitals?.length || 0) : 0;

  return (
    <div className="animate-page-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
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
                สร้างสไลด์รายงานสรุปผลการดำเนินการประจำสัปดาห์
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '44px', background: 'var(--bg-input)', borderRadius: '4px', border: '1px solid var(--border)' }}>
            <Calendar size={16} color="var(--primary)" />
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: '600', fontSize: '13px', outline: 'none' }}
            />
            <span style={{ color: 'var(--text-muted)' }}>-</span>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              style={{ background: 'none', border: 'none', color: 'var(--text-main)', fontWeight: '600', fontSize: '13px', outline: 'none' }}
            />
          </div>

          <button
            onClick={fetchPresentationData}
            disabled={loading}
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
              gap: '8px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Generate Presentation'}
          </button>

          <button
            onClick={handleExportPDF}
            disabled={exporting || !data}
            className="glass-interactive"
            style={{
              height: '44px',
              padding: '0 20px',
              borderRadius: '4px',
              border: 'none',
              background: '#10b981',
              color: '#0f172a',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
              cursor: (exporting || !data) ? 'not-allowed' : 'pointer'
            }}
          >
            {exporting ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
            Export PDF (16:9)
          </button>
        </div>
      </div>

      {/* Presentation Viewer Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0a0f1c', borderRadius: '4px', border: '1px solid #1e293b', position: 'relative', overflow: 'hidden' }}>
        
        {!data && !loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#64748b' }}>
            <Presentation size={64} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>No Data Loaded</h2>
            <p style={{ fontSize: '13px', marginTop: '8px' }}>Select a date range and click Generate Presentation</p>
          </div>
        )}

        {loading && (
          <div style={{ margin: 'auto', textAlign: 'center', color: '#10b981' }}>
            <Loader2 size={40} className="animate-spin" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '1px' }}>PROCESSING INTEL...</h2>
          </div>
        )}

        {data && (
          <>
            {/* Navigation Overlays */}
            <button 
              onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
              disabled={currentSlideIndex === 0}
              style={{ position: 'absolute', left: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: '#0f172a80', border: '1px solid #1e293b', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer', opacity: currentSlideIndex === 0 ? 0.3 : 1, backdropFilter: 'blur(4px)' }}
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, totalSlides - 1))}
              disabled={currentSlideIndex === totalSlides - 1}
              style={{ position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)', zIndex: 10, background: '#0f172a80', border: '1px solid #1e293b', color: 'white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlideIndex === totalSlides - 1 ? 'not-allowed' : 'pointer', opacity: currentSlideIndex === totalSlides - 1 ? 0.3 : 1, backdropFilter: 'blur(4px)' }}
            >
              <ChevronRight size={24} />
            </button>

            <div style={{ position: 'absolute', bottom: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10, background: '#0f172aCC', border: '1px solid #1e293b', padding: '6px 16px', borderRadius: '24px', fontSize: '12px', fontWeight: '700', color: '#94a3b8', backdropFilter: 'blur(4px)' }}>
              SLIDE <span style={{ color: '#f8fafc' }}>{currentSlideIndex + 1}</span> / {totalSlides}
            </div>

            {/* Scale Container to fit viewport but maintain 16:9 ratio */}
            <div style={{ flex: 1, padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              <div 
                ref={presentationRef}
                style={{ 
                  width: '100%', 
                  maxWidth: '1280px', 
                  aspectRatio: '16/9', 
                  position: 'relative', 
                  background: '#0f172a',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                  border: '1px solid #1e293b',
                  overflow: 'hidden'
                }}
              >
                {/* 
                  Slide 1: Executive Cover 
                */}
                <div 
                  className="pdf-slide-page" 
                  style={{ 
                    display: currentSlideIndex === 0 ? 'flex' : 'none', 
                    width: '100%', height: '100%', padding: '60px', flexDirection: 'column',
                    background: 'radial-gradient(circle at top right, #10b98115, #0f172a 40%)'
                  }}
                >
                  <div style={{ color: '#10b981', fontSize: '14px', fontWeight: '800', letterSpacing: '4px', textTransform: 'uppercase', marginBottom: '16px' }}>
                    Neo Support Line OA
                  </div>
                  <h1 style={{ fontSize: '48px', fontWeight: '900', color: '#f8fafc', letterSpacing: '-1px', lineHeight: 1.1, maxWidth: '800px', marginBottom: '24px' }}>
                    WEEKLY SERVICE INTELLIGENCE REPORT
                  </h1>
                  <div style={{ fontSize: '18px', color: '#94a3b8', fontWeight: '500', marginBottom: 'auto' }}>
                    Reporting Period: {data.dateRange.start} to {data.dateRange.end}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.5fr', gap: '24px', marginTop: '60px' }}>
                    <div style={{ borderLeft: '2px solid #1e293b', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Total Volume</div>
                      <div style={{ fontSize: '72px', fontWeight: '900', color: '#f8fafc', lineHeight: 1, letterSpacing: '-2px' }}>
                        {data.summary.totalTickets}
                      </div>
                    </div>
                    <div style={{ borderLeft: '2px solid #10b981', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '12px', color: '#10b981', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Resolution Rate</div>
                      <div style={{ fontSize: '72px', fontWeight: '900', color: '#10b981', lineHeight: 1, letterSpacing: '-2px' }}>
                        {data.summary.resolvedRate}%
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>{data.summary.resolvedTickets} tickets closed</div>
                    </div>
                    <div style={{ borderLeft: '2px solid #f59e0b', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '12px', color: '#f59e0b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Highest Volume Hospital</div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#f8fafc', lineHeight: 1.2, wordBreak: 'break-word' }}>
                        {data.summary.topHospital.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '12px', fontWeight: '600' }}>{data.summary.topHospital.count} tickets reported</div>
                    </div>
                    <div style={{ borderLeft: '2px solid #0ea5e9', paddingLeft: '24px' }}>
                      <div style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Dominant Challenge</div>
                      <div style={{ fontSize: '28px', fontWeight: '800', color: '#f8fafc', lineHeight: 1.2, wordBreak: 'break-word' }}>
                        {data.summary.topCategory.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '12px', fontWeight: '600' }}>{data.summary.topCategory.count} instances recorded</div>
                    </div>
                  </div>
                </div>

                {/* 
                  Slide 2: Category Landscape 
                */}
                <div 
                  className="pdf-slide-page" 
                  style={{ 
                    display: currentSlideIndex === 1 ? 'flex' : 'none', 
                    width: '100%', height: '100%', padding: '60px', flexDirection: 'column',
                    background: '#0f172a'
                  }}
                >
                  <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '24px', marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: '#0ea5e9', fontSize: '12px', fontWeight: '800', letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '8px' }}>Analysis</div>
                      <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.5px', margin: 0 }}>Issue Category Distribution</h2>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: '#f8fafc' }}>{data.categories.length}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700' }}>Unique Categories</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', flex: 1 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {data.categories.slice(0, 8).map((cat, idx) => {
                        const maxCount = Math.max(...data.categories.map(c => c.count));
                        const widthPct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
                        return (
                          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '20px', fontSize: '12px', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>
                              {String(idx + 1).padStart(2, '0')}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{cat.name}</span>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#0ea5e9' }}>{cat.count}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '0px' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: '#0ea5e9' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {data.categories.slice(8, 16).map((cat, idx) => {
                        const maxCount = Math.max(...data.categories.map(c => c.count));
                        const widthPct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
                        return (
                          <div key={idx + 8} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '20px', fontSize: '12px', fontWeight: '800', color: '#64748b', textAlign: 'right' }}>
                              {String(idx + 9).padStart(2, '0')}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                <span style={{ fontSize: '14px', fontWeight: '700', color: '#e2e8f0' }}>{cat.name}</span>
                                <span style={{ fontSize: '14px', fontWeight: '800', color: '#64748b' }}>{cat.count}</span>
                              </div>
                              <div style={{ width: '100%', height: '6px', background: '#1e293b', borderRadius: '0px' }}>
                                <div style={{ width: `${widthPct}%`, height: '100%', background: '#475569' }} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 
                  Slides 3-12: Top Hospitals Deep Dive
                */}
                {data.topHospitals.map((hospital, index) => {
                  const slideNum = index + 2; // offset by 2 covers
                  const isActive = currentSlideIndex === slideNum;
                  
                  return (
                    <div 
                      key={`h-${index}`}
                      className="pdf-slide-page" 
                      style={{ 
                        display: isActive ? 'flex' : 'none', 
                        width: '100%', height: '100%', padding: '60px', flexDirection: 'column',
                        background: '#0f172a'
                      }}
                    >
                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '24px', marginBottom: '32px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ background: '#f59e0b', color: '#0f172a', fontSize: '12px', fontWeight: '900', padding: '4px 10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                              Rank #{String(index + 1).padStart(2, '0')}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}>
                              Hospital Deep Dive
                            </div>
                          </div>
                          <h2 style={{ fontSize: '32px', fontWeight: '800', color: '#f8fafc', letterSpacing: '-0.5px', margin: 0, maxWidth: '800px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {hospital.name}
                          </h2>
                        </div>
                        <div style={{ display: 'flex', gap: '32px', textAlign: 'right' }}>
                          <div>
                            <div style={{ fontSize: '36px', fontWeight: '900', color: '#f8fafc', lineHeight: 1 }}>{hospital.totalTickets}</div>
                            <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '700', marginTop: '8px' }}>Total Tickets</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '36px', fontWeight: '900', color: '#10b981', lineHeight: 1 }}>{hospital.resolvedTickets}</div>
                            <div style={{ fontSize: '11px', color: '#10b981', textTransform: 'uppercase', fontWeight: '700', marginTop: '8px' }}>Resolved</div>
                          </div>
                        </div>
                      </div>

                      {/* Content Table */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '16px' }}>
                          Latest Activity ({Math.min(hospital.tickets.length, 10)} records)
                        </div>
                        
                        <div style={{ border: '1px solid #1e293b', borderRadius: '0px', overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ background: '#1e293b', color: '#94a3b8', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '1px' }}>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', width: '120px' }}>Date</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700' }}>Subject</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', width: '180px' }}>Category</th>
                                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', width: '120px' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hospital.tickets.length === 0 ? (
                                <tr>
                                  <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>No tickets available.</td>
                                </tr>
                              ) : (
                                hospital.tickets.map((t, tIdx) => {
                                  const isResolved = t.status === 'Resolved' || t.status === 'Closed';
                                  return (
                                    <tr key={tIdx} style={{ borderTop: '1px solid #1e293b' }}>
                                      <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                                        {new Date(t.created_at).toLocaleDateString('en-GB')}
                                      </td>
                                      <td style={{ padding: '14px 16px', color: '#f8fafc', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px' }}>
                                        {t.subject}
                                      </td>
                                      <td style={{ padding: '14px 16px', color: '#e2e8f0' }}>
                                        {t.issue_type}
                                      </td>
                                      <td style={{ padding: '14px 16px' }}>
                                        {isResolved ? (
                                          <span style={{ color: '#10b981', background: '#10b98115', padding: '4px 8px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>✅ Resolved</span>
                                        ) : t.status === 'In Progress' ? (
                                          <span style={{ color: '#0ea5e9', background: '#0ea5e915', padding: '4px 8px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>🔄 In Progress</span>
                                        ) : (
                                          <span style={{ color: '#f59e0b', background: '#f59e0b15', padding: '4px 8px', fontSize: '11px', fontWeight: '700', textTransform: 'uppercase' }}>⏳ {t.status || 'New'}</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
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
    </div>
  );
}
