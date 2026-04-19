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
      // 1. Give the browser more time to hide the overlay visually
      await new Promise(r => setTimeout(r, 200));
      
      const deviceScale = window.devicePixelRatio || 1;
      
      // 2. Capture ONLY what's visible in the current viewport
      // This prevents issues with huge documents (e.g. long ticket lists)
      const fullCanvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true, // Allow taints as a fallback
        logging: false,
        scale: deviceScale > 1 ? 1.5 : 1, // Balanced quality/performance
        backgroundColor: null,
        // Force these settings to focus only on what the user sees
        width: window.innerWidth,
        height: window.innerHeight,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
      });

      // 3. Create a temporary canvas for the final cropped image
      const finalScale = fullCanvas.width / window.innerWidth;
      const cropWidth = width * finalScale;
      const cropHeight = height * finalScale;
      
      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropWidth;
      cropCanvas.height = cropHeight;

      const ctx = cropCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Use client coordinates relative to the viewport
      ctx.drawImage(
        fullCanvas,
        x * finalScale, y * finalScale, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );

      const dataUrl = cropCanvas.toDataURL('image/jpeg', 0.9);
      onCapture(dataUrl);
    } catch (error) {
      console.error('Capture failed, trying safe fallback:', error);
      // Fallback: Just return a smaller capture if possible or cancel
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
