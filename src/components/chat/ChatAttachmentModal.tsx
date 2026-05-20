'use client';
import React, { useRef } from 'react';
import { Camera, FileUp, X } from 'lucide-react';

interface ChatAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, type: 'image' | 'video' | 'file') => void;
  onImageSelect?: (dataUrl: string) => void; 
}

export default function ChatAttachmentModal({ isOpen, onClose, onConfirm, onImageSelect }: ChatAttachmentModalProps) {
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

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'white', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}>
        
        {/* Header */}
        <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
           <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>แนบไฟล์ / ถ่ายรูป</h2>
           <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {/* 1. NATIVE CAMERA BUTTON */}
                <button 
                onClick={() => cameraInputRef.current?.click()} 
                style={{ 
                  flex: 1, 
                  padding: '24px 16px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: 'var(--portal-bg)', 
                  color: '#0f172a', 
                  border: '1px solid #e2e8f0',
                  cursor: 'pointer'
                }}>
                  <Camera size={32} color="var(--portal-primary)" />
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>ถ่ายรูป (Camera)</span>
                  <input 
                    type="file" 
                    hidden 
                    ref={cameraInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*" 
                    capture="environment" 
                  />
                </button>

                {/* 2. FILE/GALLERY BUTTON */}
                <button 
                onClick={() => fileInputRef.current?.click()} 
                style={{ 
                  flex: 1, 
                  padding: '24px 16px', 
                  borderRadius: '12px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: 'var(--portal-bg)', 
                  color: '#0f172a', 
                  border: '1px solid #e2e8f0', 
                  cursor: 'pointer' 
                }}>
                  <FileUp size={32} color="#8b5cf6" />
                  <span style={{ fontWeight: '700', fontSize: '13px' }}>ไฟล์ / อัลบั้ม</span>
                  <input 
                    type="file" 
                    hidden 
                    ref={fileInputRef} 
                    onChange={handleFileUpload} 
                    accept="image/*, .pdf, .docx, .doc, .xlsx" 
                  />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}
