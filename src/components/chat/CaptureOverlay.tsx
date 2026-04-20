'use client';

import Image from 'next/image';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CaptureOverlayProps {
  onCapture: (dataUrl: string) => void;
  onCancel: () => void;
}

interface ScreenshotState {
  dataUrl: string;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

function normalizeSelection(start: Point, end: Point) {
  return {
    left: Math.min(start.x, end.x),
    top: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

function clampPoint(point: Point, rect: Rect): Point {
  return {
    x: Math.min(Math.max(point.x, rect.left), rect.left + rect.width),
    y: Math.min(Math.max(point.y, rect.top), rect.top + rect.height),
  };
}

function pointInsideRect(point: Point, rect: Rect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

async function captureDisplayFrame(): Promise<ScreenshotState> {
  const mediaDevices = navigator.mediaDevices;
  if (!mediaDevices?.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser.');
  }

  const stream = await mediaDevices.getDisplayMedia({
    video: {
      frameRate: 30,
      displaySurface: 'browser',
    } as MediaTrackConstraints,
    audio: false,
  });

  const video = document.createElement('video');
  video.srcObject = stream;
  video.playsInline = true;
  video.muted = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = async () => {
        try {
          await video.play();
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      video.onerror = () => reject(new Error('Unable to read captured display.'));
    });

    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to prepare capture canvas.');
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    return {
      dataUrl: canvas.toDataURL('image/png'),
      width: canvas.width,
      height: canvas.height,
    };
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
  }
}

export default function CaptureOverlay({ onCapture, onCancel }: CaptureOverlayProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const startPointRef = useRef<Point | null>(null);
  const currentPointRef = useRef<Point | null>(null);

  const [screenshot, setScreenshot] = useState<ScreenshotState | null>(null);
  const [imageRect, setImageRect] = useState<Rect | null>(null);
  const [isPreparing, setIsPreparing] = useState(true);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Rect | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);

  useEffect(() => {
    let active = true;

    const runCapture = async () => {
      try {
        const frame = await captureDisplayFrame();
        if (!active) return;
        setScreenshot(frame);
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error && error.message
            ? error.message
            : 'Screen capture was canceled or blocked.';
        alert(message);
        onCancel();
      } finally {
        if (active) {
          setIsPreparing(false);
        }
      }
    };

    void runCapture();

    return () => {
      active = false;
    };
  }, [onCancel]);

  useLayoutEffect(() => {
    if (!screenshot) return;

    const updateRect = () => {
      const rect = imageRef.current?.getBoundingClientRect();
      if (!rect) return;
      setImageRect({
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      });
    };

    updateRect();
    window.addEventListener('resize', updateRect);

    return () => {
      window.removeEventListener('resize', updateRect);
    };
  }, [screenshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageRect || isPreparing) return;

    const point = { x: event.clientX, y: event.clientY };
    if (!pointInsideRect(point, imageRect)) return;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const clampedPoint = clampPoint(point, imageRect);
    startPointRef.current = clampedPoint;
    currentPointRef.current = clampedPoint;

    setIsSelecting(true);
    setPointer(clampedPoint);
    setSelection({
      left: clampedPoint.x,
      top: clampedPoint.y,
      width: 0,
      height: 0,
    });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageRect) return;

    const point = clampPoint({ x: event.clientX, y: event.clientY }, imageRect);
    setPointer(point);

    if (!isSelecting || !startPointRef.current) return;

    currentPointRef.current = point;
    setSelection(normalizeSelection(startPointRef.current, point));
  };

  const handlePointerUp = async (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelecting || !imageRect || !screenshot || !startPointRef.current) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const endPoint = clampPoint({ x: event.clientX, y: event.clientY }, imageRect);
    const finalSelection = normalizeSelection(startPointRef.current, endPoint);

    setIsSelecting(false);
    setSelection(finalSelection);
    setPointer(endPoint);

    if (finalSelection.width < 5 || finalSelection.height < 5) {
      return;
    }

    try {
      const image = new Image();
      image.src = screenshot.dataUrl;

      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Unable to prepare captured image.'));
      });

      const scaleX = screenshot.width / imageRect.width;
      const scaleY = screenshot.height / imageRect.height;
      const sourceX = Math.round((finalSelection.left - imageRect.left) * scaleX);
      const sourceY = Math.round((finalSelection.top - imageRect.top) * scaleY);
      const sourceWidth = Math.round(finalSelection.width * scaleX);
      const sourceHeight = Math.round(finalSelection.height * scaleY);

      const canvas = document.createElement('canvas');
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Unable to prepare crop canvas.');
      }

      context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
      );

      onCapture(canvas.toDataURL('image/png'));
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Unable to crop the captured image.';
      alert(message);
      onCancel();
    }
  };

  const handlePointerCancel = () => {
    setIsSelecting(false);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        cursor: screenshot ? 'none' : 'default',
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        userSelect: 'none',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {screenshot && (
        <Image
          ref={imageRef}
          src={screenshot.dataUrl}
          alt="Captured screen"
          unoptimized
          fill
          style={{
            objectFit: 'contain',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(0, 0, 0, 0.72)',
          color: 'white',
          padding: '8px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: '600',
          pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        }}
      >
        {isPreparing
          ? 'Select the tab or screen to capture...'
          : 'Drag to crop the captured screen. Press ESC to cancel.'}
      </div>

      {isPreparing && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(54, 153, 255, 0.92)',
            color: 'black',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '800',
            pointerEvents: 'none',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          Preparing screen capture...
        </div>
      )}

      {selection && (
        <div
          style={{
            position: 'absolute',
            left: selection.left,
            top: selection.top,
            width: selection.width,
            height: selection.height,
            border: '2px solid var(--primary)',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.42)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              bottom: '-25px',
              right: 0,
              background: 'var(--primary)',
              color: 'black',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: '900',
              whiteSpace: 'nowrap',
            }}
          >
            {Math.round(selection.width)} x {Math.round(selection.height)}
          </div>
        </div>
      )}

      {pointer && screenshot && !isPreparing && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: pointer.y,
              height: '1px',
              background: 'rgba(54, 153, 255, 0.3)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: pointer.x,
              width: '1px',
              background: 'rgba(54, 153, 255, 0.3)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: pointer.x,
              top: pointer.y,
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              border: '2px solid var(--primary)',
              background: 'rgba(54, 153, 255, 0.18)',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 0 2px rgba(0, 0, 0, 0.35)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}
    </div>
  );
}
