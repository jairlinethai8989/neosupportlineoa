'use client';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileUp, X, Loader2 } from 'lucide-react';

interface ChatAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, type: 'image' | 'video' | 'file') => void;
  onImageSelect?: (dataUrl: string) => void; 
}

export default function ChatAttachmentModal({ isOpen, onClose, onConfirm, onImageSelect }: ChatAttachmentModalProps) {
  const [mode, setMode] = useState<'select' | 'camera'>('select');
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
       setMode('select');
       setLoading(false);
    } else {
       stopCamera();
    }
  }, [isOpen]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
  };

  const startCamera = async () => {
    setMode('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      alert('Camera access denied or unavailable.');
      setMode('select');
    }
  };

  const captureCamera = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      stopCamera();
      
      if (onImageSelect) {
         onImageSelect(dataUrl);
         onClose();
      } else {
         canvas.toBlob((blob) => {
           if (blob) {
              const file = new File([blob], `cam_${Date.now()}.jpg`, { type: 'image/jpeg' });
              onConfirm(file, 'image');
              onClose();
           }
         }, 'image/jpeg');
      }
    }
  };

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
           <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>Attach File</h2>
           <button onClick={onClose} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}>
              <X size={20} />
           </button>
        </div>

        {/* Content */}
        <div style={{ padding: '24px' }}>
            {mode === 'select' && (
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                 <button 
                  onClick={startCamera} 
                  style={{ 
                    flex: 1, 
                    padding: '24px 16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '10px', 
                    background: '#f8fafc', 
                    color: '#0f172a', 
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer'
                  }}>
                    <Camera size={32} color="var(--portal-primary)" />
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>Take Photo</span>
                 </button>
                 <label 
                  style={{ 
                    flex: 1, 
                    padding: '24px 16px', 
                    borderRadius: '12px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    gap: '10px', 
                    background: '#f8fafc', 
                    color: '#0f172a', 
                    border: '1px solid #e2e8f0', 
                    cursor: 'pointer' 
                  }}>
                    <FileUp size={32} color="#8b5cf6" />
                    <span style={{ fontWeight: '700', fontSize: '13px' }}>Upload File</span>
                    <input type="file" hidden onChange={handleFileUpload} accept="image/*, .pdf, .docx, .doc, .xlsx" />
                 </label>
              </div>
            )}

           {mode === 'camera' && (
             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', background: '#000' }}>
                   <video ref={videoRef} autoPlay playsInline style={{ width: '100%', maxHeight: '50vh', objectFit: 'cover' }} />
                </div>
                <div style={{ display: 'flex', gap: '16px', width: '100%', justifyContent: 'center' }}>
                    <button onClick={() => setMode('select')} style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', fontWeight: '700', cursor: 'pointer' }}>Cancel</button>
                    <button onClick={captureCamera} style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'var(--portal-primary)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                       <Camera size={24} />
                    </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
