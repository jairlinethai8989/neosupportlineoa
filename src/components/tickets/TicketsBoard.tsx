'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Loader2,
  MessageCircle,
  User,
  UserCheck,
  Zap,
} from 'lucide-react';
import Link from 'next/link';
import { clsx } from 'clsx';
import { Badge, Button } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketPriority, translateTicketStatus } from '@/lib/i18n/staff';
import type { TicketWorkspaceTicket } from '@/types/tickets';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

// Column order in the workspace board.
// Keep "Resolved" ("ปิดแล้ว") next to "In Progress" ("กำลังดำเนินงาน") for faster scanning.
const WORKFLOW = ['New', 'In Progress', 'Resolved', 'Escalated', 'Fix Completed', 'Pending'] as const;

const STATUS_ACCENT: Record<string, string> = {
  New: 'var(--color-primary)',
  'In Progress': 'var(--color-warning)',
  Resolved: 'var(--color-success)',
  Escalated: 'var(--color-info)',
  'Fix Completed': 'var(--color-info)',
  Pending: 'var(--color-danger)',
};

function getTicketDuration(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function PriorityBadge({ priority, locale }: { priority: string; locale: 'th' | 'en' }) {
  const p = String(priority || 'medium').toLowerCase().trim();
  const variant =
    p === 'critical' || p === 'วิกฤต'
      ? 'danger'
      : p === 'high' || p === 'สูง'
        ? 'warning'
        : p === 'medium' || p === 'ปกติ' || p === 'กลาง'
          ? 'info'
          : 'neutral';

  return (
    <Badge size="sm" variant={variant} dot>
      {translateTicketPriority(priority || 'Medium', locale)}
    </Badge>
  );
}

interface TicketsBoardProps {
  claimingId: string | null;
  filteredTickets: TicketWorkspaceTicket[];
  getConvId: (ticket: TicketWorkspaceTicket) => string | undefined;
  handleClaim: (ticketId: string) => void;
  isViewOnly: boolean;
}

export function TicketsBoard({
  claimingId,
  filteredTickets,
  getConvId,
  handleClaim,
  isViewOnly,
}: TicketsBoardProps) {
  const { locale, t } = useStaffLocale();
  const boardRef = React.useRef<HTMLDivElement>(null);
  const [columnPages, setColumnPages] = React.useState<Record<string, number>>({});

  const isDown = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }

    isDown.current = true;
    const board = boardRef.current;
    if (board) {
      board.style.cursor = 'grabbing';
      board.style.userSelect = 'none';
      startX.current = e.pageX - board.offsetLeft;
      scrollLeft.current = board.scrollLeft;
    }
  };

  const resetDrag = () => {
    isDown.current = false;
    const board = boardRef.current;
    if (board) {
      board.style.cursor = 'grab';
      board.style.removeProperty('user-select');
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDown.current) return;
    e.preventDefault();
    const board = boardRef.current;
    if (board) {
      const x = e.pageX - board.offsetLeft;
      const walk = (x - startX.current) * 1.5;
      board.scrollLeft = scrollLeft.current - walk;
    }
  };

  return (
    <div
      ref={boardRef}
      className={clsx(styles.boardContainer, 'custom-scrollbar')}
      onMouseDown={handleMouseDown}
      onMouseLeave={resetDrag}
      onMouseUp={resetDrag}
      onMouseMove={handleMouseMove}
    >
      <div className={styles.boardColumnsWrap}>
        {WORKFLOW.map((columnId) => {
          const columnTickets = filteredTickets.filter(
            (ticket) => (ticket.status || '').toLowerCase() === columnId.toLowerCase()
          );
          const accent = STATUS_ACCENT[columnId] || 'var(--color-text-muted)';

          const COLUMN_PAGE_SIZE = 10;
          const currentPage = columnPages[columnId] || 1;
          const totalPages = Math.ceil(columnTickets.length / COLUMN_PAGE_SIZE);

          const paginatedTickets = columnTickets.slice(
            (currentPage - 1) * COLUMN_PAGE_SIZE,
            currentPage * COLUMN_PAGE_SIZE
          );

          return (
            <section
              key={columnId}
              aria-label={translateTicketStatus(columnId, locale)}
              className={styles.boardColumn}
              style={{ '--col-accent': accent } as React.CSSProperties}
            >
              <div className={styles.boardColumnHeader}>
                <h2 className={styles.boardColumnTitle}>
                  <span className={styles.boardColumnDot} aria-hidden="true" />
                  <span>{translateTicketStatus(columnId, locale)}</span>
                </h2>

                <div className={styles.boardColumnControls}>
                  {totalPages > 1 && (
                    <div className={styles.columnPager}>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        disabled={currentPage === 1}
                        onClick={() =>
                          setColumnPages((prev) => ({
                            ...prev,
                            [columnId]: Math.max(1, currentPage - 1),
                          }))
                        }
                        aria-label={locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                      >
                        <ChevronLeft size={14} aria-hidden="true" />
                      </Button>
                      <span className={clsx(styles.columnPagerLabel, 'tabular-nums')}>
                        {currentPage}/{totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setColumnPages((prev) => ({
                            ...prev,
                            [columnId]: Math.min(totalPages, currentPage + 1),
                          }))
                        }
                        aria-label={locale === 'th' ? 'ถัดไป' : 'Next'}
                      >
                        <ChevronRight size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  )}

                  <Badge size="sm" variant="neutral">
                    {columnTickets.length}
                  </Badge>
                </div>
              </div>

              <div className={clsx(styles.boardCardsWrap, 'column-scroll-container')}>
                <AnimatePresence mode="popLayout">
                  {paginatedTickets.map((ticket) => {
                    const convId = getConvId(ticket);
                    const normalizedStatus = String(ticket.status || '').toLowerCase();
                    const isNew = normalizedStatus === 'new';
                    const isInProgress = normalizedStatus === 'in progress';
                    const chatHref = convId
                      ? `/inbox?cid=${convId}&tid=${ticket.id}`
                      : `/inbox?tid=${ticket.id}`;
                    const hospitalName = ticket.organizations?.name || t('tickets.noHospital');
                    const isClaiming = claimingId === ticket.id;
                    const isClaimDisabled = isClaiming || isViewOnly;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const customer = ticket.customers as any;

                    return (
                      <motion.article
                        key={ticket.id}
                        layout
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.15 } }}
                        className={styles.ticketCard}
                      >
                        <div className={styles.cardTopRow}>
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className={clsx(styles.ticketNoLink, 'tabular-nums')}
                          >
                            #{ticket.ticket_no}
                          </Link>
                          <PriorityBadge priority={ticket.priority || ''} locale={locale} />
                        </div>

                        {ticket.created_at && (
                          <div className={styles.cardDateRow}>
                            <span className="tabular-nums">
                              {new Date(ticket.created_at).toLocaleDateString('th-TH', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                              })}{' '}
                              •{' '}
                              {new Date(ticket.created_at).toLocaleTimeString('th-TH', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false,
                              })}
                            </span>
                            <span className={clsx(styles.durationChip, 'tabular-nums')}>
                              <Clock size={11} aria-hidden="true" />
                              {getTicketDuration(ticket.created_at)}
                            </span>
                          </div>
                        )}

                        <div className={styles.cardOrg}>{hospitalName}</div>
                        <h3 className={styles.cardSubject}>{ticket.subject}</h3>

                        <div className={styles.cardFooter}>
                          <div className={styles.cardEntities}>
                            <div className={styles.entityRow}>
                              <span className={styles.entityIcon} aria-hidden="true">
                                <User size={11} />
                              </span>
                              <span className={styles.entityName}>
                                {customer?.full_name || customer?.display_name || t('tickets.noData')}
                              </span>
                            </div>

                            <div className={styles.entityRow}>
                              <span className={styles.entityIcon} aria-hidden="true">
                                <UserCheck size={11} />
                              </span>
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
                                <span>{t('tickets.noData')}</span>
                              )}
                            </div>
                          </div>

                          <div className={styles.cardActions}>
                            {isNew && (
                              <Button
                                size="sm"
                                variant="primary"
                                iconOnly
                                disabled={isClaimDisabled}
                                onClick={() => handleClaim(ticket.id)}
                                title={
                                  isViewOnly
                                    ? t('tickets.viewOnlyAccess')
                                    : isClaiming
                                      ? t('tickets.claiming')
                                      : t('tickets.claimTicket')
                                }
                                aria-label={t('tickets.claimTicket')}
                              >
                                {isClaiming ? (
                                  <Loader2 className="animate-spin" size={14} aria-hidden="true" />
                                ) : (
                                  <Zap size={14} aria-hidden="true" />
                                )}
                              </Button>
                            )}

                            {!isNew &&
                              (isInProgress ||
                                (convId &&
                                  ![
                                    'resolved',
                                    'closed',
                                    'pending',
                                    'escalated',
                                    'fix completed',
                                  ].includes(normalizedStatus))) && (
                                <Link
                                  href={chatHref}
                                  title={t('tickets.openInboxChat')}
                                  aria-label={t('tickets.openInboxChat')}
                                  className={clsx(styles.iconLinkBtn, styles.iconLinkBtnPrimary)}
                                >
                                  <MessageCircle size={15} aria-hidden="true" />
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
                        </div>
                      </motion.article>
                    );
                  })}
                </AnimatePresence>

                {columnTickets.length === 0 && (
                  <div className={styles.emptyColumn}>{t('tickets.emptyColumn')}</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
