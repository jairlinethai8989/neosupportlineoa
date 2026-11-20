'use client';

import React, { useEffect, useId, useRef } from 'react';
import { clsx } from 'clsx';
import { X } from 'lucide-react';
import styles from './ui.module.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  size?: ModalSize;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  closeLabel?: string;
  children: React.ReactNode;
  className?: string;
}

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: styles.modalSm,
  md: styles.modalMd,
  lg: styles.modalLg,
  xl: styles.modalXl,
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog modal with Escape-to-close, focus trap, and focus restoration.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  closeOnBackdrop = true,
  closeLabel = 'Close modal',
  children,
  className,
}: ModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const dialogEl = dialogRef.current;
    if (dialogEl) {
      const firstFocusable = dialogEl.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable || dialogEl).focus();
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalBackdrop}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={clsx(styles.modalDialog, SIZE_CLASS[size], className)}
      >
        {(title || description) && (
          <div className={styles.modalHeader}>
            <div>
              {title ? (
                <h2 id={titleId} className={styles.modalTitle}>
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className={styles.modalDescription}>
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className={styles.modalCloseBtn}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className={styles.modalBody}>{children}</div>
        {footer ? <div className={styles.modalFooter}>{footer}</div> : null}
      </div>
    </div>
  );
}
