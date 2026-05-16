'use client';
import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { ResolveTicketModal } from '@/components/inbox/ResolveTicketModal';
import { TicketsBoard } from '@/components/tickets/TicketsBoard';
import { TicketsTable } from '@/components/tickets/TicketsTable';
import { TicketsWorkspaceHeader } from '@/components/tickets/TicketsWorkspaceHeader';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useTicketWorkspace } from '@/hooks/useTicketWorkspace';
import styles from './tickets-workspace.module.css';

const loadingContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '70vh',
};

const loadingContainerWithMessageStyle: React.CSSProperties = {
  ...loadingContainerStyle,
  flexDirection: 'column',
  gap: '16px',
};

const pageContainerStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  position: 'relative',
};

const paginationWrapStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  padding: '8px 24px 20px',
};

const paginationButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  height: '34px',
  padding: '0 12px',
  borderRadius: '10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-card)',
  color: 'var(--text-main)',
  fontSize: '12px',
  fontWeight: 700,
  cursor: 'pointer',
};

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
    openResolveModal,
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
    ticketPage,
    hasNextTicketPage,
    goToNextTicketPage,
    goToPreviousTicketPage,
  } = useTicketWorkspace(filterCustomerId);

  const previousLabel = locale === 'th' ? 'ก่อนหน้า' : 'Previous';
  const nextLabel = locale === 'th' ? 'ถัดไป' : 'Next';
  const pageLabel = locale === 'th' ? 'หน้า' : 'Page';

  if (loading) {
    return (
      <div style={loadingContainerWithMessageStyle}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)' }}>{t('tickets.loadingWorkspace')}</p>
      </div>
    );
  }

  return (
    <div className={styles.workspacePage} style={pageContainerStyle}>
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
        <div style={loadingContainerStyle}>
          <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        </div>
      }
    >
      <TicketsContent />
    </Suspense>
  );
}
