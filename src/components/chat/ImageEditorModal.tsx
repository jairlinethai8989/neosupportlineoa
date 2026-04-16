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
  RotateCcw, 
  Check,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo,
  Minus,
  Plus
} from 'lucide-react';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (blob: Blob) => void;
  saveLabel?: string;
}

type Tool = 'pencil' | 'rect' | 'circle' | 'text';

export default function ImageEditorModal({ isOpen, onClose, imageSrc, onSave, saveLabel }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ff4d4f'); // Default Red
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(1);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
    if (isOpen && imageSrc) {
      loadImage();
    }
  }, [isOpen, imageSrc]);

  const loadImage = () => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width, height } = img;
      setCanvasSize({ width, height });
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      const initialDataUrl = canvas.toDataURL();
      setHistory([initialDataUrl]);
      setZoom(1); 
    };
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL();
      setHistory(prev => [...prev.slice(-15), dataUrl]);
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const newHistory = history.slice(0, -1);
    const prevState = newHistory[newHistory.length - 1];
    setHistory(newHistory);

    const img = new Image();
    img.src = prevState;
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
    };
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? (e as any).touches[0].clientX : (e as any).clientX;
    const clientY = 'touches' in e ? (e as any).touches[0].clientY : (e as any).clientY;
    
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pos = getPos(e);
    setIsDrawing(true);
    setStartPos(pos);
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));

    if (tool === 'pencil') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !snapshot || !canvas) return;

    if (tool === 'pencil') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === 'rect' || tool === 'circle') {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
      } else {
        const radius = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (tool === 'text') {
      const text = prompt('กรอกข้อความที่ต้องการเพิ่ม:');
      if (text) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (ctx) {
          ctx.font = `bold ${lineWidth * 5 + 15}px Noto Sans Thai, sans-serif`;
          ctx.fillStyle = color;
          ctx.fillText(text, startPos.x, startPos.y);
        }
      }
    }
    saveToHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.toBlob((blob) => {
        if (blob) onSave(blob);
        onClose();
      }, 'image/png', 0.9);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(5, 8, 15, 0.95)', backdropFilter: 'blur(15px)',
      display: 'flex', flexDirection: 'column',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Premium Header Toolbar */}
      <div style={{
        height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#0a0e14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onClose} style={{ 
            color: 'white', background: 'rgba(255,255,255,0.1)', border: 'none', 
            cursor: 'pointer', display: 'flex', padding: '8px', borderRadius: '10px' 
          }}>
            <X size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <div style={{ width: '4px', height: '20px', background: 'var(--primary)', borderRadius: '2px' }} />
             <span style={{ fontWeight: '900', fontSize: '16px', color: 'white', letterSpacing: '1px' }}>IMAGE EDITOR PRO</span>
          </div>
        </div>
        
        {/* Drawing Tools */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '16px' }}>
          {[
            { id: 'pencil', icon: Pencil, label: 'วาดเขียน' },
            { id: 'rect', icon: Square, label: 'สี่เหลี่ยม' },
            { id: 'circle', icon: CircleIcon, label: 'วงกลม' },
            { id: 'text', icon: Type, label: 'ข้อความ' },
          ].map(t => (
            <button
               key={t.id}
               onClick={() => setTool(t.id as Tool)}
               title={t.label}
               style={{
                 width: '44px', height: '44px', borderRadius: '12px', border: 'none',
                 background: tool === t.id ? 'var(--primary)' : 'transparent',
                 color: tool === t.id ? '#000' : 'white',
                 cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                 transform: tool === t.id ? 'scale(1.1)' : 'scale(1)'
               }}
            >
              <t.icon size={20} />
            </button>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={undo} disabled={history.length <= 1} style={{ 
            color: history.length <= 1 ? 'rgba(255,255,255,0.2)' : 'white', 
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' 
          }}>
            <Undo size={18} /> ย้อนกลับ
          </button>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
          <button 
            onClick={handleSave}
            style={{ 
              background: 'var(--primary)', color: 'black', border: 'none', 
              borderRadius: '12px', padding: '12px 28px', fontWeight: '900', 
              display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(115, 103, 240, 0.3)'
            }}
          >
            <Check size={20} /> {saveLabel || 'ส่งภาพที่แก้ไข'}
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div 
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '40px' }}
        className="no-scrollbar"
      >
        <div style={{ 
          position: 'relative', 
          boxShadow: '0 30px 100px rgba(0,0,0,0.8)', 
          borderRadius: '8px', 
          transform: `scale(${zoom})`,
          transition: 'transform 0.2s',
          transformOrigin: 'center center',
          background: 'white'
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
              cursor: tool === 'pencil' ? 'crosshair' : 'default',
              display: 'block',
              borderRadius: '8px'
            }}
          />
        </div>
      </div>

      {/* Bottom Settings Bar */}
      <div style={{
         padding: '24px', background: '#0a0e14', borderTop: '1px solid rgba(255,255,255,0.1)',
         display: 'flex', justifyContent: 'center', gap: '48px', alignItems: 'center'
      }}>
          {/* Zoom Controls */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button onClick={() => setZoom(prev => Math.max(0.3, prev - 0.2))} style={{ color: 'white', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%' }}><ZoomOut size={18} /></button>
            <span style={{ color: 'white', fontSize: '13px', fontWeight: '800', minWidth: '45px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(prev => Math.min(3, prev + 0.2))} style={{ color: 'white', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%' }}><ZoomIn size={18} /></button>
            <button onClick={() => setZoom(1)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', marginLeft: '8px' }}><Maximize size={18} /></button>
          </div>

          <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />

          {/* Color Picker */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {['#ff4d4f', '#28c76f', '#00f2fe', '#ff9f43', '#ffffff', '#000000'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '32px', height: '32px', borderRadius: '50%', border: color === c ? '3px solid white' : '2px solid rgba(255,255,255,0.2)',
                  background: c, cursor: 'pointer', transition: 'transform 0.2s',
                  transform: color === c ? 'scale(1.2)' : 'scale(1)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                }}
              />
            ))}
          </div>

          <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.1)' }} />

          {/* Line Width */}
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button 
              onClick={() => setLineWidth(Math.max(1, lineWidth - 1))}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
            >
              <Minus size={16} />
            </button>
            <div style={{ 
              width: `${lineWidth * 2 + 8}px`, height: `${lineWidth * 2 + 8}px`,
              borderRadius: '50%', background: color, border: '2px solid white',
              boxShadow: `0 0 10px ${color}44`
            }} />
            <button 
              onClick={() => setLineWidth(Math.min(20, lineWidth + 1))}
              style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer' }}
            >
              <Plus size={16} />
            </button>
          </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
