'use client';

import React from 'react';
import { clsx } from 'clsx';
import styles from './ui.module.css';

export type BadgeVariant = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Renders a 6px status/project dot before the label. Pass true for currentColor or a hex/CSS color. */
  dot?: boolean | string;
}

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  neutral: styles.badgeNeutral,
  primary: styles.badgePrimary,
  success: styles.badgeSuccess,
  warning: styles.badgeWarning,
  danger: styles.badgeDanger,
  info: styles.badgeInfo,
};

const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: styles.badgeSm,
  md: styles.badgeMd,
};

/**
 * Semantic status pill with optional project color dot.
 */
export function Badge({
  variant = 'neutral',
  size = 'md',
  dot,
  className,
  children,
  ...rest
}: BadgeProps) {
  const dotColor = typeof dot === 'string' ? dot : undefined;

  return (
    <span
      className={clsx(styles.badge, VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {dot ? (
        <span
          className={styles.badgeDot}
          style={dotColor ? { backgroundColor: dotColor } : undefined}
          aria-hidden="true"
        />
      ) : null}
      {children}
    </span>
  );
}
