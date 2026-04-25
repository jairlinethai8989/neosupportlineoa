'use client';
import React, { useState } from 'react';
import { X, FileText, Download, Loader2, CheckCircle2, Info, Printer } from 'lucide-react';

interface SummaryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'xlsx') => Promise<void> | void;
  onPrint?: () => Promise<void> | void;
  ticketNo: string;
}

export default function SummaryExportModal({
  isOpen,
  onClose,
  onExport,
  onPrint,
  ticketNo,
}: SummaryExportModalProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      await onExport('pdf');
      onClose();
    } catch {
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!onPrint) return;
    setLoading(true);
    try {
      await onPrint();
      onClose();
    } catch {
      alert('เกิดข้อผิดพลาดในการสั่งพิมพ์');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
          maxWidth: '460px',
          padding: '32px',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '28px',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
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
            color: 'var(--text-muted)',
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
              background: 'rgba(6, 182, 212, 0.1)',
              color: '#06b6d4',
              borderRadius: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px',
              boxShadow: '0 15px 35px rgba(6, 182, 212, 0.2)',
            }}
          >
            <FileText size={36} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-0.5px', color: 'white' }}>
            ตัวอย่าง Ticket Summary
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: '500' }}>
            ตรวจสอบสรุปรายงานของใบงาน <strong style={{ color: 'var(--primary)' }}>#{ticketNo}</strong> ก่อนเลือกการดำเนินการ
          </p>
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
            <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
              ข้อมูลที่จะแสดง
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                'ข้อมูลลูกค้าและหน่วยงาน',
                'รายละเอียดปัญหา (หัวข้อ/รายละเอียดเพิ่มเติม)',
                'ประวัติการสนทนาและเวลาการดำเนินงาน',
                'สรุปการแก้ไขและสถานะสุดท้าย',
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={14} color="#10b981" />
                  <span style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '500' }}>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
            <Info size={14} color="var(--primary)" />
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '500' }}>
              เลือกได้ทั้งดาวน์โหลดเป็นไฟล์ PDF หรือสั่งพิมพ์ทันที
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
              color: 'var(--text-muted)',
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
              onClick={handlePrint}
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

          <button
            onClick={handleDownload}
            disabled={loading}
            className="glass-interactive"
            style={{
              flex: 2,
              padding: '16px',
              borderRadius: '16px',
              background: 'var(--primary)',
              color: 'black',
              border: 'none',
              fontWeight: '900',
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 10px 25px var(--primary-transparent)',
              opacity: loading ? 0.7 : 1,
              cursor: 'pointer',
            }}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                <Download size={20} />
                ดาวน์โหลด
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
