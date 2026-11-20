'use client';

import React, { useState } from 'react';
import { CheckCircle2, Download, FileText, Info, Printer } from 'lucide-react';
import { Button, Modal } from '@/components/ui';

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--color-primary)" aria-hidden="true" />
          ตัวอย่าง Ticket Summary
        </span>
      }
      description={
        <>
          ตรวจสอบสรุปรายงานของใบงาน{' '}
          <strong className="tabular-nums" style={{ color: 'var(--color-primary)' }}>
            #{ticketNo}
          </strong>{' '}
          ก่อนเลือกการดำเนินการ
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          {onPrint && (
            <Button
              variant="secondary"
              onClick={handlePrint}
              disabled={loading}
              leftIcon={<Printer size={16} aria-hidden="true" />}
            >
              พิมพ์
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleDownload}
            loading={loading}
            leftIcon={<Download size={16} aria-hidden="true" />}
          >
            ดาวน์โหลด
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div
          style={{
            background: 'var(--color-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            border: '1px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              fontWeight: 700,
              textTransform: 'uppercase',
            }}
          >
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
                <CheckCircle2 size={14} color="var(--color-success)" aria-hidden="true" />
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text)' }}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} color="var(--color-primary)" aria-hidden="true" />
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
            เลือกได้ทั้งดาวน์โหลดเป็นไฟล์ PDF หรือสั่งพิมพ์ทันที
          </p>
        </div>
      </div>
    </Modal>
  );
}
