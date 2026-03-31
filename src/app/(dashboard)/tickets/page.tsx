'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare,
  ExternalLink,
  Loader2,
  FileDown,
  FileSpreadsheet,
  LayoutGrid,
  List
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';
import Link from 'next/link';

const COLUMNS = ['Pending', 'Assigned', 'In Progress', 'Resolved', 'Escalated'];

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'New': '#4facfe',
    'Pending': '#4facfe',
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
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchTerm, setSearchTerm] = useState('');

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

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
     e.preventDefault();
     const ticketId = e.dataTransfer.getData('ticketId');
     if (!ticketId) return;

     const ticket = tickets.find(t => t.id === ticketId);
     if (!ticket || ticket.status === newStatus) return;

     // Optimistic update
     setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));

     try {
        const { data: currentAgent } = await supabase.auth.getUser();
        const { data: agentProfile } = await supabase.from('profiles').select('full_name').eq('id', currentAgent.user?.id).single();

        await supabase.from('tickets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ticketId);
        
        await supabase.from('ticket_logs').insert([{
           ticket_id: ticketId,
           action_type: 'status_change',
           from_status: ticket.status,
           to_status: newStatus,
           performer_id: currentAgent.user?.id,
           note: `Agent moved ticket via Kanban Board`
        }]);

        // Send Group Notification
        const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
        await sendLineGroupNotification(`🔄 [เปลี่ยนสถานะ] แอดมิน ${agentProfile?.full_name || 'Anonymous'} ได้ย้ายตั๋วงาน #${ticket.ticket_no} ไปยังช่อง [${newStatus}]`);

     } catch(err) {
        console.error(err);
     }
  };

  const filteredTickets = tickets.filter(t => 
     t.ticket_no.toLowerCase().includes(searchTerm.toLowerCase()) || 
     (t.subject && t.subject.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return (
     <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
       <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       <p style={{ color: 'var(--text-muted)' }}>Loading Workspace...</p>
     </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>Ticket Workspace</h1>
          <p style={{ color: 'var(--text-muted)' }}>Drag and drop to manage ticket lifecycle.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              <button 
                onClick={() => setViewMode('table')}
                style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                 <List size={16} /> List
              </button>
              <button 
                onClick={() => setViewMode('board')}
                style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'board' ? 'var(--primary)' : 'transparent', color: viewMode === 'board' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}>
                 <LayoutGrid size={16} /> Board
              </button>
           </div>

           <button onClick={handleExportExcel} className="glass-interactive flex-center" style={{ padding: '0 16px', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--success)', gap: '8px', fontSize: '13px', fontWeight: 'bold' }}>
              <FileSpreadsheet size={18} /> Excel
           </button>
           
           <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
              <input type="text" placeholder="Search ID or subject..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{
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

      {viewMode === 'board' ? (
         <div className="no-scrollbar" style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', flex: 1 }}>
            {COLUMNS.map(col => {
               const columnTickets = filteredTickets.filter(t => t.status === col || (col === 'Pending' && t.status === 'New'));
               return (
                 <div 
                   key={col} 
                   onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                   onDrop={(e) => handleDrop(e, col)}
                   style={{ 
                      minWidth: '320px', flex: '0 0 auto', 
                      background: 'rgba(255,255,255,0.02)', 
                      borderRadius: '16px', padding: '16px', 
                      border: '1px dashed var(--border)',
                      display: 'flex', flexDirection: 'column'
                   }}>
                     <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {col} 
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'var(--text-muted)' }}>
                           {columnTickets.length}
                        </span>
                     </h3>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {columnTickets.map(ticket => (
                            <div 
                              key={ticket.id}
                              draggable
                              onDragStart={(e) => { e.dataTransfer.setData('ticketId', ticket.id); e.currentTarget.style.opacity = '0.5'; }}
                              onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }}
                              className="glass"
                              style={{ padding: '16px', borderRadius: '12px', cursor: 'grab', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                                  <Link href={`/tickets/${ticket.id}`} style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' }}>
                                     #{ticket.ticket_no}
                                  </Link>
                                  <PriorityIndicator priority={ticket.priority} />
                               </div>
                               <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>{ticket.subject}</p>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.customers?.display_name || 'Customer'}</p>
                                  <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(ticket.created_at).toLocaleDateString()}</p>
                               </div>
                            </div>
                        ))}
                        {columnTickets.length === 0 && (
                           <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '12px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px', marginTop: 'auto', marginBottom: 'auto' }}>
                              Drop tickets here
                           </div>
                        )}
                     </div>
                 </div>
               );
            })}
         </div>
      ) : (
         <div className="glass" style={{ overflow: 'hidden' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border)' }}>
                 <tr>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket ID</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Priority</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                 </tr>
              </thead>
              <tbody>
                 {filteredTickets.length === 0 && (
                    <tr>
                       <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>No tickets found</td>
                    </tr>
                 )}
                 {filteredTickets.map((ticket, idx) => (
                    <tr key={idx} style={{ 
                       borderBottom: '1px solid var(--border)',
                       background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }} className="glass-interactive">
                       <td style={{ padding: '16px 20px', fontWeight: '700', fontSize: '14px', color: 'var(--primary)' }}>
                         <Link href={`/tickets/${ticket.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                           {ticket.ticket_no}
                         </Link>
                       </td>
                       <td style={{ padding: '16px 20px' }}>
                          <p style={{ fontWeight: '600', fontSize: '14px' }}>{ticket.customers?.display_name || 'Anonymous'}</p>
                       </td>
                       <td style={{ padding: '16px 20px', fontSize: '14px' }}>{ticket.subject || 'No Subject'}</td>
                       <td style={{ padding: '16px 20px' }}><PriorityIndicator priority={ticket.priority} /></td>
                       <td style={{ padding: '16px 20px' }}><StatusBadge status={ticket.status} /></td>
                       <td style={{ padding: '16px 20px' }}>
                          <Link href={`/tickets/${ticket.id}`} className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '6px', border: 'none', color: 'var(--text-muted)', display: 'flex' }}>
                             <ExternalLink size={16} />
                          </Link>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
         </div>
      )}
    </div>
  );
}
