'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Trash2, CheckCircle, Upload, PenTool } from 'lucide-react';
import { Button } from '@/components/ui';

interface SignaturePadProps {
  initialValue?: string;
  onSave: (dataUrl: string) => void;
  onUpload: (file: File) => void;
}

export function SignaturePad({ initialValue, onSave, onUpload }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const getPointerPos = (canvas: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPos(canvas, e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasContent(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPointerPos(canvas, e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!hasContent) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div
        role="tablist"
        aria-label="รูปแบบลายเซ็น"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          padding: '4px',
          background: 'var(--color-surface-subtle)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'draw'}
          onClick={() => setMode('draw')}
          style={{
            height: 'var(--control-sm)',
            borderRadius: 'var(--radius-sm)',
            border: mode === 'draw' ? '1px solid var(--color-border-strong)' : '1px solid transparent',
            background: mode === 'draw' ? 'var(--color-surface)' : 'transparent',
            color: mode === 'draw' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: mode === 'draw' ? 'var(--shadow-sm)' : 'none',
            fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'var(--transition-colors)',
          }}
        >
          <PenTool size={14} aria-hidden="true" />
          วาดลายเซ็น
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'upload'}
          onClick={() => setMode('upload')}
          style={{
            height: 'var(--control-sm)',
            borderRadius: 'var(--radius-sm)',
            border: mode === 'upload' ? '1px solid var(--color-border-strong)' : '1px solid transparent',
            background: mode === 'upload' ? 'var(--color-surface)' : 'transparent',
            color: mode === 'upload' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            boxShadow: mode === 'upload' ? 'var(--shadow-sm)' : 'none',
            fontWeight: 'var(--weight-semibold)',
            fontSize: 'var(--text-xs)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            transition: 'var(--transition-colors)',
          }}
        >
          <Upload size={14} aria-hidden="true" />
          อัปโหลดไฟล์
        </button>
      </div>

      {mode === 'draw' ? (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
            aria-label="พื้นที่สำหรับวาดลายเซ็นดิจิทัล"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            style={{
              width: '100%',
              height: '150px',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--color-border-strong)',
              cursor: 'crosshair',
              touchAction: 'none',
              display: 'block',
            }}
          />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
            <Button
              variant="secondary"
              onClick={clear}
              leftIcon={<Trash2 size={15} aria-hidden="true" />}
              fullWidth
            >
              ล้างข้อมูล
            </Button>
            <Button
              variant="primary"
              onClick={save}
              disabled={!hasContent}
              leftIcon={<CheckCircle size={15} aria-hidden="true" />}
              fullWidth
            >
              บันทึกลายเซ็น
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            hidden
            accept="image/*"
            onChange={handleFileChange}
            aria-label="อัปโหลดไฟล์ลายเซ็น"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              height: '150px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              background: 'var(--color-surface-subtle)',
              border: '1px dashed var(--color-border-strong)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)',
              transition: 'var(--transition-colors)',
            }}
          >
            <Upload size={26} aria-hidden="true" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)' }}>
              คลิกเพื่ออัปโหลดไฟล์ลายเซ็น (PNG/JPG)
            </span>
          </button>
        </div>
      )}

      {initialValue && (
        <div
          style={{
            paddingTop: 'var(--space-3)',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <p
            style={{
              fontSize: '11px',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: 'var(--space-2)',
            }}
          >
            ลายเซ็นปัจจุบัน
          </p>
          <div
            style={{
              padding: 'var(--space-3)',
              background: '#ffffff',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              display: 'inline-block',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={initialValue} style={{ maxHeight: '60px', width: 'auto', display: 'block' }} alt="Current Signature" />
          </div>
        </div>
      )}
    </div>
  );
}
