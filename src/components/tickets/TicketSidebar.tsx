'use client';
import React from 'react';
import { User, Clock } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type {
  TicketDetailLog,
  TicketDetailTicket,
  TicketDetailUser,
} from '@/types/tickets';

interface TicketSidebarProps {
  ticket: TicketDetailTicket | null;
  user: TicketDetailUser | null;
  status: string;
  setStatus: (s: string) => void;
  priority: string;
  setPriority: (p: string) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  availableDepts: any[];
  selectedModule: string;
  setSelectedModule: (m: string) => void;
  availableModules: string[];
  logs: TicketDetailLog[];
}

function getTicketDuration(createdAt: string, resolvedAt?: string | null) {
  const start = new Date(createdAt).getTime();
  const end = resolvedAt ? new Date(resolvedAt).getTime() : Date.now();
  const diff = end - start;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
  ticket,
  user,
  status,
  setStatus,
  priority,
  setPriority,
  selectedDept,
  setSelectedDept,
  availableDepts,
  selectedModule,
  setSelectedModule,
  availableModules,
  logs,
}) => {
  if (!ticket) return null;

  const ticketStatus = ticket.status || '';
  const isResolvedOrClosed = ticketStatus === 'Resolved' || ticketStatus === 'Closed';
  const isAdmin = user?.role === 'Administrator';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '16px',
              background: 'var(--secondary)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ticket.customers?.avatar_url ? (
              <Image
                src={ticket.customers.avatar_url}
                alt="avatar"
                width={52}
                height={52}
                unoptimized
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <User size={24} />
            )}
          </div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>
              {ticket.customers?.display_name || 'Customer'}
            </h4>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 8px',
                background: 'rgba(0,242,254,0.1)',
                color: 'var(--primary)',
                borderRadius: '4px',
                fontWeight: '800',
              }}
            >
              CUSTOMER
            </span>
          </div>
        </div>
        <Link
          href={`/tickets?customerId=${ticket.customer_id}`}
          className="glass-interactive flex-center"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: '800',
            border: '1px solid var(--border)',
            textDecoration: 'none',
            color: 'var(--text-main)',
          }}
        >
          View customer ticket history
        </Link>
      </div>

      <div className="glass" style={{ padding: '20px' }}>
        <label
          style={{
            fontSize: '10px',
            fontWeight: '800',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '12px',
            display: 'block',
          }}
        >
          Issue Details
        </label>
        <h5 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', lineHeight: '1.4' }}>
          {ticket.subject}
        </h5>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Status
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              disabled={isResolvedOrClosed && !isAdmin}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '12px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontWeight: '700',
                opacity: isResolvedOrClosed && !isAdmin ? 0.5 : 1,
              }}
            >
              <option value="New">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Priority
            </label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '12px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontWeight: '700',
              }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Assign to Department
            </label>
            <select
              value={selectedDept}
              onChange={(event) => setSelectedDept(event.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '12px',
                background: 'rgba(0,242,254,0.05)',
                border: '1px solid rgba(0,242,254,0.2)',
                color: 'var(--primary)',
                fontWeight: '800',
              }}
            >
              {availableDepts.map((dept) => (
                <option key={dept.value} value={dept.value}>
                  {dept.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Module
            </label>
            <select
              value={selectedModule}
              onChange={(event) => setSelectedModule(event.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '8px',
                fontSize: '12px',
                background: 'var(--secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontWeight: '700',
              }}
            >
              <option value="">-- Not specified --</option>
              {availableModules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={16} color="var(--primary)" />
          <label
            style={{
              fontSize: '10px',
              fontWeight: '800',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              marginBottom: '0',
            }}
          >
            Time Tracking
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                fontSize: '9px',
                fontWeight: '800',
                color: 'var(--text-muted)',
                display: 'block',
                marginBottom: '4px',
              }}
            >
              Reported At
            </label>
            <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
              {ticket.created_at
                ? new Date(ticket.created_at).toLocaleString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '-'}
            </p>
          </div>

          {ticket.resolved_at && ticket.created_at && (
            <>
              <div>
                <label
                  style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: 'var(--text-muted)',
                    display: 'block',
                    marginBottom: '4px',
                  }}
                >
                  Resolved At
                </label>
                <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                  {new Date(ticket.resolved_at).toLocaleString('th-TH', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              <div
                style={{
                  padding: '12px',
                  background: 'rgba(0,242,254,0.05)',
                  borderRadius: '10px',
                  border: '1px dashed var(--primary)',
                }}
              >
                <label
                  style={{
                    fontSize: '9px',
                    fontWeight: '800',
                    color: 'var(--primary)',
                    display: 'block',
                    marginBottom: '4px',
                    opacity: 0.7,
                  }}
                >
                  Resolution Duration
                </label>
                <p style={{ fontSize: '16px', fontWeight: '900', color: 'var(--text)' }}>
                  {getTicketDuration(ticket.created_at, ticket.resolved_at)}
                </p>
              </div>
            </>
          )}

          {!ticket.resolved_at && ticket.created_at && (
            <div
              style={{
                padding: '12px',
                background: 'rgba(255,165,0,0.05)',
                borderRadius: '10px',
                border: '1px dashed orange',
              }}
            >
              <label
                style={{
                  fontSize: '9px',
                  fontWeight: '800',
                  color: 'orange',
                  display: 'block',
                  marginBottom: '4px',
                  opacity: 0.7,
                }}
              >
                Pending Duration
              </label>
              <p style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)' }}>
                Open for {getTicketDuration(ticket.created_at)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="glass" style={{ padding: '20px' }}>
        <label
          style={{
            fontSize: '10px',
            fontWeight: '800',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            marginBottom: '16px',
            display: 'block',
          }}
        >
          Recent Activity
        </label>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            borderLeft: '1px solid var(--border)',
            marginLeft: '6px',
            paddingLeft: '16px',
          }}
        >
          {logs.slice(0, 3).map((log, idx) => (
            <div key={log.id || idx} style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: '-19.5px',
                  top: '4px',
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--primary)',
                }}
              />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {new Date(log.created_at).toLocaleDateString()}
              </p>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
                {log.action_type === 'status_change'
                  ? `Modified to ${log.to_status}`
                  : log.note || log.action_type}
              </p>
            </div>
          ))}
          {logs.length === 0 && (
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No logs recorded</p>
          )}
        </div>
      </div>
    </div>
  );
};
