'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { TicketsWorkspaceHeader } from '@/components/tickets/TicketsWorkspaceHeader';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useTicketWorkspace } from '@/hooks/useTicketWorkspace';
import styles from './tickets-workspace.module.css';

const ResolveTicketModal = dynamic(
  () => import('@/components/inbox/ResolveTicketModal').then((m) => m.ResolveTicketModal),
  { ssr: false }
);

const TicketsBoard = dynamic(
  () => import('@/components/tickets/TicketsBoard').then((m) => m.TicketsBoard),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loadingCenter}>
        <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
      </div>
    ),
  }
);

const TicketsTable = dynamic(
  () => import('@/components/tickets/TicketsTable').then((m) => m.TicketsTable),
  {
    ssr: false,
    loading: () => (
      <div className={styles.loadingCenter}>
        <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
      </div>
    ),
  }
);

function TicketsContent() {
  const { locale, t } = useStaffLocale();
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get('customerId');

  const {
    availableIssueTypes,
    availableModules,
    claimingId,
    closeResolveModal,
    customEnd,
    customStart,
    debugError,
    filteredTickets,
    getConvId,
    handleClaim,
    handleExecuteResolve,
    handleSort,
    isViewOnly,
    loading,
    personalResTemplates,
    resSummary,
    resolvingTicket,
    searchTerm,
    selectedIssueType,
    selectedModule,
    setCustomEnd,
    setCustomStart,
    setResSummary,
    setSearchTerm,
    setSelectedIssueType,
    setSelectedModule,
    setTimeRange,
    setViewMode,
    showResolveModal,
    sortConfig,
    timeRange,
    viewMode,
    isChatActive,
    refresh,
  } = useTicketWorkspace(filterCustomerId);

  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => {
      setShowRetry(true);
    }, 10000);
    return () => {
      clearTimeout(timer);
      setShowRetry(false);
    };
  }, [loading]);

  if (loading) {
    return (
      <div className={styles.loadingCenter} role="status" aria-live="polite">
        <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
        <p style={{ margin: 0, fontSize: 'var(--text-sm)' }}>{t('tickets.loadingWorkspace')}</p>
        {showRetry && (
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            {locale === 'th' ? 'โหลดใหม่อีกครั้ง' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.workspacePage}>
      <TicketsWorkspaceHeader
        customEnd={customEnd}
        customStart={customStart}
        debugError={debugError}
        filterCustomerId={filterCustomerId}
        resultCount={filteredTickets.length}
        searchTerm={searchTerm}
        setCustomEnd={setCustomEnd}
        setCustomStart={setCustomStart}
        setSearchTerm={setSearchTerm}
        setTimeRange={setTimeRange}
        setViewMode={setViewMode}
        timeRange={timeRange}
        viewMode={viewMode}
      />

      {viewMode === 'board' ? (
        <TicketsBoard
          claimingId={claimingId}
          filteredTickets={filteredTickets}
          getConvId={getConvId}
          handleClaim={handleClaim}
          isViewOnly={isViewOnly}
        />
      ) : (
        <TicketsTable
          filteredTickets={filteredTickets}
          getConvId={getConvId}
          handleSort={handleSort}
          sortConfig={sortConfig}
          claimingId={claimingId}
          handleClaim={handleClaim}
          isViewOnly={isViewOnly}
        />
      )}

      <ResolveTicketModal
        open={showResolveModal}
        currentTicket={resolvingTicket}
        availableModules={availableModules}
        availableIssueTypes={availableIssueTypes}
        personalResTemplates={personalResTemplates}
        resSummary={resSummary}
        selectedModule={selectedModule}
        selectedIssueType={selectedIssueType}
        sending={loading}
        onClose={closeResolveModal}
        onConfirm={handleExecuteResolve}
        onChangeSummary={setResSummary}
        onChangeModule={setSelectedModule}
        onChangeIssueType={setSelectedIssueType}
        isChatActive={isChatActive}
      />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loadingCenter} role="status">
          <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
