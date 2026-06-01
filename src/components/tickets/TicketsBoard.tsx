'use client';

import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ExternalLink, Loader2, MessageCircle, User, UserCheck, Zap } from 'lucide-react';
import Link from 'next/link';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketPriority, translateTicketStatus } from '@/lib/i18n/staff';
import type { TicketWorkspaceTicket } from '@/types/tickets';

// Column order in the workspace board.
// Keep "Resolved" ("ปิดแล้ว") next to "In Progress" ("กำลังดำเนินงาน") for faster scanning.
const WORKFLOW = ['New', 'In Progress', 'Resolved', 'Escalated', 'Fix Completed', 'Pending'] as const;

const STATUS_CONFIG: Record<string, { color: string; glow: string }> = {
  New: { color: 'var(--primary)', glow: 'rgba(8, 145, 178, 0.4)' },
  'In Progress': { color: 'var(--warning, #ff9f43)', glow: 'rgba(255, 159, 67, 0.4)' },
  Resolved: { color: 'var(--success, #28c76f)', glow: 'rgba(40, 199, 111, 0.4)' },
  Escalated: { color: 'var(--secondary, #8b5cf6)', glow: 'rgba(139, 92, 246, 0.4)' },
  'Fix Completed': { color: '#00cfe8', glow: 'rgba(0, 207, 232, 0.4)' },
  Pending: { color: '#ef4444', glow: 'rgba(239, 68, 68, 0.4)' },
};

const FALLBACK_STATUS_CONFIG = { color: 'var(--text-muted)', glow: 'rgba(0,0,0,0.1)' };

function getTicketDuration(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} นาที`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  if (hours < 24) return `${hours} ชม. ${remainingMins} น.`;
  const days = Math.floor(hours / 24);
  return `${days} วัน`;
}

const boardContainerStyle: React.CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  overflowY: 'visible',
  padding: '24px',
  height: 'auto',
  minHeight: '800px',
  width: '100%',
  maxWidth: '100%',
  background: 'var(--bg-card)',
  borderRadius: '32px',
  border: '1px solid var(--border)',
  WebkitOverflowScrolling: 'touch',
  touchAction: 'pan-x',
  cursor: 'grab',
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
  maxHeight: 'calc(100vh - 120px)',
  height: 'auto',
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg-input)',
  borderRadius: '24px',
  padding: '0',
  position: 'relative',
  overflow: 'hidden',
};

const columnTicketsWrapStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
  padding: '16px 12px 24px',
  overflowY: 'auto',
  overflowX: 'hidden',
};

const cardStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '14px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
  flexShrink: 0,
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
  paddingTop: '6px',
  marginTop: '2px',
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
  background: 'rgba(255, 159, 67, 0.1)',
  border: '1px solid rgba(255, 159, 67, 0.2)',
};

const agentAvatarStyle: React.CSSProperties = {
  ...avatarBaseStyle,
  background: 'rgba(0, 207, 232, 0.1)',
  border: '1px solid rgba(0, 207, 232, 0.2)',
};

const customerTextStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-main)', fontWeight: '700' };
const agentTextStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--primary)', fontWeight: '800' };
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
  padding: '8px',
  borderRadius: '10px',
  border: 'none',
  fontSize: '12px',
  fontWeight: '800',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '6px',
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

function PriorityIndicator({ priority, locale }: { priority: string; locale: 'th' | 'en' }) {
  // Map both English and Thai keys to ensure colors match regardless of data source
  const colors: Record<string, string> = { 
    critical: '#ea5455', // Red
    'วิกฤต': '#ea5455',   // Red (Thai)
    high: '#ff9f43',     // Orange
    'สูง': '#ff9f43',      // Orange (Thai)
    medium: '#00cfe8',   // Blue
    'ปกติ': '#00cfe8',     // Blue (Thai)
    low: '#b9c3cd',      // Grey
    'ต่ำ': '#b9c3cd'       // Grey (Thai)
  };

  const p = String(priority || 'medium').toLowerCase().trim();
  const color = colors[p] || '#b9c3cd';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div 
        style={{ 
          width: '7px', 
          height: '7px', 
          borderRadius: '50%', 
          background: color, 
          boxShadow: color !== '#b9c3cd' ? `0 0 10px ${color}60` : 'none',
          transition: 'all 0.3s ease'
        }} 
      />
      <span style={{ 
        fontSize: '11px', 
        fontWeight: '850', 
        color: color,
        textShadow: color !== '#b9c3cd' ? `0 0 10px ${color}20` : 'none'
      }}>
        {translateTicketPriority(priority, locale)}
      </span>
    </div>
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

  // Mouse Drag to Scroll Horizontal Board
  const isDown = React.useRef(false);
  const startX = React.useRef(0);
  const scrollLeft = React.useRef(0);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('input')
    ) {
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

  const handleMouseLeave = () => {
    isDown.current = false;
    const board = boardRef.current;
    if (board) {
      board.style.cursor = 'grab';
      board.style.removeProperty('user-select');
    }
  };

  const handleMouseUp = () => {
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
      const walk = (x - startX.current) * 1.5; // multiplier for speed
      board.scrollLeft = scrollLeft.current - walk;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div 
        ref={boardRef}
        className="board-scroll-container custom-scrollbar glass" 
        style={boardContainerStyle}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
      <div style={boardColumnsWrapStyle}>
        {WORKFLOW.map((columnId) => {
          const columnTickets = filteredTickets.filter(
            (ticket) => (ticket.status || '').toLowerCase() === columnId.toLowerCase()
          );
          const config = STATUS_CONFIG[columnId] || FALLBACK_STATUS_CONFIG;

          const COLUMN_PAGE_SIZE = 10;
          const currentPage = columnPages[columnId] || 1;
          const totalPages = Math.ceil(columnTickets.length / COLUMN_PAGE_SIZE);

          const paginatedTickets = columnTickets.slice(
            (currentPage - 1) * COLUMN_PAGE_SIZE,
            currentPage * COLUMN_PAGE_SIZE
          );

          return (
            <div key={columnId} style={columnStyle}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '18px 20px',
                  background: 'var(--bg-input)',
                  borderRadius: '24px 24px 0 0',
                  borderBottom: `2px solid ${config.color}`,
                  boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
                  zIndex: 5,
                  flexShrink: 0,
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {totalPages > 1 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      padding: '3px 6px',
                      marginRight: '6px',
                      boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)'
                    }}>
                      <button
                        onClick={() => setColumnPages((prev) => ({ ...prev, [columnId]: Math.max(1, currentPage - 1) }))}
                        disabled={currentPage === 1}
                        className="glass-interactive flex-center"
                        style={{
                          width: '28px',
                          height: '28px',
                          background: currentPage === 1 ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: currentPage === 1 ? 'var(--text-dim)' : config.color,
                          cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: currentPage === 1 ? 0.2 : 1,
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: currentPage === 1 ? 'none' : `0 2px 8px ${config.glow}`,
                        }}
                        title={locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        color: 'var(--text-main)',
                        minWidth: '32px',
                        textAlign: 'center',
                        letterSpacing: '0.5px'
                      }}>
                        {currentPage}<span style={{ color: 'var(--text-dim)', fontWeight: '500', margin: '0 1px' }}>/</span>{totalPages}
                      </span>
                      <button
                        onClick={() => setColumnPages((prev) => ({ ...prev, [columnId]: Math.min(totalPages, currentPage + 1) }))}
                        disabled={currentPage === totalPages}
                        className="glass-interactive flex-center"
                        style={{
                          width: '28px',
                          height: '28px',
                          background: currentPage === totalPages ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: currentPage === totalPages ? 'var(--text-dim)' : config.color,
                          cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: currentPage === totalPages ? 0.2 : 1,
                          transition: 'all 0.2s ease-in-out',
                          boxShadow: currentPage === totalPages ? 'none' : `0 2px 8px ${config.glow}`,
                        }}
                        title={locale === 'th' ? 'ถัดไป' : 'Next'}
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
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
              </div>

              <div style={columnTicketsWrapStyle} className="column-scroll-container">
                <AnimatePresence mode="popLayout">
                  {paginatedTickets.map((ticket) => {
                    const convId = getConvId(ticket);
                    const normalizedStatus = String(ticket.status || '').toLowerCase();
                    const isNew = normalizedStatus === 'new';
                    const isInProgress = normalizedStatus === 'in progress';
                    const chatHref = convId
                      ? `/inbox?cid=${convId}&tid=${ticket.id}`
                      : `/inbox?tid=${ticket.id}`;
                    const hospitalName = ticket.hospitals?.name || t('tickets.noHospital');
                    const claimAction = getClaimActionState(ticket.id, claimingId, isViewOnly, {
                      viewOnly: t('tickets.viewOnlyAccess'),
                      claiming: t('tickets.claiming'),
                      claim: t('tickets.claimTicket'),
                    });

                    return (
                      <motion.div
                        key={ticket.id}
                        layout
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, transition: { duration: 0.2 } }}
                        whileHover={{ y: -4, boxShadow: '0 20px 40px rgba(0,0,0,0.12)' }}
                        className="glass-interactive"
                        style={{ ...cardStyle, borderLeft: `6px solid ${config.color}` }}
                      >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', marginBottom: '6px' }}>
                            {/* Row 1: Ticket No & Priority */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Link href={`/tickets/${ticket.id}`} style={ticketLinkStyle}>
                                #{ticket.ticket_no}
                              </Link>
                              <PriorityIndicator priority={ticket.priority || ''} locale={locale} />
                            </div>
                            
                            {/* Row 2: Date/Time & Duration */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {ticket.created_at && (
                                <span style={{ fontSize: '9px', color: 'var(--text-dim)', fontWeight: '600' }}>
                                  {new Date(ticket.created_at).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: '2-digit' })} • {new Date(ticket.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                                </span>
                              )}
                              {ticket.created_at && (
                                <span style={{ fontSize: '9px', color: 'var(--primary)', fontWeight: '800', background: 'var(--primary-transparent)', padding: '2px 6px', borderRadius: '6px' }}>
                                  ⏱️ {getTicketDuration(ticket.created_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', marginBottom: '2px' }}>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--warning, #ff9f43)' }}>
                                {hospitalName}
                              </span>
                            </div>
                            <h4 style={{ ...subjectStyle, fontSize: '12px', marginBottom: '2px' }}>{ticket.subject}</h4>
                          </div>

                        <div style={cardFooterStyle}>
                          <div style={entityRowWrapStyle}>
                            <div style={{ ...entityRowStyle, cursor: 'help' }} title="ผู้แจ้งงาน">
                              <div style={customerAvatarStyle} title="ผู้แจ้งงาน">
                                <User size={12} color="#ff9f43" />
                              </div>
                              <span style={customerTextStyle}>
                                {(() => {
                                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                  const customer = ticket.customers as any;
                                  return (
                                    <>
                                      {customer?.full_name || customer?.display_name || t('tickets.noData')}
                                      {customer?.line_username && (
                                        <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '500', marginLeft: '4px' }}>
                                          ({customer.line_username})
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </span>
                            </div>
                            <div style={{ ...entityRowStyle, cursor: 'help' }} title="ผู้รับงาน">
                                  <div style={agentAvatarStyle} title="ผู้รับงาน">
                                    <UserCheck size={12} color="var(--primary)" />
                                  </div>
                                  {ticket.assigned_agent ? (
                                    <span style={{ 
                                      color: '#ffffff', 
                                      background: ticket.assigned_agent.theme_color || 'var(--primary)', 
                                      padding: '4px 10px',
                                      borderRadius: '8px',
                                      fontSize: '11px',
                                      fontWeight: '800',
                                      textTransform: 'uppercase',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                    }}>
                                      {ticket.assigned_agent.display_name}
                                    </span>
                                  ) : (
                                    <span style={agentTextStyle}>
                                      {t('tickets.noData')}
                                    </span>
                                  )}
                            </div>
                          </div>

                          <div style={actionLinksWrapStyle}>
                            {isNew && (
                                <button
                                    disabled={claimAction.isDisabled}
                                    onClick={() => handleClaim(ticket.id)}
                                    title={claimAction.label}
                                    className="glass-interactive flex-center"
                                    style={{ 
                                        ...messageButtonStyle, 
                                        background: 'var(--primary)', 
                                        color: 'black',
                                        boxShadow: '0 4px 12px rgba(0, 242, 254, 0.2)',
                                        border: 'none',
                                        cursor: claimAction.isDisabled ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {claimAction.isClaiming ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                                </button>
                            )}

                            {!isNew && (isInProgress || (convId && !['resolved', 'closed', 'pending', 'escalated'].includes(normalizedStatus))) && (
                                <Link
                                  href={chatHref}
                                  title={t('tickets.openInboxChat')}
                                  className="glass-interactive flex-center"
                                  style={{ ...messageButtonStyle, color: 'white', background: config.color, border: 'none' }}
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
  </div>
  );
}
