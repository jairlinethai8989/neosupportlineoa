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
  List,
  AlertCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToExcel, exportToPDF } from '@/lib/utils/exportUtils';
import Link from 'next/link';

const WORKFLOW = [
  { id: 'New', thai: 'งานใหม่', eng: 'New Ticket' },
  { id: 'In Progress', thai: 'กำลังดำเนินการ', eng: 'In Progress' },
  { id: 'Resolved', thai: 'งานเสร็จแล้ว', eng: 'Resolved' },
  { id: 'Escalated', thai: 'งานส่งต่อ', eng: 'Escalated' },
  { id: 'Pending', thai: 'งานติดปัญหา', eng: 'Pending' }
];

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    'New': '#4facfe',
    'Pending': '#ea5455',
    'Assigned': '#7367f0',
    'In Progress': '#ff9f43',
    'Resolved': '#28c76f',
    'Closed': '#94a3b8',
    'Escalated': '#7367f0'
  };
  const color = colors[status] || 'gray';
  const label = WORKFLOW.find(w => w.id === status)?.thai || status;
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
    }}>{label}</span>
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
  const [debugError, setDebugError] = useState<string | null>(null);

  async function fetchTickets() {
    setDebugError(null);
    try {
      // Step 1: Same query as Sidebar but selecting '*'
      const { data, error } = await supabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setDebugError(`RLS/DB Error: ${error.message}`);
      } else if (data) {
        // Success fetching raw data
        console.log('Tickets Load Success:', data.length);
        
        // Attempt to join customer info if available
        const { data: enriched } = await supabase
          .from('tickets')
          .select('*, customers(display_name)')
          .order('created_at', { ascending: false });
        
        setTickets(enriched || data);
      }
    } catch (err: any) {
      setDebugError(`App Panic: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTickets();

    const channel = supabase
      .channel('tickets-ws-final')
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
        'Subject': t.subject,
        'Status': t.status
     }));
     exportToExcel(data, `Tickets_Report_${new Date().toISOString()}`);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
     e.preventDefault();
     const ticketId = e.dataTransfer.getData('ticketId');
     if (!ticketId) return;

     const ticket = tickets.find(t => t.id === ticketId);
     if (!ticket || ticket.status === newStatus) return;

     setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));

     try {
        await supabase.from('tickets').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', ticketId);
        
        const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
        await sendLineGroupNotification(`🔄 [${newStatus}] ตั๋วงาน #${ticket.ticket_no} ถูกย้ายสถานะแล้ว`);
     } catch(err) {
        console.error(err);
     }
  };

  const normalizedSearch = searchTerm.toLowerCase();
  const filteredTickets = tickets.filter(t => {
     if (!searchTerm) return true;
     const tNo = String(t.ticket_no || '').toLowerCase();
     const tSub = String(t.subject || '').toLowerCase();
     return tNo.includes(normalizedSearch) || tSub.includes(normalizedSearch);
  });

  if (loading) return (
     <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
       <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       <p style={{ color: 'var(--text-muted)' }}>Synchronizing Database...</p>
     </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
            Ticket Workspace ({tickets.length})
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your support lifecycle efficiently.</p>
          {debugError && (
             <div style={{ marginTop: '12px', padding: '10px 16px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid #ea5455', color: '#ea5455', borderRadius: '12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <AlertCircle size={18} /> 
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span style={{ fontWeight: '800' }}>Access Denied or Database Error</span>
                   <span style={{ fontSize: '11px', opacity: 0.8 }}>{debugError}</span>
                </div>
             </div>
          )}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              <button onClick={() => setViewMode('table')} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><List size={16} /> List</button>
              <button onClick={() => setViewMode('board')} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'board' ? 'var(--primary)' : 'transparent', color: viewMode === 'board' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><LayoutGrid size={16} /> Board</button>
           </div>
           
           <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
              <input type="text" placeholder="ค้นหาใบงาน..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 10px 10px 36px', color: 'white', fontSize: '14px', width: '240px', outline: 'none' }} />
           </div>
        </div>
      </div>

      {viewMode === 'board' ? (
         <div className="no-scrollbar" style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', flex: 1 }}>
            {WORKFLOW.map(col => {
               const columnTickets = filteredTickets.filter(t => {
                  const s = String(t.status || '').toLowerCase();
                  return s === col.id.toLowerCase();
               });
               return (
                 <div key={col.id} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => handleDrop(e, col.id)}
                   style={{ minWidth: '320px', flex: '0 0 auto', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column' }}>
                     <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                           <span>{col.thai}</span>
                           <span style={{ fontSize: '9px', color: 'var(--text-muted)', fontWeight: 'normal', textTransform: 'uppercase' }}>{col.eng}</span>
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px', color: 'var(--text-muted)' }}>{columnTickets.length}</span>
                     </h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {columnTickets.map(ticket => (
                            <div key={ticket.id} draggable onDragStart={(e) => { e.dataTransfer.setData('ticketId', ticket.id); e.currentTarget.style.opacity = '0.5'; }} onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }} className="glass"
                              style={{ padding: '16px', borderRadius: '12px', cursor: 'grab', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                                  <Link href={`/tickets/${ticket.id}`} style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link>
                                  <PriorityIndicator priority={ticket.priority} />
                                </div>
                               <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>{ticket.subject}</p>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.customers?.display_name || 'Anonymous'}</p>
                                  <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(ticket.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                               </div>
                            </div>
                        ))}
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
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket ID</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Subject</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
                  </tr>
              </thead>
              <tbody>
                 {filteredTickets.map((ticket, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                       <td style={{ padding: '16px 20px' }}>#{ticket.ticket_no}</td>
                       <td style={{ padding: '16px 20px' }}>{ticket.subject}</td>
                       <td style={{ padding: '16px 20px' }}><StatusBadge status={ticket.status} /></td>
                       <td style={{ padding: '16px 20px' }}>
                          <Link href={`/tickets/${ticket.id}`} className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '8px', color: 'var(--text-muted)' }}><ExternalLink size={16} /></Link>
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
