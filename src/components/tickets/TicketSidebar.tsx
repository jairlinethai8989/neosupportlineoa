'use client';
import React from 'react';
import { 
  User, 
  Layout, 
  History, 
  CheckCircle 
} from 'lucide-react';
import Link from 'next/link';

interface TicketSidebarProps {
  ticket: any;
  user: any;
  status: string;
  setStatus: (s: string) => void;
  priority: string;
  setPriority: (p: string) => void;
  selectedDept: string;
  setSelectedDept: (d: string) => void;
  availableDepts: string[];
  logs: any[];
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
  logs
}) => {
  if (!ticket) return null;

  const isResolvedOrClosed = ticket.status === 'Resolved' || ticket.status === 'Closed';
  const isAdmin = user?.role === 'Administrator';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Customer Context */}
      <div className="glass" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--secondary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {ticket.customers?.avatar_url ? (
              <img src={ticket.customers.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : <User size={24} />}
          </div>
          <div>
            <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>{ticket.customers?.display_name || 'Customer'}</h4>
            <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(0,242,254,0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: '800' }}>CUSTOMER</span>
          </div>
        </div>
        <Link 
          href={`/tickets?customerId=${ticket.customer_id}`} 
          className="glass-interactive flex-center" 
          style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: '800', border: '1px solid var(--border)', textDecoration: 'none', color: 'var(--text-main)' }}
        >
          ดูประวัติใบงานลูกค้า
        </Link>
      </div>

      {/* Issue Overview */}
      <div className="glass" style={{ padding: '20px' }}>
        <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Issue Details</label>
        <h5 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', lineHeight: '1.4' }}>{ticket.subject}</h5>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
            <select 
              value={status} 
              onChange={(e) => setStatus(e.target.value)}
              disabled={isResolvedOrClosed && !isAdmin}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700', opacity: (isResolvedOrClosed && !isAdmin) ? 0.5 : 1 }}
            >
              <option value="New">Pending</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Priority</label>
            <select 
              value={priority} 
              onChange={(e) => setPriority(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700' }}
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Assign to Dept</label>
            <select 
              value={selectedDept} 
              onChange={(e) => setSelectedDept(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'rgba(0,242,254,0.05)', border: '1px solid rgba(0,242,254,0.2)', color: 'var(--primary)', fontWeight: '800' }}
            >
              <option value="">-- ไม่ระบุแผนก --</option>
              {availableDepts.map((d, i) => (
                <option key={i} value={d}>{d}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="glass" style={{ padding: '20px' }}>
        <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Recent activity</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', marginLeft: '6px', paddingLeft: '16px' }}>
          {logs.slice(0, 3).map((log, idx) => (
            <div key={idx} style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', left: '-19.5px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleDateString()}</p>
              <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
                {log.action_type === 'status_change' ? `Modified to ${log.to_status}` : (log.note || log.action_type)}
              </p>
            </div>
          ))}
          {logs.length === 0 && <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No logs recorded</p>}
        </div>
      </div>
    </div>
  );
};
