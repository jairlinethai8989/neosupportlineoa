'use client';
import React, { useState } from 'react';
import { X, FileText, Table, Download, Loader2, AlertCircle } from 'lucide-react';

interface SummaryExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (format: 'pdf' | 'xlsx') => void;
  ticketNo: string;
}

export default function SummaryExportModal({ isOpen, onClose, onExport, ticketNo }: SummaryExportModalProps) {
  const [format, setFormat] = useState<'pdf' | 'xlsx'>('pdf');
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await onExport(format);
      setTimeout(() => {
        setLoading(false);
        onClose();
      }, 1000);
    } catch (err) {
      setLoading(false);
      alert('เกิดข้อผิดพลาดในการส่งออกไฟล์');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="glass" style={{ width: '420px', padding: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '60px', height: '60px', background: 'rgba(54, 153, 255, 0.1)', color: 'var(--primary)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Download size={28} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>สรุปใบงานใหม่</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>เลือกรูปแบบไฟล์สำหรับใบงาน #{ticketNo}</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <button 
            onClick={() => setFormat('pdf')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${format === 'pdf' ? 'var(--primary)' : 'var(--border)'}`,
              background: format === 'pdf' ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ color: format === 'pdf' ? 'var(--primary)' : 'var(--text-muted)' }}>
              <FileText size={24} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: '700', fontSize: '15px', color: format === 'pdf' ? 'white' : 'var(--text-muted)' }}>PDF Document</p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>เหมาะสำหรับพิมพ์ หรือส่งให้ลูกค้า</p>
            </div>
          </button>

          <button 
            onClick={() => setFormat('xlsx')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: `2px solid ${format === 'xlsx' ? 'var(--success)' : 'var(--border)'}`,
              background: format === 'xlsx' ? 'rgba(40, 199, 111, 0.1)' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <div style={{ color: format === 'xlsx' ? 'var(--success)' : 'var(--text-muted)' }}>
              <Table size={24} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: '700', fontSize: '15px', color: format === 'xlsx' ? 'white' : 'var(--text-muted)' }}>Excel Spreadsheet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-dim)' }}>เหมาะสำหรับนำไปคำนวณ หรือเก็บข้อมูล</p>
            </div>
          </button>
        </div>

        {format === 'pdf' && (
          <div style={{ 
            display: 'flex', 
            gap: '10px', 
            padding: '12px', 
            background: 'rgba(255, 159, 67, 0.1)', 
            borderRadius: '10px', 
            marginBottom: '24px',
            border: '1px solid rgba(255, 159, 67, 0.2)'
          }}>
            <AlertCircle size={18} style={{ color: '#ff9f43', flexShrink: 0 }} />
            <p style={{ fontSize: '11px', color: '#ff9f43', lineHeight: '1.4' }}>
              การส่งออกเป็น PDF อาจแสดงผลภาษาไทยได้ไม่สมบูรณ์ หากต้องการข้อมูลภาษาไทยครบถ้วน แนะนำให้ใช้ Excel
            </p>
          </div>
        )}

        <button 
          onClick={handleExport}
          disabled={loading}
          className="glass-interactive"
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '12px',
            background: format === 'pdf' ? 'var(--primary)' : 'var(--success)',
            color: '#0a0e14',
            border: 'none',
            fontWeight: '800',
            fontSize: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? (
            <Loader2 size={22} className="animate-spin" />
          ) : (
            <>
              <Download size={20} />
              ตกลง (Export Now)
            </>
          )}
        </button>
      </div>
    </div>
  );
}
