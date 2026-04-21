'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Trash2, CheckCircle, Upload, PenTool } from 'lucide-react';

interface SignaturePadProps {
  initialValue?: string;
  onSave: (dataUrl: string) => void;
  onUpload: (file: File) => void;
}

export function SignaturePad({ initialValue, onSave, onUpload }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [mode, setMode] = useState<'draw' | 'upload'>('draw');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

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

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

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

    // Create a temporary canvas to trim white space (optional but better for reports)
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setMode('draw')}
          style={{ 
            flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
            background: mode === 'draw' ? 'var(--primary)' : 'var(--bg-input)',
            color: mode === 'draw' ? '#000' : 'var(--text-muted)',
            fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <PenTool size={16} /> วาดลายเซ็น
        </button>
        <button 
          onClick={() => setMode('upload')}
          style={{ 
            flex: 1, padding: '10px', borderRadius: '10px', border: 'none',
            background: mode === 'upload' ? 'var(--primary)' : 'var(--bg-input)',
            color: mode === 'upload' ? '#000' : 'var(--text-muted)',
            fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
          }}
        >
          <Upload size={16} /> อัปโหลดไฟล์
        </button>
      </div>

      {mode === 'draw' ? (
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            width={400}
            height={150}
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
              background: '#fff', 
              borderRadius: '12px', 
              border: '2px dashed var(--border)',
              cursor: 'crosshair',
              touchAction: 'none'
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button 
              onClick={clear}
              className="glass-interactive"
              style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid var(--danger)', color: 'var(--danger)', background: 'transparent', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <Trash2 size={16} /> ล้างข้อมูล
            </button>
            <button 
              onClick={save}
              disabled={!hasContent}
              className="glass-interactive"
              style={{ 
                flex: 1, padding: '10px', borderRadius: '10px', border: 'none', 
                background: !hasContent ? 'var(--border)' : 'var(--success)', 
                color: '#fff', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                opacity: !hasContent ? 0.5 : 1
              }}
            >
              <CheckCircle size={16} /> บันทึกลายเซ็น
            </button>
          </div>
        </div>
      ) : (
        <label style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', 
          height: '150px', background: 'rgba(255,255,255,0.02)', border: '2px dashed var(--border)', 
          borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s'
        }}>
          <Upload size={32} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '700' }}>คลิกเพื่ออัปโหลดไฟล์ลายเซ็น (PNG/JPG)</span>
          <input type="file" hidden accept="image/*" onChange={handleFileChange} />
        </label>
      )}

      {initialValue && (
        <div style={{ marginTop: '12px' }}>
          <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ลายเซ็นปัจจุบัน:</p>
          <div style={{ padding: '12px', background: '#fff', borderRadius: '8px', display: 'inline-block' }}>
            <img src={initialValue} style={{ maxHeight: '60px', width: 'auto' }} alt="Current Signature" />
          </div>
        </div>
      )}
    </div>
  );
}
