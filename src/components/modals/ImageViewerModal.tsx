'use client';

import React, { useEffect, useState } from 'react';
import { Download, Edit2, Maximize, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageViewerModalProps {
  imageUrl: string;
  onClose: () => void;
  onEdit?: (url: string) => void;
}

export default function ImageViewerModal({ imageUrl, onClose, onEdit }: ImageViewerModalProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.25, 4));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
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
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 11000,
        background: 'rgba(11, 16, 23, 0.92)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close image viewer"
        className="viewer-close-btn"
      >
        <X size={22} aria-hidden="true" />
      </button>

      <div
        className="viewer-toolbar"
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#111822',
          padding: '6px 12px',
          borderRadius: 'var(--radius-full)',
          border: '1px solid #233042',
          zIndex: 10,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleZoomIn}
          className="tool-btn"
          title="Zoom In"
          aria-label="Zoom in"
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          className="tool-btn"
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleRotate}
          className="tool-btn"
          title="Rotate"
          aria-label="Rotate 90 degrees"
        >
          <RotateCw size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="tool-btn"
          title="Reset"
          aria-label="Reset zoom and rotation"
        >
          <Maximize size={18} aria-hidden="true" />
        </button>
        <div style={{ width: '1px', height: '20px', background: '#233042', margin: '0 2px' }} />
        <button
          type="button"
          onClick={handleDownload}
          className="tool-btn"
          title="Download"
          aria-label="Download image"
        >
          <Download size={18} aria-hidden="true" />
        </button>
        {onEdit && (
          <button
            type="button"
            onClick={() => {
              onEdit(imageUrl);
              onClose();
            }}
            className="tool-btn"
            style={{ color: '#60a5fa' }}
            title="Edit / Draw"
            aria-label="Edit or annotate image"
          >
            <Edit2 size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Full Preview"
          style={{
            maxWidth: '90%',
            maxHeight: '85%',
            objectFit: 'contain',
            transform: `scale(${scale}) rotate(${rotation}deg)`,
            transition: 'transform 150ms cubic-bezier(0.2, 0, 0, 1)',
            boxShadow: 'var(--shadow-lg)',
            borderRadius: 'var(--radius-md)',
          }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .viewer-close-btn {
              position: absolute;
              top: 20px;
              left: 20px;
              width: 44px;
              height: 44px;
              border-radius: 9999px;
              background: #111822;
              border: 1px solid #233042;
              color: #f1f5f9;
              cursor: pointer;
              z-index: 12;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .viewer-close-btn:hover {
              background: #17202e;
            }
            .viewer-toolbar {
              max-width: calc(100vw - 120px);
            }
            .tool-btn {
              width: 36px;
              height: 36px;
              border-radius: 8px;
              border: none;
              background: transparent;
              color: #f1f5f9;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background-color 150ms ease;
            }
            .tool-btn:hover {
              background: #17202e;
            }
            @media (max-width: 768px) {
              .viewer-close-btn {
                top: max(12px, env(safe-area-inset-top));
                left: 12px;
              }
              .viewer-toolbar {
                top: calc(max(12px, env(safe-area-inset-top)) + 54px) !important;
                max-width: calc(100vw - 24px);
                gap: 4px !important;
                padding: 6px 8px !important;
                overflow-x: auto;
                scrollbar-width: none;
              }
              .viewer-toolbar::-webkit-scrollbar {
                display: none;
              }
            }
          `,
        }}
      />
    </div>
  );
}
