'use client';

import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare,
  ExternalLink,
  Loader2,
  FileDown,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'New': '#4facfe',
    'Assigned': '#7367f0',
    'In Progress': '#ff9f43',
    'Resolved': '#28c76f',
    'Closed': '#94a3b8',
    'Escalated': '#ea5455'
  };
  const color = colors[status] || 'gray';
  return (
    <span style={{ 
      padding: '4px 8px', 
      borderRadius: '6px', 
      fontSize: '11px', 
      fontWeight: '600', 
      textTransform: 'uppercase',
      background: `${color}15`, 
      color: color,
      border: `1px solid ${color}30`
    }}>{status}</span>
  );
};

const PriorityIndicator = ({ priority }: { priority: string }) => {
  const colors: Record<string, string> = {
    'High': '#ea5455',
    'Medium': '#ff9f43',
    'Low': '#00cfe8'
  };
  const color = colors[priority] || 'gray';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '13px' }}>{priority}</span>
    </div>
  );
};

export default function TicketsPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTickets() {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
           *,
           customers (display_name),
           profiles (full_name)
        `)
        .order('created_at', { ascending: false });

      if (data) setTickets(data);
      setLoading(false);
    }
    fetchTickets();

    const channel = supabase
      .channel('tickets-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleExportExcel = () => {
     const data = tickets.map(t => ({
        'Ticket ID': t.ticket_no,
        'Customer': t.customers?.display_name,
        'Subject': t.subject,
        'Priority': t.priority,
        'Status': t.status,
        'Assignee': t.profiles?.full_name,
        'Created At': new Date(t.created_at).toLocaleString()
     }));
     exportToExcel(data, `Tickets_Report_${new Date().toISOString()}`);
  };

  const handleExportPDF = () => {
     const data = tickets.map(t => ({
        'ID': t.ticket_no,
        'Customer': t.customers?.display_name,
        'Subject': t.subject,
        'Priority': t.priority,
        'Status': t.status,
        'Assignee': t.profiles?.full_name
     }));
     exportToPDF(data, `Tickets_Report_${new Date().toISOString()}`, 'Support Tickets Report');
  };

  if (loading) return (
     <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
       <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       <p style={{ color: 'var(--text-muted)' }}>Loading Tickets...</p>
     </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>Support Tickets</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage and track all support tickets lifecycle.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
           <button 
            onClick={handleExportExcel}
            className="glass-interactive flex-center" 
            style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--success)', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
              <FileSpreadsheet size={18} /> Excel
           </button>
           <button 
            onClick={handleExportPDF}
            className="glass-interactive flex-center" 
            style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--danger)', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
              <FileDown size={18} /> PDF
           </button>
           <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
              <input type="text" placeholder="Find ticket..." style={{
                 background: 'rgba(255, 255, 255, 0.05)',
                 border: '1px solid var(--border)',
                 borderRadius: '8px',
                 padding: '10px 10px 10px 36px',
                 color: 'white',
                 fontSize: '14px',
                 width: '240px'
              }} />
           </div>
        </div>
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
           <thead style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border)' }}>
              <tr>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket ID</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assignee</th>
                 <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
              </tr>
           </thead>
           <tbody>
              {tickets.length === 0 && (
                 <tr>
                    <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No tickets found</td>
                 </tr>
              )}
              {tickets.map((ticket, idx) => (
                 <tr key={idx} style={{ 
                    borderBottom: '1px solid var(--border)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                 }} className="glass-interactive">
                    <td style={{ padding: '16px 20px', fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>{ticket.ticket_no}</td>
                    <td style={{ padding: '16px 20px' }}>
                       <p style={{ fontWeight: '600', fontSize: '14px' }}>{ticket.customers?.display_name || 'Anonymous'}</p>
                       <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LINE Channel</p>
                    </td>
                    <td style={{ padding: '16px 20px', fontSize: '14px' }}>{ticket.subject || 'No Subject'}</td>
                    <td style={{ padding: '16px 20px' }}><PriorityIndicator priority={ticket.priority} /></td>
                    <td style={{ padding: '16px 20px' }}><StatusBadge status={ticket.status} /></td>
                    <td style={{ padding: '16px 20px', fontSize: '14px' }}>{ticket.profiles?.full_name || 'Unassigned'}</td>
                    <td style={{ padding: '16px 20px' }}>
                       <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', color: 'var(--text-muted)' }}>
                             <MessageSquare size={16} />
                          </button>
                          <button className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', color: 'var(--text-muted)' }}>
                             <ExternalLink size={16} />
                          </button>
                       </div>
                    </td>
                 </tr>
              ))}
           </tbody>
        </table>
      </div>
    </div>
  );
}
