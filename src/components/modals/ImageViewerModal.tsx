'use client';

import React, { useState } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize, 
  Download,
  Edit2
} from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string;
  onClose: () => void;
  onEdit?: (url: string) => void;
}

export default function ImageViewerModal({ imageUrl, onClose, onEdit }: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setScale(1);
    setRotation(0);
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `neo-support-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
      className="animate-fade-in"
      style={{ 
        position: 'fixed', 
        inset: 0, 
        zIndex: 11000, 
        background: 'rgba(5, 8, 15, 0.95)', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)'
      }}
      onClick={onClose}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="viewer-close-btn flex-center glass-interactive"
      >
        <X size={24} />
      </button>

      {/* Toolbar */}
      <div 
        className="viewer-toolbar"
        style={{ 
          position: 'absolute', 
          top: '24px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '12px',
          background: 'rgba(255, 255, 255, 0.1)',
          padding: '8px 16px',
          borderRadius: '32px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 10,
          backdropFilter: 'blur(20px)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={handleZoomIn} className="tool-btn" title="Zoom In"><ZoomIn size={18} /></button>
        <button onClick={handleZoomOut} className="tool-btn" title="Zoom Out"><ZoomOut size={18} /></button>
        <button onClick={handleRotate} className="tool-btn" title="Rotate"><RotateCw size={18} /></button>
        <button onClick={handleReset} className="tool-btn" title="Reset"><Maximize size={18} /></button>
        <div style={{ width: '1px', background: 'rgba(255, 255, 255, 0.1)', margin: '0 4px' }} />
        <button onClick={handleDownload} className="tool-btn" title="Download"><Download size={18} /></button>
        {onEdit && (
          <button 
            onClick={() => {
              onEdit(imageUrl);
              onClose();
            }} 
            className="tool-btn" 
            style={{ color: 'var(--primary)' }}
            title="Edit / Draw"
          >
            <Edit2 size={18} />
          </button>
        )}
      </div>

      {/* Image Container */}
      <div 
        style={{ 
          width: '100%', 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'hidden'
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src={imageUrl}           alt="Full Preview"
          style={{ 
            maxWidth: '90%', 
            maxHeight: '85%', 
            objectFit: 'contain',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 0.3s cubic-bezier(0.19, 1, 0.22, 1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
            borderRadius: '12px'
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .viewer-close-btn {
          position: absolute;
          top: 24px;
          left: 24px;
          width: 48px;
          height: 48px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.1);
          border: none;
          color: white;
          cursor: pointer;
          z-index: 12;
        }
        .viewer-toolbar {
          max-width: calc(100vw - 120px);
        }
        .tool-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .tool-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          transform: translateY(-2px);
        }
        @media (max-width: 768px) {
          .viewer-close-btn {
            top: max(12px, env(safe-area-inset-top));
            left: 12px;
            width: 44px;
            height: 44px;
          }
          .viewer-toolbar {
            top: calc(max(12px, env(safe-area-inset-top)) + 54px) !important;
            max-width: calc(100vw - 24px);
            gap: 8px !important;
            padding: 8px 10px !important;
            overflow-x: auto;
            scrollbar-width: none;
          }
          .viewer-toolbar::-webkit-scrollbar {
            display: none;
          }
        }
      `}} />
    </div>
  );
}
