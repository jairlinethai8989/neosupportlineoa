/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useCallback, useId } from 'react';
import Cropper from 'react-easy-crop';
import { Check, X } from 'lucide-react';
import getCroppedImg from '@/lib/utils/cropImage';
import { Button, Modal } from '@/components/ui';

interface ImageCropperProps {
  imageSrc: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export function ImageCropper({ imageSrc, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const zoomId = useId();

  const onCropCompleteHandler = useCallback((_croppedArea: any, nextCroppedAreaPixels: any) => {
    setCroppedAreaPixels(nextCroppedAreaPixels);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels, 0);
      if (croppedImage) {
        onCropComplete(croppedImage);
      }
    } catch (e) {
      console.error(e);
      alert('Error cropping image');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="ปรับขนาดรูปโปรไฟล์"
      description="ลากเพื่อจัดตำแหน่งและปรับซูมให้พอดีกับกรอบวงกลม"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} leftIcon={<X size={16} aria-hidden="true" />}>
            ยกเลิก
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            leftIcon={<Check size={16} aria-hidden="true" />}
          >
            ยืนยันการตัดรูป
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '340px',
            background: '#0b1017',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
          }}
        >
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

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-surface-subtle)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <label
            htmlFor={zoomId}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            ซูม (Zoom)
          </label>
          <input
            id={zoomId}
            type="range"
            value={zoom}
            min={1}
            max={3}
            step={0.1}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--color-primary-solid)' }}
          />
          <span
            className="mono"
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--color-text-muted)',
              minWidth: '38px',
              textAlign: 'right',
            }}
          >
            {zoom.toFixed(1)}x
          </span>
        </div>
      </div>
    </Modal>
  );
}
