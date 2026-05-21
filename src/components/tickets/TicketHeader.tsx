'use client';
import React from 'react';
import { ArrowLeft, CheckCircle, FileDown, Save, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { TicketDetailTicket, TicketDetailUser } from '@/types/tickets';
import {
  canResolveTicket,
  isResolvedOrClosedStatus,
  isTicketOwnerOrAdmin,
  isNewStatus,
} from '@/lib/tickets/detailState';

interface TicketHeaderProps {
  ticket: TicketDetailTicket | null;
  status: string;
  user: TicketDetailUser | null;
  updating: boolean;
  isChatActive: boolean;
  onUpdate: () => void;
  onResolveClick: () => void;
  onRejectFixCompleted: () => void;
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
  onRejectFixCompleted,
  onExportClick,
}) => {
  const router = useRouter();

  if (!ticket) return null;

  const isResolvedOrClosed = isResolvedOrClosedStatus(status);
  const isOwnerOrAdmin = isTicketOwnerOrAdmin(ticket, user);
  const canResolve = canResolveTicket(status, isOwnerOrAdmin, isChatActive);
  const canReviewFixCompleted = status === 'Fix Completed';

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
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Ticket Details & Management</span>
            {ticket.created_at && (
              <>
                <span>•</span>
                <span style={{ color: 'var(--primary)', fontWeight: '700' }}>
                  Reported: {new Date(ticket.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} น.
                </span>
              </>
            )}
          </p>
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
            border: '1px solid var(--primary)',
            background: 'var(--primary-transparent)',
            color: 'var(--primary)',
            fontWeight: '900',
            gap: '8px',
            boxShadow: '0 0 15px var(--primary-glow)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          <FileDown size={18} /> Ticket Summary
        </button>
        {!isResolvedOrClosed && !isNewStatus(status) && isOwnerOrAdmin && isChatActive && (
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
        {canReviewFixCompleted && (
          <>
            <button
              onClick={onRejectFixCompleted}
              className="glass-interactive flex-center"
              style={{
                padding: '0 20px',
                height: '44px',
                borderRadius: '12px',
                border: '1px solid #f59e0b',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                fontWeight: '900',
                gap: '8px',
              }}
            >
              ส่งกลับแก้ต่อ
            </button>
            <button
              onClick={onResolveClick}
              className="glass-interactive flex-center"
              style={{
                padding: '0 20px',
                height: '44px',
                borderRadius: '12px',
                border: 'none',
                background: '#22c55e',
                color: 'white',
                fontWeight: '900',
                gap: '8px',
                boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
              }}
            >
              <CheckCircle size={18} /> ยืนยันผลและปิดงาน
            </button>
          </>
        )}
        {!canReviewFixCompleted && canResolve && (
          <button
            onClick={onResolveClick}
            className="glass-interactive flex-center"
            style={{
              padding: '0 20px',
              height: '44px',
              borderRadius: '12px',
              border: 'none',
              background: '#22c55e',
              color: 'white',
              fontWeight: '900',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
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
