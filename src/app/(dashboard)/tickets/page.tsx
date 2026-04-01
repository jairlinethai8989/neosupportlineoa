'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MessageSquare,
  ExternalLink,
  Loader2,
  LayoutGrid,
  List,
  AlertCircle,
  MessageCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { exportToExcel } from '@/lib/utils/exportUtils';
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
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const [debugError, setDebugError] = useState<string | null>(null);

  async function fetchData() {
    setDebugError(null);
    try {
      // 1. Fetch tickets with customers
      const { data: tData, error: tErr } = await supabase
        .from('tickets')
        .select('*, customers(id, display_name)')
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;

      // 2. Fetch conversations to link Chat button
      const { data: cData } = await supabase.from('conversations').select('id, customer_id');
      
      setTickets(tData || []);
      setConversations(cData || []);
    } catch (err: any) {
      setDebugError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('workspace-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
        await sendLineGroupNotification(`🔄 [#${ticket.ticket_no}] ถูกย้ายไป [${newStatus}]`);
     } catch(err) { console.error(err); }
  };

  const getConvId = (customerId: string) => {
     return conversations.find(c => c.customer_id === customerId)?.id;
  };

  const filteredTickets = tickets.filter(t => {
     if (!searchTerm) return true;
     const tNo = String(t.ticket_no || '').toLowerCase();
     const tSub = String(t.subject || '').toLowerCase();
     return tNo.includes(searchTerm.toLowerCase()) || tSub.includes(searchTerm.toLowerCase());
  });

  if (loading) return (
     <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
       <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       <p style={{ color: 'var(--text-muted)' }}>Refreshing Workspace...</p>
     </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', marginBottom: '4px' }}>
            Ticket Workspace ({tickets.length})
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>Unified view of all customer support requests.</p>
          {debugError && <div style={{ color: '#ea5455', fontSize: '12px', marginTop: '8px' }}>⚠️ {debugError}</div>}
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', padding: '4px' }}>
              <button onClick={() => setViewMode('table')} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'table' ? 'var(--primary)' : 'transparent', color: viewMode === 'table' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><List size={16} /> List</button>
              <button onClick={() => setViewMode('board')} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'board' ? 'var(--primary)' : 'transparent', color: viewMode === 'board' ? 'black' : 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700' }}><LayoutGrid size={16} /> Board</button>
           </div>
           
           <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
              <input type="text" placeholder="Search ticket..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 10px 10px 36px', color: 'white', fontSize: '14px', width: '240px', outline: 'none' }} />
           </div>
        </div>
      </div>

      {viewMode === 'board' ? (
         <div className="no-scrollbar" style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '20px', flex: 1 }}>
            {WORKFLOW.map(col => {
               const columnTickets = filteredTickets.filter(t => (t.status || '').toLowerCase() === col.id.toLowerCase());
               return (
                 <div key={col.id} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e) => handleDrop(e, col.id)}
                   style={{ minWidth: '320px', flex: '0 0 auto', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', padding: '16px', border: '1px dashed var(--border)', display: 'flex', flexDirection: 'column' }}>
                     <h3 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{col.thai} <small style={{ fontWeight: '400', opacity: 0.5 }}>{col.eng}</small></span>
                        <span style={{ fontSize: '11px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}>{columnTickets.length}</span>
                     </h3>
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
                        {columnTickets.map(ticket => {
                            const convId = getConvId(ticket.customer_id);
                            return (
                                <div key={ticket.id} draggable onDragStart={(e) => { e.dataTransfer.setData('ticketId', ticket.id); e.currentTarget.style.opacity = '0.5'; }} onDragEnd={(e) => { e.currentTarget.style.opacity = '1'; }} className="glass"
                                  style={{ padding: '16px', borderRadius: '12px', cursor: 'grab', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'flex-start' }}>
                                      <Link href={`/tickets/${ticket.id}`} style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link>
                                      <PriorityIndicator priority={ticket.priority} />
                                    </div>
                                   <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '12px', lineHeight: '1.4' }}>{ticket.subject}</p>
                                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700' }}>{ticket.customers?.display_name || 'Customer'}</p>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                         {convId && (
                                            <Link href={`/inbox?cid=${convId}`} className="glass-interactive flex-center" style={{ width: '28px', height: '28px', borderRadius: '8px', color: 'var(--primary)', background: 'rgba(115, 103, 240, 0.1)' }}>
                                               <MessageCircle size={16} />
                                            </Link>
                                         )}
                                         <Link href={`/tickets/${ticket.id}`} className="glass-interactive flex-center" style={{ width: '28px', height: '28px', borderRadius: '8px', color: 'var(--text-muted)' }}>
                                            <ExternalLink size={16} />
                                         </Link>
                                      </div>
                                   </div>
                                </div>
                            );
                        })}
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
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Chat</th>
                  </tr>
              </thead>
              <tbody>
                 {filteredTickets.map((ticket, idx) => {
                    const convId = getConvId(ticket.customer_id);
                    return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                           <td style={{ padding: '16px 20px' }}><Link href={`/tickets/${ticket.id}`} style={{ fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link></td>
                           <td style={{ padding: '16px 20px' }}>{ticket.subject}</td>
                           <td style={{ padding: '16px 20px' }}>{ticket.customers?.display_name || '-'}</td>
                           <td style={{ padding: '16px 20px' }}><StatusBadge status={ticket.status} /></td>
                           <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                 {convId && (
                                    <Link href={`/inbox?cid=${convId}`} className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '8px', color: 'var(--primary)', background: 'rgba(115, 103, 240, 0.1)' }}>
                                       <MessageCircle size={16} />
                                    </Link>
                                 )}
                                 <Link href={`/tickets/${ticket.id}`} className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '8px', color: 'var(--text-muted)' }}><ExternalLink size={16} /></Link>
                              </div>
                           </td>
                        </tr>
                    );
                 })}
              </tbody>
           </table>
         </div>
      )}
    </div>
  );
}
