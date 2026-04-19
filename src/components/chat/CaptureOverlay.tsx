'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';

interface CaptureOverlayProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsSelecting(true);
    setStartPos({ x: e.clientX, y: e.clientY });
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting) return;
    setCurrentPos({ x: e.clientX, y: e.clientY });
  };

  const onMouseUp = async () => {
    if (!isSelecting) return;
    setIsSelecting(false);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(startPos.x - currentPos.x);
    const height = Math.abs(startPos.y - currentPos.y);

    if (width < 5 || height < 5) return; // Ignore small clicks

    // Temporarily hide overlay to capture background
    if (containerRef.current) containerRef.current.style.visibility = 'hidden';

    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        logging: false,
        x: x + window.scrollX,
        y: y + window.scrollY,
        width: width,
        height: height,
        scale: window.devicePixelRatio || 1,
      });

      onCapture(canvas.toDataURL('image/jpeg', 0.95));
    } catch (error) {
      console.error('Capture failed:', error);
      onCancel();
    } finally {
      if (containerRef.current) containerRef.current.style.visibility = 'visible';
    }
  };

  const left = Math.min(startPos.x, currentPos.x);
  const top = Math.min(startPos.y, currentPos.y);
  const width = Math.abs(startPos.x - currentPos.x);
  const height = Math.abs(startPos.y - currentPos.y);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        cursor: 'crosshair',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        userSelect: 'none'
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {/* Help label */}
      {!isSelecting && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '8px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          ลากคลุมพื้นที่ที่ต้องการ Capture (ESC เพื่อยกเลิก)
        </div>
      )}

      {/* Selection Box */}
      {isSelecting && (
        <>
          <div style={{
            position: 'absolute',
            left,
            top,
            width,
            height,
            border: '2px solid var(--primary)',
            boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.4)`,
            pointerEvents: 'none'
          }}>
            {/* Size label */}
            <div style={{
              position: 'absolute',
              bottom: '-25px',
              right: 0,
              background: 'var(--primary)',
              color: 'black',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '900',
              whiteSpace: 'nowrap'
            }}>
              {width} x {height}
            </div>
          </div>
          
          {/* Crosshair lines */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: currentPos.y, height: '1px', background: 'rgba(54, 153, 255, 0.3)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: currentPos.x, width: '1px', background: 'rgba(54, 153, 255, 0.3)', pointerEvents: 'none' }} />
        </>
      )}
    </div>
  );
}
