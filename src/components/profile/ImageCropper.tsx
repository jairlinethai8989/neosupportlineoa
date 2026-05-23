/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';
import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from '@/lib/utils/cropImage';
import { Check, X } from 'lucide-react';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropCompleteHandler = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleSave = async () => {
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
      alert('Error cropping image');
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ position: 'relative', width: '90%', maxWidth: '500px', height: '60vh', background: '#333', borderRadius: '16px', overflow: 'hidden' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onCropComplete={onCropCompleteHandler}
          onZoomChange={setZoom}
        />
      </div>
      
      <div style={{ display: 'flex', gap: '16px', marginTop: '24px', background: 'var(--bg-card)', padding: '16px 24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '32px' }}>
          <label style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ซูม (Zoom)</label>
          <input
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            aria-labelledby="Zoom"
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ width: '150px' }}
          />
        </div>
        
        <button onClick={onCancel} style={{ padding: '10px 20px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <X size={18} /> ยกเลิก
        </button>
        <button onClick={handleSave} style={{ padding: '10px 20px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
          <Check size={18} /> ยืนยันการตัดรูป
        </button>
      </div>
    </div>
  );
}
