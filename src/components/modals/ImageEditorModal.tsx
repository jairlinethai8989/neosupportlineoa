'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  Circle as CircleIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Square,
  Type,
  Undo,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/utils/imageCompression';

interface ImageEditorModalProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (blob: Blob) => Promise<void>;
}

type Tool = 'pencil' | 'rect' | 'circle' | 'text' | 'arrow';

const COLORS = [
  { hex: '#dc2626', label: 'Red' },
  { hex: '#eab308', label: 'Yellow' },
  { hex: '#2563eb', label: 'Blue' },
  { hex: '#059669', label: 'Green' },
  { hex: '#ffffff', label: 'White' },
  { hex: '#0f172a', label: 'Black' },
];
const MAX_RESOLUTION = 2048;

export default function ImageEditorModal({
  imageUrl,
  onClose,
  onSave,
}: ImageEditorModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#dc2626');
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

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

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
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    if (tool === 'rect') {
      ctx.strokeRect(startX, startY, point.x - startX, point.y - startY);
    } else if (tool === 'circle') {
      const radius = Math.hypot(point.x - startX, point.y - startY);
      ctx.arc(startX, startY, radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (tool === 'arrow') {
      const endX = point.x;
      const endY = point.y;
      const angle = Math.atan2(endY - startY, endX - startX);
      const headLength = Math.max(12, lineWidth * 3);

      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6)
      );
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
      const compressedBlob = await compressImage(blob, { format: 'image/webp', quality: 1.0 });
      await onSave(compressedBlob);
    } catch (error) {
      console.error('Image save failed:', error);
      alert('บันทึกภาพไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setIsSaving(false);
    }
  };

  const tools: Array<{ id: Tool; icon: typeof Pencil; label: string }> = [
    { id: 'pencil', icon: Pencil, label: 'Freehand pencil' },
    { id: 'arrow', icon: ArrowUpRight, label: 'Arrow' },
    { id: 'rect', icon: Square, label: 'Rectangle' },
    { id: 'circle', icon: CircleIcon, label: 'Circle' },
    { id: 'text', icon: Type, label: 'Add text' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Image editor"
      className="editor-modal-root"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(11, 16, 23, 0.96)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
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
          borderBottom: '1px solid #233042',
          background: '#111822',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close image editor"
            style={{
              background: '#17202e',
              border: '1px solid #233042',
              color: '#f1f5f9',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
          <h3 style={{ margin: 0, fontWeight: 700, color: '#f1f5f9', fontSize: 'var(--text-md)' }}>
            เครื่องมือแก้ไขรูปภาพ
          </h3>
        </div>

        <div
          className="editor-header-actions"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}
        >
          <button
            type="button"
            onClick={undo}
            disabled={history.length <= 1}
            aria-label="Undo last stroke"
            style={{
              background: '#17202e',
              border: '1px solid #233042',
              borderRadius: '8px',
              height: '36px',
              padding: '0 12px',
              color: history.length <= 1 ? '#55657c' : '#f1f5f9',
              cursor: history.length <= 1 ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
            }}
          >
            <Undo size={15} aria-hidden="true" /> ย้อนกลับ
          </button>
          <button
            type="button"
            onClick={resetCanvas}
            aria-label="Reset canvas"
            style={{
              background: '#17202e',
              border: '1px solid #233042',
              borderRadius: '8px',
              height: '36px',
              padding: '0 12px',
              color: '#f1f5f9',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
            }}
          >
            <RotateCcw size={15} aria-hidden="true" /> ล้าง
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              height: '36px',
              padding: '0 16px',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isSaving ? 'not-allowed' : 'pointer',
            }}
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <>
                <Send size={15} aria-hidden="true" /> ส่งภาพที่แก้ไข
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
          padding: '12px',
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
            boxShadow: 'var(--shadow-lg)',
            cursor: tool === 'text' ? 'text' : 'crosshair',
            background: '#ffffff',
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
          alignItems: 'center',
          borderTop: '1px solid #233042',
          background: '#111822',
          gap: '14px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }} role="group" aria-label="Drawing tools">
          {tools.map((item) => {
            const active = tool === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-label={item.label}
                aria-pressed={active}
                onClick={() => setTool(item.id)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: active ? '#2563eb' : '#17202e',
                  border: active ? '1px solid #3b82f6' : '1px solid #233042',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <item.icon size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        <div style={{ width: '1px', height: '32px', background: '#233042' }} />

        <div
          style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}
          role="group"
          aria-label="Brush color"
        >
          {COLORS.map((itemColor) => {
            const active = color === itemColor.hex;
            return (
              <button
                key={itemColor.hex}
                type="button"
                aria-label={`Color ${itemColor.label}`}
                aria-pressed={active}
                onClick={() => setColor(itemColor.hex)}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: itemColor.hex,
                  border: active ? '3px solid #ffffff' : '2px solid #33455e',
                  cursor: 'pointer',
                  transform: active ? 'scale(1.12)' : 'scale(1)',
                  transition: 'transform 150ms ease',
                }}
              />
            );
          })}
        </div>

        <div style={{ width: '1px', height: '32px', background: '#233042' }} />

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            type="button"
            aria-label="Decrease stroke width"
            onClick={() => setLineWidth((prev) => Math.max(1, prev - 1))}
            style={{
              background: '#17202e',
              border: '1px solid #233042',
              color: '#f1f5f9',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <div
            aria-label={`Stroke width ${lineWidth}`}
            style={{
              width: `${lineWidth * 3 + 10}px`,
              height: `${lineWidth * 3 + 10}px`,
              borderRadius: '50%',
              background: color,
              border: '2px solid #ffffff',
              minWidth: '14px',
              minHeight: '14px',
            }}
          />
          <button
            type="button"
            aria-label="Increase stroke width"
            onClick={() => setLineWidth((prev) => Math.min(20, prev + 1))}
            style={{
              background: '#17202e',
              border: '1px solid #233042',
              color: '#f1f5f9',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
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
