'use client';

import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import type { TicketWorkspaceSortConfig, TicketWorkspaceTicket } from '@/types/tickets';

type SortableColumnKey = 'ticket_no' | 'subject' | 'hospital' | 'customer' | 'agent' | 'status';
type TableColumn = {
  key: SortableColumnKey | 'actions';
  label: string;
  noSort?: boolean;
};

const TABLE_COLUMNS: TableColumn[] = [
  { key: 'ticket_no', label: 'Ticket ID' },
  { key: 'subject', label: 'Subject' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'customer', label: 'Customer' },
  { key: 'agent', label: 'Agent' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions', noSort: true },
];

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
const ticketLinkStyle: React.CSSProperties = { fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' };
const actionWrapStyle: React.CSSProperties = { display: 'flex', gap: '8px' };

const actionButtonBaseStyle: React.CSSProperties = {
  width: '32px',
  height: '32px',
  borderRadius: '8px',
};

const messageActionButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  color: 'var(--primary)',
  background: 'rgba(115, 103, 240, 0.1)',
};

const detailsActionButtonStyle: React.CSSProperties = {
  ...actionButtonBaseStyle,
  color: 'var(--text-muted)',
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalized = String(status || 'New').toLowerCase();
  const configs: Record<string, { color: string; label: string }> = {
    new: { color: '#4facfe', label: 'New' },
    pending: { color: '#ea5455', label: 'Pending' },
    assigned: { color: '#7367f0', label: 'Assigned' },
    'in progress': { color: '#ff9f43', label: 'In Progress' },
    resolved: { color: '#28c76f', label: 'Resolved' },
    closed: { color: '#94a3b8', label: 'Closed' },
    escalated: { color: '#7367f0', label: 'Escalated' },
  };
  const config = configs[normalized] || { color: 'gray', label: status };
  return (
    <span
      style={{
        padding: '4px 10px',
        borderRadius: '8px',
        fontSize: '11px',
        fontWeight: '850',
        textTransform: 'uppercase',
        background: `${config.color}15`,
        color: config.color,
        border: `1px solid ${config.color}30`,
      }}
    >
      {config.label}
    </span>
  );
};

function renderSortIcon(columnKey: SortableColumnKey, sortConfig: TicketWorkspaceSortConfig) {
  if (sortConfig.key !== columnKey) {
    return <ArrowUpDown size={12} style={{ opacity: 0.3 }} />;
  }
  return sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />;
}

interface TicketsTableProps {
  filteredTickets: TicketWorkspaceTicket[];
  getConvId: (ticket: TicketWorkspaceTicket) => string | undefined;
  handleSort: (key: string) => void;
  sortConfig: TicketWorkspaceSortConfig;
}

export function TicketsTable({
  filteredTickets,
  getConvId,
  handleSort,
  sortConfig,
}: TicketsTableProps) {
  return (
    <div className="glass board-scroll-container" style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead style={tableHeadStyle}>
          <tr>
            {TABLE_COLUMNS.map((column) => (
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
            const hospitalName = ticket.hospitals?.name || '-';

            return (
              <tr key={ticket.id} style={rowStyle}>
                <td style={cellStyle}>
                  <Link href={`/tickets/${ticket.id}`} style={ticketLinkStyle}>
                    #{ticket.ticket_no}
                  </Link>
                </td>
                <td style={subjectCellStyle}>{ticket.subject}</td>
                <td style={hospitalCellStyle}>{hospitalName}</td>
                <td style={cellStyle}>{ticket.customers?.display_name || '-'}</td>
                <td style={cellStyle}>
                  {ticket.assigned_agent ? (
                    <span style={{ color: 'var(--primary)', fontWeight: '800' }}>
                      {ticket.assigned_agent.display_name}
                    </span>
                  ) : (
                    <span style={{ opacity: 0.3 }}>-</span>
                  )}
                </td>
                <td style={cellStyle}>
                  <StatusBadge status={ticket.status || ''} />
                </td>
                <td style={cellStyle}>
                  <div style={actionWrapStyle}>
                    {convId && (
                      <Link
                        href={`/inbox?cid=${convId}`}
                        title="Open inbox chat"
                        className="glass-interactive flex-center"
                        style={messageActionButtonStyle}
                      >
                        <MessageCircle size={16} />
                      </Link>
                    )}
                    <Link
                      href={`/tickets/${ticket.id}`}
                      title="Open ticket details"
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
