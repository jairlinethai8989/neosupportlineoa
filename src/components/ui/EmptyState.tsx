'use client';

import React from 'react';
import { clsx } from 'clsx';
import styles from './ui.module.css';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

/**
 * Empty state container for queues, tables, and filtered search results.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={clsx(styles.emptyState, compact && styles.emptyStateCompact, className)}>
      {icon ? <div className={styles.emptyStateIcon}>{icon}</div> : null}
      <p className={styles.emptyStateTitle}>{title}</p>
      {description ? <p className={styles.emptyStateDescription}>{description}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}
