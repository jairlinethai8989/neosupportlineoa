'use client';

import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  Loader2,
  MessageCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Badge, Button } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketStatus } from '@/lib/i18n/staff';
import type { TicketWorkspaceSortConfig, TicketWorkspaceTicket } from '@/types/tickets';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

type SortableColumnKey =
  | 'ticket_no'
  | 'subject'
  | 'organization'
  | 'customer'
  | 'agent'
  | 'status'
  | 'created_at';

type TableColumn = {
  key: SortableColumnKey | 'actions';
  label: string;
  noSort?: boolean;
};

function renderSortIcon(columnKey: SortableColumnKey, sortConfig: TicketWorkspaceSortConfig) {
  if (sortConfig.key !== columnKey) {
    return <ArrowUpDown size={12} style={{ opacity: 0.4 }} aria-hidden="true" />;
  }
  return sortConfig.direction === 'asc' ? (
    <ArrowUp size={12} aria-hidden="true" />
  ) : (
    <ArrowDown size={12} aria-hidden="true" />
  );
}

function getStatusBadgeVariant(status: string): BadgeVariant {
  const normalized = String(status || 'New').toLowerCase();
  if (normalized === 'new') return 'primary';
  if (normalized === 'pending') return 'danger';
  if (normalized === 'in progress' || normalized === 'escalated') return 'warning';
  if (normalized === 'resolved') return 'success';
  if (normalized === 'assigned' || normalized === 'fix completed') return 'info';
  return 'neutral';
}

interface TicketsTableProps {
  filteredTickets: TicketWorkspaceTicket[];
  getConvId: (ticket: TicketWorkspaceTicket) => string | undefined;
  handleSort: (key: string) => void;
  sortConfig: TicketWorkspaceSortConfig;
  claimingId: string | null;
  handleClaim: (ticketId: string) => void;
  isViewOnly: boolean;
}

export function TicketsTable({
  filteredTickets,
  getConvId,
  handleSort,
  sortConfig,
  claimingId,
  handleClaim,
  isViewOnly,
}: TicketsTableProps) {
  const { locale, t } = useStaffLocale();

  const columns: TableColumn[] = [
    { key: 'ticket_no', label: t('tickets.ticketId') },
    { key: 'created_at', label: locale === 'th' ? 'วันที่แจ้งงาน' : 'Created' },
    { key: 'subject', label: t('tickets.subject') },
    { key: 'organization', label: t('tickets.organization') },
    { key: 'customer', label: t('tickets.customer') },
    { key: 'agent', label: t('tickets.agent') },
    { key: 'status', label: t('tickets.status') },
    { key: 'actions', label: t('tickets.actions'), noSort: true },
  ];

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead className={styles.tableHead}>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={styles.tableTh}>
                {column.noSort ? (
                  column.label
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    className={styles.sortBtn}
                  >
                    <span>{column.label}</span>
                    {renderSortIcon(column.key as SortableColumnKey, sortConfig)}
                  </button>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((ticket) => {
            const convId = getConvId(ticket);
            const hospitalName = ticket.organizations?.name || t('tickets.noData');
            const customerName =
              ticket.customers?.display_name ||
              ticket.assigned_agent?.display_name ||
              t('tickets.noData');
            const statusLower = String(ticket.status || '').toLowerCase();

            return (
              <tr key={ticket.id} className={styles.tableRow}>
                <td className={styles.tableTd}>
                  <Link
                    href={`/tickets/${ticket.id}`}
                    className={clsx(styles.ticketNoLink, 'tabular-nums')}
                  >
                    #{ticket.ticket_no}
                  </Link>
                </td>
                <td className={styles.tableTd}>
                  {ticket.created_at ? (
                    <div>
                      <span className={clsx(styles.tableDateMain, 'tabular-nums')}>
                        {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit',
                        })}
                      </span>
                      <span className={clsx(styles.tableDateSub, 'tabular-nums')}>
                        {new Date(ticket.created_at).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--color-text-disabled)' }}>-</span>
                  )}
                </td>
                <td className={styles.tableTd} style={{ fontWeight: 500, maxWidth: 320 }}>
                  {ticket.subject}
                </td>
                <td className={clsx(styles.tableTd, styles.tableOrg)}>{hospitalName}</td>
                <td className={styles.tableTd}>{customerName}</td>
                <td className={styles.tableTd}>
                  {ticket.assigned_agent ? (
                    <span
                      className={styles.agentPill}
                      style={{
                        background:
                          ticket.assigned_agent.theme_color || 'var(--color-primary-solid)',
                      }}
                    >
                      {ticket.assigned_agent.display_name}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--color-text-disabled)' }}>{t('tickets.noData')}</span>
                  )}
                </td>
                <td className={styles.tableTd}>
                  <Badge size="sm" variant={getStatusBadgeVariant(ticket.status || 'New')} dot>
                    {translateTicketStatus(ticket.status || 'New', locale)}
                  </Badge>
                </td>
                <td className={styles.tableTd}>
                  <div className={styles.tableActions}>
                    {statusLower === 'new' && (
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={claimingId === ticket.id || isViewOnly}
                        onClick={() => handleClaim(ticket.id)}
                      >
                        {claimingId === ticket.id ? (
                          <>
                            <Loader2 className="animate-spin" size={14} aria-hidden="true" />
                            <span>{t('tickets.claiming')}</span>
                          </>
                        ) : (
                          <>
                            <Zap size={14} aria-hidden="true" />
                            <span>{t('tickets.claimTicket')}</span>
                          </>
                        )}
                      </Button>
                    )}

                    {convId &&
                      ![
                        'new',
                        'resolved',
                        'closed',
                        'pending',
                        'escalated',
                        'fix completed',
                      ].includes(statusLower) && (
                        <Link
                          href={`/inbox?cid=${convId}`}
                          title={t('tickets.openInboxChat')}
                          aria-label={t('tickets.openInboxChat')}
                          className={styles.chatPillLink}
                        >
                          <MessageCircle size={14} aria-hidden="true" />
                          <span>{locale === 'th' ? 'แชท' : 'Chat'}</span>
                        </Link>
                      )}

                    <Link
                      href={`/tickets/${ticket.id}`}
                      title={t('tickets.openTicketDetails')}
                      aria-label={t('tickets.openTicketDetails')}
                      className={styles.iconLinkBtn}
                    >
                      <ExternalLink size={15} aria-hidden="true" />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
