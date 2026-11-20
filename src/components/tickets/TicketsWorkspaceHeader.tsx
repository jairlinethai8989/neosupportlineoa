'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutGrid, List, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { TicketWorkspaceTimeRange, TicketsViewMode } from '@/types/tickets';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

interface TicketsWorkspaceHeaderProps {
  customEnd: string;
  customStart: string;
  debugError: string | null;
  filterCustomerId: string | null;
  resultCount: number;
  searchTerm: string;
  setCustomEnd: (value: string) => void;
  setCustomStart: (value: string) => void;
  setSearchTerm: (value: string) => void;
  setTimeRange: (value: TicketWorkspaceTimeRange) => void;
  setViewMode: (value: TicketsViewMode) => void;
  timeRange: TicketWorkspaceTimeRange;
  viewMode: TicketsViewMode;
}

export function TicketsWorkspaceHeader({
  customEnd,
  customStart,
  debugError,
  filterCustomerId,
  resultCount,
  searchTerm,
  setCustomEnd,
  setCustomStart,
  setSearchTerm,
  setTimeRange,
  setViewMode,
  timeRange,
  viewMode,
}: TicketsWorkspaceHeaderProps) {
  const { locale, t } = useStaffLocale();
  const timeRangeOptions: Array<{ id: TicketWorkspaceTimeRange; label: string }> = [
    { id: 'today', label: t('tickets.today') },
    { id: 'week', label: t('tickets.last7Days') },
    { id: 'month', label: t('tickets.last31Days') },
    { id: 'custom', label: t('tickets.customRange') },
  ];

  return (
    <header className={styles.headerWrap}>
      <div className={styles.headerTop}>
        <div className={styles.headerTitleGroup}>
          <div className={styles.headerTitleRow}>
            <h1 className={styles.headerTitle}>
              {filterCustomerId ? t('tickets.filteredWorkspaceTitle') : t('tickets.workspaceTitle')}
            </h1>
            <Badge variant="primary" size="md">
              {resultCount}
            </Badge>
            {filterCustomerId && (
              <Link href="/tickets" className={styles.clearFilterLink}>
                {t('tickets.clearFilter')}
              </Link>
            )}
          </div>
          <p className={styles.headerSubtitle}>
            {filterCustomerId
              ? t('tickets.filteredWorkspaceDescription')
              : t('tickets.workspaceDescription')}
          </p>
        </div>

        <div className={styles.toolbarRight}>
          <div className={styles.segmented} role="group" aria-label="View mode">
            <button
              type="button"
              aria-pressed={viewMode === 'table'}
              onClick={() => setViewMode('table')}
              className={clsx(
                styles.segmentedBtn,
                viewMode === 'table' && styles.segmentedBtnActive
              )}
            >
              <List size={15} aria-hidden="true" />
              <span>{t('tickets.list')}</span>
            </button>
            <button
              type="button"
              aria-pressed={viewMode === 'board'}
              onClick={() => setViewMode('board')}
              className={clsx(
                styles.segmentedBtn,
                viewMode === 'board' && styles.segmentedBtnActive
              )}
            >
              <LayoutGrid size={15} aria-hidden="true" />
              <span>{t('tickets.board')}</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.toolbarRow}>
        <div className={styles.toolbarLeft}>
          <div className={styles.segmented} role="group" aria-label="Time range">
            {timeRangeOptions.map((option) => {
              const active = timeRange === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setTimeRange(option.id)}
                  className={clsx(styles.segmentedBtn, active && styles.segmentedBtnActive)}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {timeRange === 'custom' && (
            <div className={styles.customDateRow}>
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                aria-label={locale === 'th' ? 'วันที่เริ่มต้น' : 'Start date'}
                className={styles.dateInput}
              />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {t('tickets.to')}
              </span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                aria-label={locale === 'th' ? 'วันที่สิ้นสุด' : 'End date'}
                className={styles.dateInput}
              />
            </div>
          )}
        </div>

        <div className={styles.searchBox}>
          <Search size={15} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="search"
            placeholder={t('tickets.searchPlaceholder')}
            aria-label={t('tickets.searchPlaceholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {debugError && (
        <div className={styles.debugBanner} role="alert">
          {t('tickets.debugError')}: {debugError}
        </div>
      )}
    </header>
  );
}
