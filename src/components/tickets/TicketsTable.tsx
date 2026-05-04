'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, Loader2, MessageCircle, Zap } from 'lucide-react';
import Link from 'next/link';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketStatus } from '@/lib/i18n/staff';
import type { TicketWorkspaceSortConfig, TicketWorkspaceTicket } from '@/types/tickets';

type SortableColumnKey = 'ticket_no' | 'subject' | 'hospital' | 'customer' | 'agent' | 'status' | 'created_at';
type TableColumn = {
  key: SortableColumnKey | 'actions';
  label: string;
  noSort?: boolean;
};

const tableWrapStyle: React.CSSProperties = { overflowX: 'auto', padding: '1px' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', textAlign: 'left' };
const tableHeadStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.03)',
  borderBottom: '1px solid var(--border)',
};

const tableHeadCellStyle: React.CSSProperties = {
  padding: '16px 20px',
  fontSize: '11px',
  fontWeight: '800',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  userSelect: 'none',
};

const sortLabelWrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px' };
const sortIconWrapStyle: React.CSSProperties = { display: 'flex', alignItems: 'center' };
const rowStyle: React.CSSProperties = { borderBottom: '1px solid var(--border)' };
const cellStyle: React.CSSProperties = { padding: '16px 20px' };
const subjectCellStyle: React.CSSProperties = { ...cellStyle, fontSize: '14px', fontWeight: '500' };
const hospitalCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontSize: '13px',
  fontWeight: '700',
  color: 'var(--primary)',
};
const ticketLinkStyle: React.CSSProperties = { fontSize: '13px', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' };
const actionWrapStyle: React.CSSProperties = { display: 'flex', gap: '8px' };

const actionButtonBaseStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
};

const messageActionButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  width: '36px',
  height: '36px',
  color: 'var(--primary)',
  background: 'var(--primary-transparent)',
  border: '1px solid var(--primary)',
};

const detailsActionButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  color: 'var(--text-muted)',
};

function renderSortIcon(columnKey: SortableColumnKey, sortConfig: TicketWorkspaceSortConfig) {
  if (sortConfig.key !== columnKey) {
    return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
  }
  return sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

function getStatusColor(status: string) {
  const normalized = String(status || 'New').toLowerCase();
  const colors: Record<string, string> = {
    new: 'var(--primary)',
    pending: '#ea5455',
    assigned: '#3699FF',
    'in progress': '#ff9f43',
    resolved: '#28c76f',
    closed: '#94a3b8',
    escalated: '#7367f0',
  };
  return colors[normalized] || 'gray';
}

function StatusBadge({ status, locale }: { status: string; locale: 'th' | 'en' }) {
  const color = getStatusColor(status);
  const label = translateTicketStatus(status || 'New', locale);
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: '850',
        textTransform: 'uppercase',
        background: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      {label}
    </span>
  );
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
    { key: 'created_at', label: 'วันที่แจ้งงาน' },
    { key: 'subject', label: t('tickets.subject') },
    { key: 'hospital', label: t('tickets.hospital') },
    { key: 'customer', label: t('tickets.customer') },
    { key: 'agent', label: t('tickets.agent') },
    { key: 'status', label: t('tickets.status') },
    { key: 'actions', label: t('tickets.actions'), noSort: true },
  ];

  return (
    <div className="glass board-scroll-container" style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead style={tableHeadStyle}>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                onClick={() => !column.noSort && handleSort(column.key)}
                style={{
                  ...tableHeadCellStyle,
                  cursor: column.noSort ? 'default' : 'pointer',
                }}
              >
                <div style={sortLabelWrapStyle}>
                  {column.label}
                  {!column.noSort && (
                    <span style={sortIconWrapStyle}>
                      {renderSortIcon(column.key as SortableColumnKey, sortConfig)}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredTickets.map((ticket) => {
            const convId = getConvId(ticket);
            const hospitalName = ticket.hospitals?.name || t('tickets.noData');
            const customerName =
              ticket.customers?.display_name ||
              ticket.assigned_agent?.display_name ||
              t('tickets.noData');

            return (
              <tr key={ticket.id} style={rowStyle}>
                <td style={cellStyle}>
                  <Link href={`/tickets/${ticket.id}`} style={ticketLinkStyle}>
                    #{ticket.ticket_no}
                  </Link>
                </td>
                <td style={cellStyle}>
                  {ticket.created_at ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)' }}>
                        {new Date(ticket.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {new Date(ticket.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                      </span>
                    </div>
                  ) : (
                    <span style={{ opacity: 0.3 }}>-</span>
                  )}
                </td>
                <td style={subjectCellStyle}>{ticket.subject}</td>
                <td style={hospitalCellStyle}>{hospitalName}</td>
                <td style={cellStyle}>{customerName}</td>
                <td style={cellStyle}>
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
                    <span style={{ opacity: 0.3 }}>{t('tickets.noData')}</span>
                  )}
                </td>
                <td style={cellStyle}>
                  <StatusBadge status={ticket.status || ''} locale={locale} />
                </td>
                <td style={cellStyle}>
                  <div style={actionWrapStyle}>
                    {/* ปุ่มรับงาน: แสดงเฉพาะ New */}
                    {String(ticket.status || '').toLowerCase() === 'new' && (
                      <button
                        disabled={claimingId === ticket.id || isViewOnly}
                        onClick={() => handleClaim(ticket.id)}
                        className="glass-interactive flex-center"
                        style={{
                          height: '36px',
                          padding: '0 14px',
                          borderRadius: '10px',
                          border: 'none',
                          background: (claimingId === ticket.id || isViewOnly) ? 'var(--border)' : 'var(--primary)',
                          color: (claimingId === ticket.id || isViewOnly) ? 'var(--text-muted)' : '#000',
                          fontSize: '12px',
                          fontWeight: '850',
                          cursor: (claimingId === ticket.id || isViewOnly) ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          opacity: isViewOnly ? 0.5 : 1,
                          boxShadow: (claimingId === ticket.id || isViewOnly) ? 'none' : '0 4px 14px rgba(8,145,178,0.3)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {claimingId === ticket.id
                          ? <><Loader2 className="animate-spin" size={14} />{t('tickets.claiming')}</>
                          : <><Zap size={14} />{t('tickets.claimTicket')}</>}
                      </button>
                    )}
                    {convId && !['new', 'resolved', 'closed', 'pending', 'escalated'].includes(String(ticket.status || '').toLowerCase()) && (
                      <Link
                        href={`/inbox?cid=${convId}`}
                        title={t('tickets.openInboxChat')}
                        className="glass-interactive flex-center"
                        style={{ 
                          ...messageActionButtonStyle, 
                          width: 'auto',
                          padding: '0 12px',
                          gap: '6px',
                          color: getStatusColor(ticket.status || ''), 
                          background: `${getStatusColor(ticket.status || '')}20`,
                          border: `1px solid ${getStatusColor(ticket.status || '')}50`
                        }}
                      >
                        <MessageCircle size={16} />
                        <span style={{ fontSize: '12px', fontWeight: '800' }}>แชท</span>
                      </Link>
                    )}
                    <Link
                      href={`/tickets/${ticket.id}`}
                      title={t('tickets.openTicketDetails')}
                      className="glass-interactive flex-center"
                      style={detailsActionButtonStyle}
                    >
                      <ExternalLink size={16} />
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
