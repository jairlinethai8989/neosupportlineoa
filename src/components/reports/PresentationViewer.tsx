import React from 'react';
import { ChevronLeft, ChevronRight, Bot, Sparkles, CheckCircle2 } from 'lucide-react';

type PresentationViewerProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiInsights: any;
  currentSlideIndex: number;
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  activeTheme: any;
  presentationRef: React.RefObject<HTMLDivElement | null>;
};

export default function PresentationViewer({
  data,
  aiInsights,
  currentSlideIndex,
  setCurrentSlideIndex,
  activeTheme,
  presentationRef,
}: PresentationViewerProps) {
  const hasAI = !!aiInsights;
  const totalSlides = data ? 2 + (hasAI ? 1 : 0) + (data.topOrganizations?.length || 0) : 0;

  return (
    <>
      <button
        type="button"
        aria-label="สไลด์ก่อนหน้า"
        onClick={() => setCurrentSlideIndex((prev) => Math.max(prev - 1, 0))}
        disabled={currentSlideIndex === 0}
        style={{
          position: 'absolute',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #33455e',
          color: '#ffffff',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: currentSlideIndex === 0 ? 'not-allowed' : 'pointer',
          opacity: currentSlideIndex === 0 ? 0.35 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label="สไลด์ถัดไป"
        onClick={() => setCurrentSlideIndex((prev) => Math.min(prev + 1, totalSlides - 1))}
        disabled={currentSlideIndex === totalSlides - 1}
        style={{
          position: 'absolute',
          right: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid #33455e',
          color: '#ffffff',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: currentSlideIndex === totalSlides - 1 ? 'not-allowed' : 'pointer',
          opacity: currentSlideIndex === totalSlides - 1 ? 0.35 : 1,
          transition: 'opacity 150ms ease',
        }}
      >
        <ChevronRight size={22} aria-hidden="true" />
      </button>

      <div
        className="tabular-nums"
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          background: 'rgba(15, 23, 42, 0.9)',
          border: '1px solid #33455e',
          padding: '6px 14px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: 700,
          color: '#94a3b8',
        }}
      >
        SLIDE <span style={{ color: '#f8fafc' }}>{currentSlideIndex + 1}</span> / {totalSlides}
        {hasAI ? <span style={{ marginLeft: '8px', color: '#10b981', fontSize: '11px' }}>• AI POPULATED</span> : null}
      </div>

      <div style={{ flex: 1, padding: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
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
          }}
        >
          {/* Slide 1: Executive Cover Slide */}
          <div
            className="pdf-slide-page"
            style={{
              display: currentSlideIndex === 0 ? 'flex' : 'none',
              width: '100%',
              height: '100%',
              padding: '48px 56px',
              flexDirection: 'column',
              background: activeTheme.gradientBg,
            }}
          >
            <div
              style={{
                color: activeTheme.accent1,
                fontSize: '13px',
                fontWeight: 700,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                marginBottom: '14px',
              }}
            >
              Neo Support Line OA
            </div>
            <h2
              style={{
                fontSize: '40px',
                fontWeight: 800,
                color: activeTheme.textMain,
                letterSpacing: '-1px',
                lineHeight: 1.15,
                maxWidth: '900px',
                marginBottom: '20px',
              }}
            >
              WEEKLY SERVICE INTELLIGENCE REPORT
            </h2>

            <div
              style={{
                fontSize: '15px',
                color: activeTheme.textMuted,
                fontWeight: 500,
                lineHeight: 1.6,
                maxWidth: '980px',
                padding: '16px 20px',
                background: activeTheme.accent1Light,
                borderLeft: `4px solid ${activeTheme.accent1}`,
                marginBottom: 'auto',
              }}
            >
              {aiInsights ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginBottom: '6px',
                      color: activeTheme.accent1,
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '1px',
                    }}
                  >
                    <Bot size={14} aria-hidden="true" /> AI EXECUTIVE SUMMARY
                  </div>
                  {aiInsights.executiveSummary}
                </div>
              ) : (
                `สัปดาห์วันที่ ${data.dateRange.start} ถึง ${data.dateRange.end} - ระบบได้ทำการจัดทำสถิติรายงานรอบสัปดาห์ดึงข้อมูลตั๋วงาน ปัญหาคอขวดหลัก และการให้บริการรายองค์กร/บริษัท เพื่อใช้สำหรับประชุมปรับปรุงประสิทธิภาพและวิเคราะห์ความเสถียรของหน้างานตามเกณฑ์มาตรฐาน SLA`
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr', gap: '20px', marginTop: '30px' }}>
              <div style={{ borderLeft: `2px solid ${activeTheme.textMuted}`, paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Total Volume
                </div>
                <div className="tabular-nums" style={{ fontSize: '52px', fontWeight: 800, color: activeTheme.textMain, lineHeight: 1 }}>
                  {data.summary.totalTickets}
                </div>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>เคสทั้งหมดสะสม</div>
              </div>
              <div style={{ borderLeft: `2px solid ${activeTheme.accent1}`, paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', color: activeTheme.accent1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Resolution Rate
                </div>
                <div className="tabular-nums" style={{ fontSize: '52px', fontWeight: 800, color: activeTheme.accent1, lineHeight: 1 }}>
                  {data.summary.resolvedRate}%
                </div>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>ปิดงานสำเร็จ {data.summary.resolvedTickets} เคส</div>
              </div>
              <div style={{ borderLeft: `2px solid ${activeTheme.accent2}`, paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', color: activeTheme.accent2, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Top Organization
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: activeTheme.textMain,
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {data.summary.topHospital.name}
                </div>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>รายงานสูงสุด {data.summary.topHospital.count} เคส</div>
              </div>
              <div style={{ borderLeft: `2px solid ${activeTheme.accent3}`, paddingLeft: '20px' }}>
                <div style={{ fontSize: '11px', color: activeTheme.accent3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>
                  Dominant Challenge
                </div>
                <div
                  style={{
                    fontSize: '22px',
                    fontWeight: 700,
                    color: activeTheme.textMain,
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {data.summary.topCategory.name}
                </div>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, marginTop: '4px' }}>พบข้อขัดข้อง {data.summary.topCategory.count} ครั้ง</div>
              </div>
            </div>
          </div>

          {/* Slide 2: Category Landscape & Key Challenges */}
          <div
            className="pdf-slide-page"
            style={{
              display: currentSlideIndex === 1 ? 'flex' : 'none',
              width: '100%',
              height: '100%',
              padding: '48px 56px',
              flexDirection: 'column',
              background: activeTheme.bg,
            }}
          >
            <div style={{ borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <div style={{ color: activeTheme.accent3, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Operational Analysis
                </div>
                <h2 style={{ fontSize: '28px', fontWeight: 800, color: activeTheme.textMain, margin: 0 }}>
                  Issue Category & Challenges
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tabular-nums" style={{ fontSize: '22px', fontWeight: 800, color: activeTheme.accent3 }}>
                  {data.categories.length}
                </div>
                <div style={{ fontSize: '11px', color: activeTheme.textMuted, textTransform: 'uppercase', fontWeight: 600 }}>
                  Unique Categories
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '40px', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: activeTheme.textMuted, marginBottom: '4px' }}>
                  หมวดหมู่ปัญหาแยกตามสถิติความถี่
                </div>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {data.categories.slice(0, 7).map((cat: any, idx: number) => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const maxCount = Math.max(...data.categories.map((c: any) => c.count), 1);
                  const widthPct = (cat.count / maxCount) * 100;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="tabular-nums" style={{ width: '24px', fontSize: '12px', fontWeight: 700, color: activeTheme.textMuted, textAlign: 'right' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: activeTheme.textMain }}>{cat.name}</span>
                          <span className="tabular-nums" style={{ fontSize: '13px', fontWeight: 700, color: activeTheme.accent3 }}>
                            {cat.count}
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: activeTheme.accent1Light }}>
                          <div style={{ width: `${widthPct}%`, height: '100%', background: activeTheme.accent3 }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {aiInsights ? (
                  <>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: activeTheme.accent2, textTransform: 'uppercase', letterSpacing: '1px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={14} aria-hidden="true" /> AI CRITICAL CHALLENGES
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {aiInsights.keyChallenges.map((item: any, keyIdx: number) => (
                        <div key={keyIdx} style={{ padding: '12px 16px', background: activeTheme.accent2Light, border: activeTheme.borderThin, borderLeft: `3px solid ${activeTheme.accent2}` }}>
                          <div style={{ fontSize: '14px', fontWeight: 700, color: activeTheme.accent2, marginBottom: '4px' }}>
                            {keyIdx + 1}. {item.title}
                          </div>
                          <div style={{ fontSize: '12px', color: activeTheme.textMain, lineHeight: 1.5 }}>{item.description}</div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', flex: 1, padding: '24px', background: activeTheme.accent1Light, border: activeTheme.borderThin, textAlign: 'center', color: activeTheme.textMuted }}>
                    <Bot size={36} style={{ opacity: 0.4, marginBottom: '12px' }} aria-hidden="true" />
                    <h3 style={{ fontSize: '14px', fontWeight: 700, color: activeTheme.textMain }}>
                      ไม่มีข้อมูลการวิเคราะห์ความท้าทายด้วย AI
                    </h3>
                    <p style={{ fontSize: '12px', marginTop: '6px', maxWidth: '300px' }}>
                      เปิดเมนูตั้งค่าและกด &quot;วิเคราะห์ข้อมูลด้วย Gemini&quot; เพื่อแสดงข้อมูลสรุปคอขวดที่นี่
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Slide 3: AI Strategic Action Plan */}
          {hasAI && aiInsights ? (
            <div
              className="pdf-slide-page"
              style={{
                display: currentSlideIndex === 2 ? 'flex' : 'none',
                width: '100%',
                height: '100%',
                padding: '48px 56px',
                flexDirection: 'column',
                background: activeTheme.bg,
              }}
            >
              <div style={{ borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <div style={{ color: activeTheme.accent1, fontSize: '11px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '4px' }}>
                    Strategic Operations
                  </div>
                  <h2 style={{ fontSize: '28px', fontWeight: 800, color: activeTheme.textMain, margin: 0 }}>
                    AI-Recommended Action Plan
                  </h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: activeTheme.accent1Light, border: activeTheme.borderThin, padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 700, color: activeTheme.accent1 }}>
                  <CheckCircle2 size={12} aria-hidden="true" /> แผนงานแนะนำประจำสัปดาห์
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', flex: 1 }}>
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {aiInsights.actionItems.map((item: any, actionIdx: number) => (
                  <div key={actionIdx} style={{ display: 'flex', flexDirection: 'column', background: activeTheme.cardBg, border: activeTheme.borderThin, padding: '20px', boxShadow: activeTheme.shadow }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: activeTheme.accent1, background: activeTheme.accent1Light, padding: '3px 8px', borderRadius: '4px' }}>
                        STEP {actionIdx + 1}
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: activeTheme.accent2 }}>{item.targetDate}</span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: activeTheme.textMain, lineHeight: 1.5, marginBottom: 'auto' }}>
                      {item.action}
                    </p>
                    <div style={{ borderTop: activeTheme.headerBorder, paddingTop: '10px', marginTop: '16px', fontSize: '11px', color: activeTheme.textMuted }}>
                      <strong style={{ color: activeTheme.textMain }}>ผู้รับผิดชอบ:</strong> {item.owner}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Slides 4+: Top Organizations */}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {data.topOrganizations.map((organization: any, index: number) => {
            const slideNum = index + 2 + (hasAI ? 1 : 0);
            const isActive = currentSlideIndex === slideNum;
            const customInsight = aiInsights?.hospitalInsights?.[organization.name];

            return (
              <div
                key={`h-${index}`}
                className="pdf-slide-page"
                style={{
                  display: isActive ? 'flex' : 'none',
                  width: '100%',
                  height: '100%',
                  padding: '48px 56px',
                  flexDirection: 'column',
                  background: activeTheme.bg,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: activeTheme.headerBorder, paddingBottom: '16px', marginBottom: '20px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ background: activeTheme.accent2, color: activeTheme.bg, fontSize: '10px', fontWeight: 800, padding: '3px 8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Rank #{String(index + 1).padStart(2, '0')}
                      </div>
                      <div style={{ color: activeTheme.textMuted, fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                        Organization Operational Detail
                      </div>
                    </div>
                    <h2 style={{ fontSize: '24px', fontWeight: 800, color: activeTheme.textMain, margin: 0, maxWidth: '650px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {organization.name}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                    <div>
                      <div className="tabular-nums" style={{ fontSize: '26px', fontWeight: 800, color: activeTheme.textMain, lineHeight: 1 }}>
                        {organization.totalTickets}
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.textMuted, textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>
                        Tickets
                      </div>
                    </div>
                    <div>
                      <div className="tabular-nums" style={{ fontSize: '26px', fontWeight: 800, color: activeTheme.accent1, lineHeight: 1 }}>
                        {organization.resolvedTickets}
                      </div>
                      <div style={{ fontSize: '11px', color: activeTheme.accent1, textTransform: 'uppercase', fontWeight: 600, marginTop: '4px' }}>
                        Resolved
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: activeTheme.textMain, textTransform: 'uppercase', marginBottom: '12px', paddingBottom: '8px', borderBottom: activeTheme.borderThin }}>
                      Recent Case History
                    </div>
                    <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {organization.tickets.map((t: any) => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px', background: activeTheme.cardBg, border: activeTheme.borderThin, borderLeft: `3px solid ${t.status === 'Resolved' || t.status === 'Closed' ? activeTheme.accent1 : activeTheme.accent2}` }}>
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: activeTheme.textMain, marginBottom: '4px' }}>{t.subject}</div>
                            <div style={{ fontSize: '11px', color: activeTheme.textMuted }}>{t.issue_type}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: t.status === 'Resolved' || t.status === 'Closed' ? activeTheme.accent1 : activeTheme.accent2, marginBottom: '4px' }}>
                              {t.status}
                            </div>
                            <div className="tabular-nums" style={{ fontSize: '11px', color: activeTheme.textMuted }}>
                              {new Date(t.created_at).toLocaleDateString('th-TH')}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ background: activeTheme.cardBg, border: activeTheme.borderThin, padding: '16px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: activeTheme.textMuted, textTransform: 'uppercase', marginBottom: '8px' }}>
                        Performance Rating
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                        <span className="tabular-nums" style={{ fontSize: '30px', fontWeight: 800, color: activeTheme.textMain }}>
                          {organization.totalTickets > 0 ? Math.round((organization.resolvedTickets / organization.totalTickets) * 100) : 0}%
                        </span>
                        <span style={{ fontSize: '12px', color: activeTheme.textMuted }}>SLA Success</span>
                      </div>
                      <div style={{ width: '100%', height: '4px', background: activeTheme.accent1Light, marginTop: '12px', borderRadius: '2px' }}>
                        <div
                          style={{
                            width: `${organization.totalTickets > 0 ? (organization.resolvedTickets / organization.totalTickets) * 100 : 0}%`,
                            height: '100%',
                            background: activeTheme.accent1,
                            borderRadius: '2px',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ flex: 1, background: activeTheme.accent2Light, border: activeTheme.borderThin, padding: '16px', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: activeTheme.accent2, textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Bot size={14} aria-hidden="true" /> AI Context
                      </div>
                      <div style={{ fontSize: '13px', color: activeTheme.textMain, lineHeight: 1.6, flex: 1 }}>
                        {customInsight ||
                          (hasAI
                            ? 'ไม่มีข้อมูลเจาะลึกเฉพาะสำหรับองค์กรนี้'
                            : 'ยังไม่ได้วิเคราะห์ข้อมูลด้วย AI เปิดเมนูตั้งค่าและใช้ Gemini เพื่อสร้างบทวิเคราะห์คอขวดของลูกค้ารายนี้')}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
