'use client';
import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
}

export default function ImageViewerModal({ isOpen, onClose, imageSrc }: ImageViewerModalProps) {
  const [zoom, setZoom] = useState(1);
  const [rotate, setRotate] = useState(0);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(15px)',
      display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease'
    }}>
      <div style={{
        height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={onClose} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
          <span style={{ color: 'white', fontWeight: '800', fontSize: '14px' }}>IMAGE VIEWER</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button onClick={() => setZoom(prev => Math.max(0.2, prev - 0.2))} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomOut size={20} /></button>
          <button onClick={() => setZoom(1)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '800' }}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => setZoom(prev => Math.min(5, prev + 0.2))} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><ZoomIn size={20} /></button>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
          <button onClick={() => setRotate(prev => prev + 90)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }}><RotateCcw size={20} /></button>
          <button onClick={() => setZoom(1.5)} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}><Maximize size={20} /></button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '20px' }}>
        <img 
          src={imageSrc} 
          style={{ 
            maxWidth: '90%', 
            maxHeight: '90%', 
            transform: `scale(${zoom}) rotate(${rotate}deg)`,
            transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            boxShadow: '0 20px 80px rgba(0,0,0,0.5)',
            borderRadius: '4px'
          }} 
          alt="Full size view" 
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}} />
    </div>
  );
}
