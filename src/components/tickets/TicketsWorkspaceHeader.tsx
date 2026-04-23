'use client';

import React from 'react';
import Link from 'next/link';
import { LayoutGrid, List, Search } from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { TicketWorkspaceTimeRange, TicketsViewMode } from '@/types/tickets';

const wrapperStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '40px',
  paddingRight: '20px',
  width: '100%',
  zIndex: 10,
};

const titleStyle: React.CSSProperties = {
  fontSize: '32px',
  fontWeight: '900',
  letterSpacing: '-1.5px',
  color: 'var(--text-main)',
  margin: 0,
};

const timeRangeToggleStyle: React.CSSProperties = {
  display: 'flex',
  background: 'var(--bg-card)',
  padding: '4px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  marginLeft: '12px',
};

const viewToggleWrapStyle: React.CSSProperties = {
  display: 'flex',
  padding: '4px',
  background: 'rgba(255,255,255,0.02)',
  borderRadius: '14px',
  border: '1px solid var(--border)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
};

const viewToggleButtonStyle: React.CSSProperties = {
  padding: '10px 24px',
  borderRadius: '10px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: '850',
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  transition: 'all 0.3s',
};

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
  const { t } = useStaffLocale();
  const timeRangeOptions: Array<{ id: TicketWorkspaceTimeRange; label: string }> = [
    { id: 'today', label: t('tickets.today') },
    { id: 'week', label: t('tickets.last7Days') },
    { id: 'month', label: t('tickets.last31Days') },
    { id: 'custom', label: t('tickets.customRange') },
  ];

  return (
    <div className="workspace-header" style={wrapperStyle}>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <h1 style={titleStyle}>
            {filterCustomerId ? t('tickets.filteredWorkspaceTitle') : t('tickets.workspaceTitle')}{' '}
            <span style={{ color: 'var(--primary)', opacity: 0.8 }}>({resultCount})</span>
            {filterCustomerId && (
              <Link
                href="/tickets"
                style={{ fontSize: '12px', marginLeft: '16px', color: 'var(--danger)', fontWeight: '800' }}
              >
                [{t('tickets.clearFilter')}]
              </Link>
            )}
          </h1>

          <div style={timeRangeToggleStyle}>
            {timeRangeOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setTimeRange(option.id)}
                style={{
                  padding: '4px 12px',
                  borderRadius: '7px',
                  fontSize: '11px',
                  fontWeight: '800',
                  border: 'none',
                  cursor: 'pointer',
                  background: timeRange === option.id ? 'var(--primary)' : 'transparent',
                  color: timeRange === option.id ? '#0a0e14' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', margin: 0 }}>
            {filterCustomerId ? t('tickets.filteredWorkspaceDescription') : t('tickets.workspaceDescription')}
          </p>
          {timeRange === 'custom' && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                animation: 'fadeIn 0.3s ease-out',
              }}
            >
              <input
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{t('tickets.to')}</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '4px 8px',
                  color: 'var(--text-main)',
                  fontSize: '11px',
                }}
              />
            </div>
          )}
        </div>

        {debugError && (
          <div style={{ color: '#ea5455', fontSize: '12px', marginTop: '8px' }}>
            {t('tickets.debugError')}: {debugError}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div className="glass" style={viewToggleWrapStyle}>
          <button
            onClick={() => setViewMode('table')}
            style={{
              ...viewToggleButtonStyle,
              background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'table' ? '#0a0e14' : 'var(--text-muted)',
            }}
          >
            <List size={16} />
            {t('tickets.list').toUpperCase()}
          </button>
          <button
            onClick={() => setViewMode('board')}
            style={{
              ...viewToggleButtonStyle,
              background: viewMode === 'board' ? 'var(--primary)' : 'transparent',
              color: viewMode === 'board' ? '#0a0e14' : 'var(--text-muted)',
            }}
          >
            <LayoutGrid size={16} />
            {t('tickets.board').toUpperCase()}
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <Search
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
            size={16}
          />
          <input
            type="text"
            placeholder={t('tickets.searchPlaceholder')}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid var(--border)',
              borderRadius: '14px',
              padding: '14px 18px 14px 48px',
              color: 'var(--text-main)',
              fontSize: '14px',
              width: '240px',
              outline: 'none',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
