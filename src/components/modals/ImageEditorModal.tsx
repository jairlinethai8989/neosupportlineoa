'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Square, 
  Circle as CircleIcon, 
  Type, 
  Pencil, 
  Undo, 
  RotateCcw, 
  Send,
  Loader2,
  Minus,
  Plus
} from 'lucide-react';

interface ImageEditorModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

type Tool = 'pencil' | 'rect' | 'circle' | 'text';

export default function ImageEditorModal({ imageUrl, onClose, onSave }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ff0000'); // Default Red
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Drawing states
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // Important for CORS
    img.src = imageUrl;
    
    img.onload = () => {
      // 1. High-Res Strategy: Keep original resolution but cap it at a reasonable high limit (e.g. 2048px)
      // to maintain sharpness while managing memory.
      const MAX_RESOLUTION = 2048;
      let width = img.width;
      let height = img.height;
      
      if (width > MAX_RESOLUTION || height > MAX_RESOLUTION) {
        if (width > height) {
          height = (MAX_RESOLUTION / width) * height;
          width = MAX_RESOLUTION;
        } else {
          width = (MAX_RESOLUTION / height) * width;
          height = MAX_RESOLUTION;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Save initial state to history
      setHistory([canvas.toDataURL('image/jpeg', 0.9)]);
    };
  }, [imageUrl]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      setHistory(prev => [...prev, dataUrl]);
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current
    const lastState = newHistory[newHistory.length - 1];
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx && lastState) {
      const img = new Image();
      img.src = lastState;
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setHistory(newHistory);
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e as any).clientX ? (e as any).clientX - rect.left : (e as any).touches[0].clientX - rect.left) * scaleX;
    const y = ((e as any).clientY ? (e as any).clientY - rect.top : (e as any).touches[0].clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setStartX(x);
    setStartY(y);
    
    // Take snapshot for previewing shapes
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === 'pencil') {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    } else if (tool === 'text') {
      const text = prompt('ใส่ข้อความที่ต้องการ:');
      if (text) {
        ctx.font = `${lineWidth * 10}px Noto Sans Thai, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text, x, y);
        saveToHistory();
      }
      setIsDrawing(false);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || !snapshot) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = ((e as any).clientX ? (e as any).clientX - rect.left : (e as any).touches[0].clientX - rect.left) * scaleX;
    const y = ((e as any).clientY ? (e as any).clientY - rect.top : (e as any).touches[0].clientY - rect.top) * scaleY;

    if (tool === 'pencil') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else {
      // Clear to snapshot and redraw shape
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.beginPath();
      
      if (tool === 'rect') {
        ctx.strokeRect(startX, startY, x - startX, y - startY);
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(x - startX, 2) + Math.pow(y - startY, 2));
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    saveToHistory();
  };

  const exportToBlob = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });
  };

  const handleSave = async () => {
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      const blob = await exportToBlob();
      if (!blob) throw new Error('ไม่สามารถสร้างไฟล์ภาพได้');
      
      // Ensure onSave is awaited so modal stays open during upload
      await onSave(blob);
    } catch (error) {
       console.error('Save failed:', error);
       alert('การบันทึกล้มเหลว: ' + (error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการประมวลผล'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.92)', backdropFilter: 'blur(10px)',
      zIndex: 9999, display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Header Toolbar */}
      <div style={{
        padding: '16px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', color: 'white',
            padding: '8px', borderRadius: '10px', cursor: 'pointer'
          }}>
            <X size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '10px', height: '100%', background: 'var(--primary)', borderRadius: '2px' }} />
            <h3 style={{ fontWeight: '800', color: 'white' }}>เครื่องมือแก้ไขรูปภาพ</h3>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
           <button onClick={undo} disabled={history.length <= 1} style={{
              background: 'none', border: 'none', color: history.length <= 1 ? 'rgba(255,255,255,0.2)' : 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
           }}>
              <Undo size={18} /> ย้อนกลับ
           </button>
           <button onClick={() => {
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext('2d');
              if (canvas && ctx && history[0]) {
                 const img = new Image();
                 img.src = history[0];
                 img.onload = () => { ctx.drawImage(img, 0, 0); setHistory([history[0]]); };
              }
           }} style={{
              background: 'none', border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '6px'
           }}>
              <RotateCcw size={18} /> ล้างหน้าจอ
           </button>
           <button 
             onClick={handleSave}
             disabled={isSaving}
             style={{
               background: 'var(--primary)', color: '#0a0e14', border: 'none',
               padding: '10px 24px', borderRadius: '10px', fontWeight: '800',
               display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
             }}
           >
             {isSaving ? <Loader2 size={18} className="animate-spin" /> : <><Send size={18} /> ส่งภาพที่แก้ไข</>}
           </button>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div ref={containerRef} style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '32px', overflow: 'hidden', position: 'relative'
      }}>
        <canvas 
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ 
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)', 
            cursor: tool === 'text' ? 'text' : 'crosshair',
            background: 'white', 
            borderRadius: '8px',
            maxWidth: '100%',
            maxHeight: '70vh',
            width: 'auto',
            height: 'auto',
            objectFit: 'contain'
          }}
        />
      </div>

      {/* Bottom Tool Bar */}
      <div style={{
        padding: '24px', display: 'flex', justifyContent: 'center',
        borderTop: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)',
        gap: '40px'
      }}>
         {/* Tools */}
         <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'pencil', icon: Pencil },
              { id: 'rect', icon: Square },
              { id: 'circle', icon: CircleIcon },
              { id: 'text', icon: Type }
            ].map(t => (
              <button 
                key={t.id}
                onClick={() => setTool(t.id as Tool)}
                style={{
                  width: '48px', height: '48px', borderRadius: '12px',
                  background: tool === t.id ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  border: tool === t.id ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  color: tool === t.id ? '#0a0e14' : 'white', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <t.icon size={20} />
              </button>
            ))}
         </div>

         <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)' }} />

         {/* Colors */}
         <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {['#ff0000', '#ffff00', '#00f2fe', '#28c76f', '#ffffff', '#000000'].map(c => (
              <button 
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: c, border: color === c ? '3px solid white' : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', transform: color === c ? 'scale(1.15)' : 'scale(1)',
                  transition: 'all 0.2s', boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              />
            ))}
         </div>

         <div style={{ width: '1px', height: '48px', background: 'rgba(255,255,255,0.1)' }} />

         {/* Size */}
         <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button 
              onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
            >
              <Minus size={16} />
            </button>
            <div style={{ 
              width: `${lineWidth * 3 + 10}px`, height: `${lineWidth * 3 + 10}px`,
              borderRadius: '50%', background: color, border: '2px solid white'
            }} />
            <button 
              onClick={() => setLineWidth(Math.min(20, lineWidth + 1))}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
            >
              <Plus size={16} />
            </button>
         </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}} />
    </div>
  );
}
