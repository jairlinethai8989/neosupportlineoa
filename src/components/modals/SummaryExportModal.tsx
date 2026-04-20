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
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      await onExport('pdf');
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
      backdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="glass" style={{ width: '400px', padding: '40px', boxShadow: '0 25px 80px rgba(0,0,0,0.6)', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
        <button 
          onClick={onClose} 
          className="glass-interactive"
          style={{ position: 'absolute', top: '24px', right: '24px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <X size={20} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ 
            width: '72px', 
            height: '72px', 
            background: 'var(--primary-transparent)', 
            color: 'var(--primary)', 
            borderRadius: '24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 20px',
            boxShadow: '0 10px 25px var(--primary-glow)'
          }}>
            <FileText size={32} />
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '8px', letterSpacing: '-0.5px' }}>ยืนยันการสรุปใบงาน</h2>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            คุณกำลังจะสร้างไฟล์เอกสารสรุป <strong style={{ color: 'var(--text-main)' }}>PDF</strong> สำหรับใบงาน <span style={{ color: 'var(--primary)', fontWeight: '800' }}>#{ticketNo}</span>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <button 
            onClick={handleExport}
            disabled={loading}
            className="glass-interactive"
            style={{
              width: '100%',
              padding: '18px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, var(--primary) 0%, oklch(60% 0.15 280) 100%)',
              color: 'white',
              border: 'none',
              fontWeight: '900',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 10px 30px var(--primary-transparent)',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.3s'
            }}
          >
            {loading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                <Download size={20} />
                ตกลง (Export Now)
              </>
            )}
          </button>
          
          <button 
            onClick={onClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '8px'
            }}
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
