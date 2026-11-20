'use client';

import React, { useRef } from 'react';
import { Camera, FileUp } from 'lucide-react';
import { Modal } from '@/components/ui';

interface ChatAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, type: 'image' | 'video' | 'file') => void;
  onImageSelect?: (dataUrl: string) => void;
}

export default function ChatAttachmentModal({
  isOpen,
  onClose,
  onConfirm,
  onImageSelect,
}: ChatAttachmentModalProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    if (uploadedFile.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit.');
      return;
    }

    if (uploadedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (onImageSelect) {
          onImageSelect(dataUrl);
          onClose();
        } else {
          onConfirm(uploadedFile, 'image');
          onClose();
        }
      };
      reader.readAsDataURL(uploadedFile);
    } else {
      onConfirm(uploadedFile, 'file');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title="แนบไฟล์ / ถ่ายรูป"
      closeLabel="ปิดหน้าต่าง"
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          style={{
            padding: '24px 16px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--color-surface-subtle)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-strong)',
            cursor: 'pointer',
          }}
        >
          <Camera size={28} color="var(--color-primary)" aria-hidden="true" />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>ถ่ายรูป (Camera)</span>
          <input
            type="file"
            hidden
            ref={cameraInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            capture="environment"
          />
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: '24px 16px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--color-surface-subtle)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border-strong)',
            cursor: 'pointer',
          }}
        >
          <FileUp size={28} color="var(--color-info)" aria-hidden="true" />
          <span style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>ไฟล์ / อัลบั้ม</span>
          <input
            type="file"
            hidden
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*, .pdf, .docx, .doc, .xlsx"
          />
        </button>
      </div>
    </Modal>
  );
}
