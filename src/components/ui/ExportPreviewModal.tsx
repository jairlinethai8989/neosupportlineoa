'use client';
import React from 'react';
import { X, FileText, FileSpreadsheet, Loader2, Info, CheckCircle2, Printer } from 'lucide-react';

export interface ExportPreviewData {
  format: 'excel' | 'pdf';
  title: string;
  subtitle?: string;
  totalRecords: number;
  dateRange?: string;
  columns: string[];
}

interface ExportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  onDownload?: () => void;
  onPrint?: () => void;
  data: ExportPreviewData;
  loading?: boolean;
}

export function ExportPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  onDownload,
  onPrint,
  data,
  loading,
}: ExportPreviewModalProps) {
  if (!isOpen) return null;
  const modalTitleColor = '#f8fafc';
  const modalTextColor = 'rgba(226, 232, 240, 0.95)';
  const modalMutedColor = 'rgba(148, 163, 184, 0.95)';
  const modalDimColor = 'rgba(148, 163, 184, 0.82)';

  const isExcel = data.format === 'excel';
  const handleDownload = onDownload || onConfirm;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(10, 14, 20, 0.85)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '500px',
          padding: '32px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '28px',
          background: 'linear-gradient(180deg, var(--bg-sidebar, #141b27) 0%, var(--bg-deep, #0a0e14) 100%)',
        }}
      >
        <button
          onClick={onClose}
          className="glass-interactive"
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: modalMutedColor,
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              background: isExcel ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              color: isExcel ? '#10b981' : '#ef4444',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: `0 15px 35px ${
                isExcel ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'
              }`,
            }}
          >
            {isExcel ? <FileSpreadsheet size={36} /> : <FileText size={36} />}
          </div>
          <h2
            style={{
              fontSize: '24px',
              fontWeight: '900',
              marginBottom: '8px',
              letterSpacing: '-0.5px',
              color: modalTitleColor,
            }}
          >
            ยืนยันการส่งออกข้อมูล
          </h2>
          <p style={{ fontSize: '14px', color: modalMutedColor, fontWeight: '500' }}>
            {data.title}
          </p>
          {data.subtitle && (
            <p style={{ fontSize: '12px', color: modalDimColor, fontWeight: '500', marginTop: '4px' }}>
              {data.subtitle}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              borderRadius: '20px',
              padding: '20px',
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: modalMutedColor, fontWeight: '700', textTransform: 'uppercase' }}>
                Format
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: isExcel ? '#10b981' : '#ef4444' }}>
                {data.format.toUpperCase()}
              </span>
            </div>

            {data.dateRange && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: modalMutedColor, fontWeight: '700', textTransform: 'uppercase' }}>
                  Period
                </span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: modalTextColor }}>{data.dateRange}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: modalMutedColor, fontWeight: '700', textTransform: 'uppercase' }}>
                Records
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--primary)' }}>
                {data.totalRecords.toLocaleString()} รายการ
              </span>
            </div>

            <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '10px', color: modalDimColor, fontWeight: '800', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                คอลัมน์ ({data.columns.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {data.columns.slice(0, 8).map((col, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: '10px',
                      padding: '4px 10px',
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '6px',
                      color: modalTextColor,
                      border: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    {col}
                  </span>
                ))}
                {data.columns.length > 8 && (
                  <span style={{ fontSize: '10px', padding: '4px 10px', color: 'var(--primary)', fontWeight: '700' }}>
                    + อีก {data.columns.length - 8} คอลัมน์
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <Info size={14} color="var(--primary)" />
            <p style={{ fontSize: '11px', color: modalMutedColor, fontWeight: '500' }}>
              ตรวจสอบข้อมูลในหน้าต่างนี้ก่อน แล้วเลือกดาวน์โหลดหรือสั่งพิมพ์ได้ทันที
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            disabled={loading}
            className="glass-interactive"
            style={{
              flex: 1,
              padding: '16px',
              borderRadius: '16px',
              background: 'rgba(255,255,255,0.03)',
              color: modalTextColor,
              border: '1px solid var(--border)',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer',
            }}
          >
            ยกเลิก
          </button>

          {onPrint && (
            <button
              onClick={onPrint}
              disabled={loading}
              className="glass-interactive"
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '16px',
                background: 'rgba(54, 153, 255, 0.12)',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                fontWeight: '900',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <Printer size={18} />
              พิมพ์
            </button>
          )}

          {handleDownload && (
            <button
              onClick={handleDownload}
              disabled={loading}
              className="glass-interactive"
              style={{
                flex: 2,
                padding: '16px',
                borderRadius: '16px',
                background: isExcel ? '#10b981' : '#ef4444',
                color: 'white',
                border: 'none',
                fontWeight: '900',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                boxShadow: isExcel
                  ? '0 10px 25px rgba(16, 185, 129, 0.25)'
                  : '0 10px 25px rgba(239, 68, 68, 0.25)',
                opacity: loading ? 0.7 : 1,
                cursor: 'pointer',
              }}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  ดาวน์โหลด
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
