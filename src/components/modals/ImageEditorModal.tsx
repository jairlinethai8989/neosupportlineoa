'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useRef, useState } from 'react';
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
  Plus,
} from 'lucide-react';

interface ImageEditorModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

type Tool = 'pencil' | 'rect' | 'circle' | 'text';

const COLORS = ['#ff0000', '#ffff00', '#00f2fe', '#28c76f', '#ffffff', '#000000'];
const MAX_RESOLUTION = 2048;

export default function ImageEditorModal({
  imageUrl,
  onClose,
  onSave,
}: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ff0000');
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [snapshot, setSnapshot] = useState<ImageData | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageUrl;
    img.onload = () => {
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
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      setHistory([canvas.toDataURL('image/jpeg', 0.95)]);
    };
  }, [imageUrl]);

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHistory((prev) => [...prev, canvas.toDataURL('image/png')]);
  };

  const restoreFromDataUrl = (dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  const undo = () => {
    if (history.length <= 1) return;
    const next = [...history];
    next.pop();
    const previous = next[next.length - 1];
    if (previous) {
      restoreFromDataUrl(previous);
      setHistory(next);
    }
  };

  const resetCanvas = () => {
    if (history.length === 0) return;
    restoreFromDataUrl(history[0]);
    setHistory([history[0]]);
  };

  const getCanvasPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    setIsDrawing(true);
    setStartX(point.x);
    setStartY(point.y);
    setSnapshot(ctx.getImageData(0, 0, canvas.width, canvas.height));
    canvas.setPointerCapture(e.pointerId);

    if (tool === 'pencil') {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
    } else if (tool === 'text') {
      const text = window.prompt('ใส่ข้อความที่ต้องการ');
      if (text && text.trim()) {
        ctx.font = `${Math.max(14, lineWidth * 8)}px sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(text.trim(), point.x, point.y);
        saveToHistory();
      }
      setIsDrawing(false);
    }
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !snapshot) return;

    const point = getCanvasPoint(e.clientX, e.clientY);
    if (!point) return;

    if (tool === 'pencil') {
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      return;
    }

    ctx.putImageData(snapshot, 0, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();

    if (tool === 'rect') {
      ctx.strokeRect(startX, startY, point.x - startX, point.y - startY);
    } else if (tool === 'circle') {
      const radius = Math.hypot(point.x - startX, point.y - startY);
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const stopDrawing = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e) {
      e.preventDefault();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // already released
      }
    }
    if (!isDrawing) return;
    setIsDrawing(false);
    saveToHistory();
  };

  const exportToBlob = () =>
    new Promise<Blob | null>((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.95);
    });

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const blob = await exportToBlob();
      if (!blob) throw new Error('ไม่สามารถสร้างไฟล์ภาพได้');
      await onSave(blob);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Image save failed:', error);
      alert('บันทึกภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="editor-modal-root"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.92)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: 'none',
              color: 'white',
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              cursor: 'pointer',
            }}
          >
            <X size={20} />
          </button>
          <h3 style={{ fontWeight: 800, color: 'white', fontSize: 'clamp(18px, 4vw, 30px)' }}>
            เครื่องมือแก้ไขรูปภาพ
          </h3>
        </div>

        <div
          className="editor-header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
        >
          <button
            onClick={undo}
            disabled={history.length <= 1}
            style={{
              background: 'none',
              border: 'none',
              color: history.length <= 1 ? 'rgba(255,255,255,0.3)' : 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Undo size={18} /> ย้อนกลับ
          </button>
          <button
            onClick={resetCanvas}
            style={{
              background: 'none',
              border: 'none',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <RotateCcw size={18} /> ล้าง
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: 'var(--primary)',
              color: '#0a0e14',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '10px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            {isSaving ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <Send size={18} /> ส่งภาพที่แก้ไข
              </>
            )}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px',
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={stopDrawing}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            cursor: tool === 'text' ? 'text' : 'crosshair',
            background: 'white',
            borderRadius: '8px',
            maxWidth: '100%',
            maxHeight: '100%',
            width: 'auto',
            height: 'auto',
            touchAction: 'none',
            userSelect: 'none',
          }}
        />
      </div>

      <div
        className="editor-bottom-bar"
        style={{
          padding: '12px',
          display: 'flex',
          justifyContent: 'center',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          background: 'rgba(0,0,0,0.45)',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'pencil', icon: Pencil },
            { id: 'rect', icon: Square },
            { id: 'circle', icon: CircleIcon },
            { id: 'text', icon: Type },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTool(item.id as Tool)}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: tool === item.id ? 'var(--primary)' : 'rgba(255,255,255,0.08)',
                border:
                  tool === item.id ? 'none' : '1px solid rgba(255,255,255,0.12)',
                color: tool === item.id ? '#0a0e14' : 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <item.icon size={19} />
            </button>
          ))}
        </div>

        <div style={{ width: '1px', height: '42px', background: 'rgba(255,255,255,0.12)' }} />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {COLORS.map((itemColor) => (
            <button
              key={itemColor}
              onClick={() => setColor(itemColor)}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: itemColor,
                border:
                  color === itemColor
                    ? '3px solid white'
                    : '2px solid rgba(255,255,255,0.24)',
                cursor: 'pointer',
                transform: color === itemColor ? 'scale(1.14)' : 'scale(1)',
                transition: 'all 0.18s ease',
              }}
            />
          ))}
        </div>

        <div style={{ width: '1px', height: '42px', background: 'rgba(255,255,255,0.12)' }} />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setLineWidth((prev) => Math.max(1, prev - 1))}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'white',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
            }}
          >
            <Minus size={16} />
          </button>
          <div
            style={{
              width: `${lineWidth * 3 + 10}px`,
              height: `${lineWidth * 3 + 10}px`,
              borderRadius: '50%',
              background: color,
              border: '2px solid white',
              minWidth: '14px',
              minHeight: '14px',
            }}
          />
          <button
            onClick={() => setLineWidth((prev) => Math.min(20, prev + 1))}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'white',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @media (max-width: 768px) {
              .editor-header-actions {
                width: 100%;
                justify-content: space-between;
              }
              .editor-bottom-bar {
                gap: 10px;
              }
            }
          `,
        }}
      />
    </div>
  );
}
