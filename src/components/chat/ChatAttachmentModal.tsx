'use client';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import { Camera, FileUp, X, Type, PenTool, Check, Image as ImageIcon, RotateCw } from 'lucide-react';

interface ChatAttachmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (file: File, type: 'image' | 'video' | 'file') => void;
  onImageSelect?: (dataUrl: string) => void; // New: for modern editor redirection
}

export default function ChatAttachmentModal({ isOpen, onClose, onConfirm, onImageSelect }: ChatAttachmentModalProps) {
  const [mode, setMode] = useState<'select' | 'camera'>('select');
  const [imageSrc, setImageSrc] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Drawing config
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ea5455');
  const [tool, setTool] = useState<'draw' | 'text'>('draw');
  const [textInput, setTextInput] = useState('');
  const [textPos, setTextPos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    if (isOpen) {
       setMode('select');
       setImageSrc('');
       setTextInput('');
    } else {
       stopCamera();
    }
  }, [isOpen]);

  // Load image to canvas when entering edit mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode === 'edit' && imageSrc && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = new Image();
      img.onload = () => {
        // Use original image dimensions for full resolution
        const width = img.width;
        const height = img.height;

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
      };
      img.src = imageSrc;
    }
  }, [mode, imageSrc]);

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
           // Fallback if no modern editor provided
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

  // Canvas Drawing
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool !== 'draw') return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.beginPath(); // reset path
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || tool !== 'draw' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (tool === 'text' && textInput) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      ctx.font = '24px Inter';
      ctx.fillStyle = color;
      ctx.fillText(textInput, x, y);
      setTextInput(''); // reset after stamping
    }
  };

  const handleSaveAndSend = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `image_${Date.now()}.jpg`, { type: 'image/jpeg' });
          onConfirm(file, 'image');
          onClose();
        }
      }, 'image/jpeg', 0.95);
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
                <button onClick={captureCamera} className="glass-interactive flex-center" style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary)', color: '#000', border: '4px solid rgba(0, 242, 254, 0.3)' }}>
                   <Camera size={24} />
                </button>
             </div>
           )}

           {mode === 'edit' && (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Toolbar */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                   <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '8px', padding: '4px' }}>
                      <button onClick={() => setTool('draw')} style={{ padding: '8px', borderRadius: '6px', border: 'none', background: tool === 'draw' ? 'var(--primary)' : 'transparent', color: tool === 'draw' ? '#000' : 'var(--text-main)' }}><PenTool size={18} /></button>
                      <button onClick={() => setTool('text')} style={{ padding: '8px', borderRadius: '6px', border: 'none', background: tool === 'text' ? 'var(--primary)' : 'transparent', color: tool === 'text' ? '#000' : 'var(--text-main)' }}><Type size={18} /></button>
                   </div>
                   
                   {/* Colors */}
                   <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {['#ea5455', '#28c76f', '#00cfe8', '#ff9f43', '#ffffff', '#000000'].map(c => (
                         <button key={c} onClick={() => setColor(c)} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: color === c ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }} />
                      ))}
                   </div>

                   {/* Text input area if tool is text */}
                   {tool === 'text' && (
                      <input 
                        type="text" 
                        placeholder="Type text, then click on image..." 
                        value={textInput} 
                        onChange={e => setTextInput(e.target.value)}
                        style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-main)', padding: '6px 12px', fontSize: '12px' }}
                      />
                   )}
                </div>

                {/* Canvas Container */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', overflow: 'hidden' }}>
                   <canvas 
                     ref={canvasRef}
                     onMouseDown={startDrawing}
                     onMouseUp={stopDrawing}
                     onMouseOut={stopDrawing}
                     onMouseMove={draw}
                     onTouchStart={startDrawing}
                     onTouchEnd={stopDrawing}
                     onTouchMove={draw}
                     onClick={handleCanvasClick}
                     style={{ cursor: tool === 'text' ? 'text' : 'crosshair', maxWidth: '100%', maxHeight: '50vh' }}
                   />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                   <button onClick={() => setMode('select')} className="glass-interactive" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-main)', fontWeight: '600' }}>Cancel</button>
                   <button onClick={handleSaveAndSend} className="glass-interactive" style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: '#000', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Check size={18} /> Send
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
