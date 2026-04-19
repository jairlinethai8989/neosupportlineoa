'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';

interface CaptureOverlayProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

export default function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
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
    setIsSelecting(false);
    setIsCapturing(true);

    const x = Math.min(startPos.x, currentPos.x);
    const y = Math.min(startPos.y, currentPos.y);
    const width = Math.abs(startPos.x - currentPos.x);
    const height = Math.abs(startPos.y - currentPos.y);

    if (width < 5 || height < 5) {
      setIsCapturing(false);
      return; 
    }

    // Temporarily hide overlay to capture background
    if (containerRef.current) containerRef.current.style.visibility = 'hidden';

    try {
      // Small delay to ensure dimming is hidden
      await new Promise(r => setTimeout(r, 150));
      
      const deviceScale = window.devicePixelRatio || 1;
      
      // 1. Capture the entire body (handles internal scrolls better)
      const fullCanvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: false,
        logging: false,
        scale: deviceScale,
        backgroundColor: null,
        scrollX: 0,
        scrollY: 0,
        windowWidth: document.documentElement.clientWidth,
        windowHeight: document.documentElement.clientHeight
      });

      // 2. Calculate crop coordinates relative to the body
      // We use getBoundingClientRect of body to normalize offsets
      const bodyRect = document.body.getBoundingClientRect();
      const cropX = (x - bodyRect.left) * deviceScale;
      const cropY = (y - bodyRect.top) * deviceScale;
      const cropWidth = width * deviceScale;
      const cropHeight = height * deviceScale;

      // 3. Create a temporary canvas for the final cropped image
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;

      const ctx = cropCanvas.width > 0 && cropCanvas.height > 0 ? cropCanvas.getContext('2d') : null;
      if (!ctx) throw new Error('Invalid capture dimensions');

      ctx.drawImage(
        fullCanvas,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.95);
      onCapture(dataUrl);
    } catch (error) {
      console.error('Capture failed:', error);
      onCancel();
    } finally {
      setIsCapturing(false);
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
      {!isSelecting && !isCapturing && (
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

      {isCapturing && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(54, 153, 255, 0.9)',
          color: 'black',
          padding: '12px 24px',
          borderRadius: '12px',
          fontSize: '16px',
          fontWeight: '800',
          pointerEvents: 'none',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div className="animate-spin" style={{ width: '20px', height: '20px', border: '3px solid black', borderTopColor: 'transparent', borderRadius: '50%' }} />
          กำลังบันทึกภาพ...
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
