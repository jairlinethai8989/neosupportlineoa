'use client';
import React, { useRef, useState, useEffect } from 'react';
import { 
  X, 
  Square, 
  Circle, 
  Type, 
  Pencil, 
  Eraser, 
  RotateCcw, 
  Download,
  Check,
  MousePointer2
} from 'lucide-react';

interface ImageEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onSave: (blob: Blob) => void;
}

type Tool = 'pencil' | 'rect' | 'circle' | 'text' | 'select';

export default function ImageEditorModal({ isOpen, onClose, imageSrc, onSave }: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ff4d4f'); // Default Red for highlight
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

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

      // Calculate sizes to fit container while maintaining aspect ratio
      const maxWidth = window.innerWidth * 0.8;
      const maxHeight = window.innerHeight * 0.7;
      let { width, height } = img;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      if (height > maxHeight) {
        width *= maxHeight / height;
        height = maxHeight;
      }

      setCanvasSize({ width, height });
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      saveToHistory();
    };
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      setHistory(prev => [...prev.slice(-10), canvas.toDataURL()]);
    }
  };

  const undo = () => {
    if (history.length <= 1) return;
    const prev = history[history.length - 2];
    const newHist = history.slice(0, -1);
    setHistory(newHist);

    const img = new Image();
    img.src = prev;
    img.onload = () => {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
        ctx.drawImage(img, 0, 0);
      }
    };
  };

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    setStartPos(pos);

    if (tool === 'pencil') {
      const ctx = canvasRef.current?.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    if (tool === 'pencil') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    } else if (tool === 'rect' || tool === 'circle') {
      // Preview logic: need to redraw from last history state then draw shape
      const img = new Image();
      img.src = history[history.length - 1];
      ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);
      ctx.drawImage(img, 0, 0);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
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
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
          ctx.font = 'bold 24px Kanit, sans-serif';
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
      }, 'image/png');
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)',
      display: 'flex', flexDirection: 'column',
       animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Toolbar Top */}
      <div style={{
        height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#0a0e14'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <button onClick={onClose} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
          <span style={{ fontWeight: '800', fontSize: '18px', color: 'var(--primary)' }}>Advanced Image Editor</span>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '6px', borderRadius: '12px' }}>
          {[
            { id: 'pencil', icon: Pencil },
            { id: 'rect', icon: Square },
            { id: 'circle', icon: Circle },
            { id: 'text', icon: Type },
          ].map(t => (
            <button
               key={t.id}
               onClick={() => setTool(t.id as Tool)}
               style={{
                 width: '40px', height: '40px', borderRadius: '8px', border: 'none',
                 background: tool === t.id ? 'var(--primary)' : 'transparent',
                 color: tool === t.id ? '#000' : 'white',
                 cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                 transition: 'all 0.2s'
               }}
            >
              <t.icon size={20} />
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['#ff4d4f', '#28c76f', '#00f2fe', '#ff9f43', '#ffffff'].map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                style={{
                  width: '24px', height: '24px', borderRadius: '50%', border: color === c ? '2px solid white' : 'none',
                  background: c, cursor: 'pointer', boxShadow: '0 0 10px rgba(0,0,0,0.5)'
                }}
              />
            ))}
          </div>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={undo} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }} title="Undo"><RotateCcw size={20} /></button>
          <button 
            onClick={handleSave}
            style={{ 
              background: 'var(--primary)', color: 'black', border: 'none', 
              borderRadius: '10px', padding: '10px 24px', fontWeight: '900', 
              display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer'
            }}
          >
            <Check size={20} /> ส่งรูปที่แก้ไข
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div 
        ref={containerRef}
        style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '40px' }}
      >
        <div style={{ position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.8)', borderRadius: '4px', overflow: 'hidden' }}>
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
              background: '#000'
            }}
          />
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}
