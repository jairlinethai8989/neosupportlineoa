'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, ExternalLink, Loader2, MessageCircle, User, Zap } from 'lucide-react';
import Link from 'next/link';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketPriority, translateTicketStatus } from '@/lib/i18n/staff';
import type { TicketWorkspaceTicket } from '@/types/tickets';

const WORKFLOW = ['New', 'In Progress', 'Resolved', 'Escalated', 'Pending'] as const;

const STATUS_CONFIG: Record<string, { color: string; glow: string }> = {
  New: { color: 'var(--primary)', glow: 'rgba(8, 145, 178, 0.4)' },
  'In Progress': { color: 'var(--warning, #ff9f43)', glow: 'rgba(255, 159, 67, 0.4)' },
  Resolved: { color: 'var(--success, #28c76f)', glow: 'rgba(40, 199, 111, 0.4)' },
  Escalated: { color: 'var(--secondary, #8b5cf6)', glow: 'rgba(139, 92, 246, 0.4)' },
  Pending: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
};

const FALLBACK_STATUS_CONFIG = { color: 'var(--text-muted)', glow: 'rgba(0,0,0,0.1)' };

const boardContainerStyle: React.CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  padding: '24px',
  flex: 1,
  width: '100%',
  maxWidth: '100%',
  minHeight: '600px',
  background: 'var(--bg-card)',
  borderRadius: '32px',
  border: '1px solid var(--border)',
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-x',
};

const boardColumnsWrapStyle: React.CSSProperties = {
  display: 'flex',
  gap: '28px',
  width: 'max-content',
  alignItems: 'flex-start',
};

const columnStyle: React.CSSProperties = {
  minWidth: '340px',
  maxWidth: '340px',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
  background: 'var(--bg-input)',
  borderRadius: '24px',
  padding: '12px',
};

const columnTicketsWrapStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const cardStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderRadius: '18px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
};

const cardTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
};

const ticketLinkStyle: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: '700',
  color: 'var(--primary)',
  textDecoration: 'none',
};

const subjectStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: '700',
  lineHeight: '1.4',
  color: 'var(--text-main)',
  marginBottom: '4px',
};

const cardFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '16px',
  borderTop: '1px solid var(--border)',
};

const entityRowWrapStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '8px' };
const entityRowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };

const avatarBaseStyle: React.CSSProperties = {
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const customerAvatarStyle: React.CSSProperties = {
  ...avatarBaseStyle,
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
};

const agentAvatarStyle: React.CSSProperties = {
  ...avatarBaseStyle,
  background: 'var(--primary-transparent)',
};

const customerTextStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-main)', fontWeight: '700' };
const agentTextStyle: React.CSSProperties = { fontSize: '12px', color: 'var(--primary)', fontWeight: '800' };
const actionLinksWrapStyle: React.CSSProperties = { display: 'flex', gap: '10px' };

const iconButtonBaseStyle: React.CSSProperties = {
  width: '38px',
  height: '38px',
  borderRadius: '12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border)',
};

const messageButtonStyle: React.CSSProperties = { ...iconButtonBaseStyle, color: 'var(--primary)' };
const detailsButtonStyle: React.CSSProperties = { ...iconButtonBaseStyle, color: 'var(--text-muted)' };

const actionButtonBaseStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '14px',
  border: 'none',
  fontSize: '13px',
  fontWeight: '850',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
};

const emptyColumnStyle: React.CSSProperties = {
  border: '2px dashed var(--border)',
  borderRadius: '24px',
  height: '140px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0.5,
  textAlign: 'center',
  padding: '16px',
};

function getClaimActionState(
  ticketId: string,
  claimingId: string | null,
  isViewOnly: boolean,
  labels: { viewOnly: string; claiming: string; claim: string }
) {
  const isClaiming = claimingId === ticketId;
  const isDisabled = isClaiming || isViewOnly;

  const label = isViewOnly ? labels.viewOnly : isClaiming ? labels.claiming : labels.claim;

  const style: React.CSSProperties = {
    ...actionButtonBaseStyle,
    letterSpacing: '0.5px',
    transition: 'all 0.2s',
    background: isDisabled ? 'var(--border)' : 'var(--primary)',
    color: isDisabled ? 'var(--text-muted)' : 'black',
    boxShadow: isDisabled ? 'none' : '0 6px 20px rgba(0, 242, 254, 0.2)',
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isViewOnly ? 0.5 : 1,
  };

  return { isClaiming, isDisabled, label, style };
}

function getResolveActionState(isViewOnly: boolean, labels: { viewOnly: string; resolve: string }) {
  const style: React.CSSProperties = {
    ...actionButtonBaseStyle,
    background: isViewOnly ? 'var(--bg-input)' : 'var(--success)',
    color: 'white',
    cursor: isViewOnly ? 'not-allowed' : 'pointer',
    opacity: isViewOnly ? 0.5 : 1,
  };

  return {
    isDisabled: isViewOnly,
    label: isViewOnly ? labels.viewOnly : labels.resolve,
    style,
  };
}

function PriorityIndicator({ priority, locale }: { priority: string; locale: 'th' | 'en' }) {
  const colors: Record<string, string> = { High: '#ea5455', Medium: '#ff9f43', Low: '#00cfe8' };
  const color = colors[priority] || 'gray';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '13px' }}>{translateTicketPriority(priority, locale)}</span>
    </div>
  );
}

interface TicketsBoardProps {
  claimingId: string | null;
  filteredTickets: TicketWorkspaceTicket[];
  getConvId: (ticket: TicketWorkspaceTicket) => string | undefined;
  handleClaim: (ticketId: string) => void;
  isViewOnly: boolean;
  openResolveModal: (ticket: TicketWorkspaceTicket) => void;
}

export function TicketsBoard({
  claimingId,
  filteredTickets,
  getConvId,
  handleClaim,
  isViewOnly,
  openResolveModal,
}: TicketsBoardProps) {
  const { locale, t } = useStaffLocale();

  return (
    <div className="board-scroll-container glass" style={boardContainerStyle}>
      <div style={boardColumnsWrapStyle}>
        {WORKFLOW.map((columnId) => {
          const columnTickets = filteredTickets.filter(
            (ticket) => (ticket.status || '').toLowerCase() === columnId.toLowerCase()
          );
          const config = STATUS_CONFIG[columnId] || FALLBACK_STATUS_CONFIG;

          return (
            <div key={columnId} style={columnStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 20px',
                  background: `${config.color}15`,
                  borderRadius: '18px',
                  borderBottom: `3px solid ${config.color}`,
                  boxShadow: `0 4px 12px ${config.color}10`,
                }}
              >
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: 'var(--text-main)',
                  }}
                >
                  <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: config.color }} />
                  {translateTicketStatus(columnId, locale)}
                </h3>
                <span
                  style={{
                    fontSize: '12px',
                    fontWeight: '900',
                    color: config.color,
                    background: 'rgba(255,255,255,0.05)',
                    padding: '2px 8px',
                    borderRadius: '8px',
                  }}
                >
                  {columnTickets.length}
                </span>
              </div>

              <div style={columnTicketsWrapStyle}>
                <AnimatePresence mode="popLayout">
                  {columnTickets.map((ticket) => {
                    const convId = getConvId(ticket);
                    const normalizedStatus = String(ticket.status || '').toLowerCase();
                    const isNew = normalizedStatus === 'new';
                    const isInProgress = normalizedStatus === 'in progress';
                    const hospitalName = ticket.hospitals?.name || t('tickets.noHospital');
                    const claimAction = getClaimActionState(ticket.id, claimingId, isViewOnly, {
                      viewOnly: t('tickets.viewOnlyAccess'),
                      claiming: t('tickets.claiming'),
                      claim: t('tickets.claimTicket'),
                    });
                    const resolveAction = getResolveActionState(isViewOnly, {
                      viewOnly: t('tickets.viewOnlyAccess'),
                      resolve: t('tickets.resolveTicket'),
                    });

                    return (
                      <motion.div
                        key={ticket.id}
                        layout
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
                        className="glass-interactive"
                        style={{ ...cardStyle, borderLeft: `6px solid ${config.color}` }}
                      >
                        <div style={cardTopRowStyle}>
                          <Link href={`/tickets/${ticket.id}`} style={ticketLinkStyle}>
                            #{ticket.ticket_no}
                          </Link>
                          <PriorityIndicator priority={ticket.priority || ''} locale={locale} />
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px' }}>◌</span>
                            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--warning, #ff9f43)' }}>
                              {hospitalName}
                            </span>
                          </div>
                          <h4 style={subjectStyle}>{ticket.subject}</h4>
                        </div>

                        <div style={cardFooterStyle}>
                          <div style={entityRowWrapStyle}>
                            <div style={entityRowStyle}>
                              <div style={customerAvatarStyle}>
                                <User size={14} color="var(--text-muted)" />
                              </div>
                              <span style={customerTextStyle}>
                                {ticket.customers?.full_name || ticket.customers?.display_name || t('tickets.noData')}
                                {ticket.customers?.line_username && (
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginLeft: '4px' }}>
                                    ({ticket.customers.line_username})
                                  </span>
                                )}
                              </span>
                            </div>
                            <div style={entityRowStyle}>
                              <div style={agentAvatarStyle}>
                                <CheckCircle size={14} color="var(--primary)" />
                              </div>
                              <span style={agentTextStyle}>
                                {ticket.assigned_agent?.display_name || t('tickets.noData')}
                              </span>
                            </div>
                          </div>

                          <div style={actionLinksWrapStyle}>
                            {convId && !['resolved', 'closed', 'pending', 'escalated'].includes(normalizedStatus) && (
                                <Link
                                  href={`/inbox?cid=${convId}&tid=${ticket.id}`}
                                title={t('tickets.openInboxChat')}
                                className="glass-interactive flex-center"
                                style={messageButtonStyle}
                              >
                                <MessageCircle size={16} />
                              </Link>
                            )}
                            <Link
                              href={`/tickets/${ticket.id}`}
                              title={t('tickets.openTicketDetails')}
                              className="glass-interactive flex-center"
                              style={detailsButtonStyle}
                            >
                              <ExternalLink size={16} />
                            </Link>
                          </div>
                        </div>

                        {isNew && (
                          <button
                            disabled={claimAction.isDisabled}
                            onClick={() => handleClaim(ticket.id)}
                            style={claimAction.style}
                          >
                            {claimAction.isClaiming ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                            {claimAction.label}
                          </button>
                        )}

                        {isInProgress && (
                          <button
                            disabled={resolveAction.isDisabled}
                            onClick={() => openResolveModal(ticket)}
                            style={resolveAction.style}
                          >
                            <CheckCircle size={16} />
                            {resolveAction.label}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {columnTickets.length === 0 && (
                  <div style={emptyColumnStyle}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>
                      {t('tickets.emptyColumn')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
