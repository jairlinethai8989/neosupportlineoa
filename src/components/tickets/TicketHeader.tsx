'use client';
import React from 'react';
import { ArrowLeft, CheckCircle, FileDown, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { TicketDetailTicket, TicketDetailUser } from '@/types/tickets';

interface TicketHeaderProps {
  ticket: TicketDetailTicket | null;
  status: string;
  user: TicketDetailUser | null;
  updating: boolean;
  isChatActive: boolean;
  onUpdate: () => void;
  onResolveClick: () => void;
  onExportClick: () => void;
}

export const TicketHeader: React.FC<TicketHeaderProps> = ({
  ticket,
  status,
  user,
  updating,
  isChatActive,
  onUpdate,
  onResolveClick,
  onExportClick,
}) => {
  const router = useRouter();

  if (!ticket) return null;

  const isResolvedOrClosed = status === 'Resolved' || status === 'Closed';
  const isOwnerOrAdmin = ticket.assigned_agent_id === user?.id || user?.role === 'Administrator';
  const canResolve = !isResolvedOrClosed && status !== 'New' && isOwnerOrAdmin && !isChatActive;

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={() => router.push('/tickets')}
          className="glass-interactive flex-center"
          style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: '800' }}>#{ticket.ticket_no}</h1>
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '800',
                background: 'rgba(255, 171, 0, 0.1)',
                color: 'var(--warning)',
                letterSpacing: '1px',
              }}
            >
              {status.toUpperCase()}
            </span>
            {ticket.assigned_agent && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 12px',
                  background: 'var(--primary-transparent)',
                  borderRadius: '20px',
                  marginLeft: '8px',
                }}
              >
                <CheckCircle size={14} color="var(--primary)" />
                <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '900' }}>
                  Assigned: {ticket.assigned_agent.display_name}
                </span>
              </div>
            )}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Ticket Details & Management</p>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={onExportClick}
          className="glass-interactive flex-center"
          style={{
            padding: '0 20px',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid var(--border)',
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'var(--text-main)',
            fontWeight: '800',
            gap: '8px',
          }}
        >
          <FileDown size={18} /> Ticket Summary
        </button>
        {!isResolvedOrClosed && status !== 'New' && isOwnerOrAdmin && isChatActive && (
          <button
            disabled
            className="flex-center"
            style={{
              padding: '0 20px',
              height: '44px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-muted)',
              fontWeight: '800',
              gap: '8px',
              cursor: 'not-allowed',
            }}
            title="Please end the live chat session before resolving this ticket."
          >
            <CheckCircle size={18} /> End Chat First
          </button>
        )}
        {canResolve && (
          <button
            onClick={onResolveClick}
            className="glass-interactive flex-center"
            style={{
              padding: '0 20px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: 'var(--success)',
              color: 'black',
              fontWeight: '900',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0, 255, 127, 0.3)',
            }}
          >
            <CheckCircle size={18} /> Resolve Ticket
          </button>
        )}
        <button
          onClick={onUpdate}
          disabled={updating}
          className="glass-interactive flex-center"
          style={{
            padding: '0 20px',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid var(--primary)',
            background: 'var(--primary)',
            color: 'white',
            fontWeight: '800',
            gap: '8px',
          }}
        >
          {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
        </button>
      </div>
    </div>
  );
};
