import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, Maximize, RotateCcw, Pencil, Download } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onEdit?: (src: string) => void;
}

export default function ImageViewerModal({ isOpen, onClose, imageSrc, onEdit }: ImageViewerModalProps) {
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
          <button onClick={onClose} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Close"><X size={24} /></button>
          <span style={{ color: 'white', fontWeight: '800', fontSize: '14px', letterSpacing: '1px' }}>IMAGE VIEWER</span>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', padding: '4px', borderRadius: '10px', alignItems: 'center', gap: '8px' }}>
            <button onClick={() => setZoom(prev => Math.max(0.2, prev - 0.2))} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }} title="Zoom Out"><ZoomOut size={18} /></button>
            <button onClick={() => setZoom(1)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '800', minWidth: '40px' }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => setZoom(prev => Math.min(5, prev + 0.2))} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }} title="Zoom In"><ZoomIn size={18} /></button>
          </div>

          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
          
          <button onClick={() => setRotate(prev => prev + 90)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }} title="Rotate"><RotateCcw size={18} /></button>
          <button onClick={() => setZoom(1.5)} style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer' }} title="Expand"><Maximize size={18} /></button>
          
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
          
          <a 
            href={imageSrc} 
            download="neo_attachment.png" 
            target="_blank" 
            rel="noreferrer"
            style={{ color: 'white', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }} 
            title="Download Full Size"
          >
            <Download size={18} />
          </a>
          
          
          {onEdit && (
            <>
              <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)' }} />
              <button 
                onClick={() => onEdit(imageSrc)} 
                style={{ 
                  color: '#00f2fe', 
                  background: 'rgba(0,242,254,0.1)', 
                  border: '1px solid rgba(0,242,254,0.3)', 
                  borderRadius: '8px',
                  padding: '6px 12px',
                  cursor: 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '800'
                }}
              >
                <Pencil size={14} /> แก้ไขภาพ
              </button>
            </>
          )}
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
