'use client';

import React from 'react';
import { clsx } from 'clsx';
import styles from './ui.module.css';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Consistent page header across staff workspace pages.
 */
export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <header className={clsx(styles.pageHeader, className)}>
      <div className={styles.pageHeaderText}>
        <div className={styles.pageHeaderTitleRow}>
          <h1 className={styles.pageHeaderTitle}>{title}</h1>
          {badge}
        </div>
        {subtitle ? <p className={styles.pageHeaderSubtitle}>{subtitle}</p> : null}
      </div>
      {actions ? <div className={styles.pageHeaderActions}>{actions}</div> : null}
    </header>
  );
}
