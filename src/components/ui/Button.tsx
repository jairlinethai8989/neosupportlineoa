'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';
import styles from './ui.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  iconOnly?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
  warning: styles.btnWarning,
};

const SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.btnSm,
  md: styles.btnMd,
  lg: styles.btnLg,
};

const ICON_ONLY_SIZE_CLASS: Record<ButtonSize, string> = {
  sm: styles.btnIconOnlySm,
  md: styles.btnIconOnlyMd,
  lg: styles.btnIconOnlyLg,
};

/**
 * Reusable Ocean Cobalt button primitive with 32/36/44px heights and loading state.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    iconOnly = false,
    disabled,
    type = 'button',
    className,
    children,
    ...rest
  },
  ref
) {
  const isDisabled = Boolean(disabled || loading);

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={clsx(
        styles.btn,
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        iconOnly && ICON_ONLY_SIZE_CLASS[size],
        fullWidth && styles.btnFull,
        className
      )}
      {...rest}
    >
      {loading ? <Loader2 size={size === 'sm' ? 14 : 16} className={styles.btnSpinner} aria-hidden="true" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
