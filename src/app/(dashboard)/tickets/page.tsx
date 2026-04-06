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
  CheckCircle,
  AlertCircle,
  MessageCircle,
  User,
  Zap
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ticketService } from '@/lib/services/ticketService';
import Link from 'next/link';

const WORKFLOW = [
  { id: 'New', thai: 'งานใหม่', eng: 'New Ticket' },
  { id: 'In Progress', thai: 'กำลังดำเนินการ', eng: 'In Progress' },
  { id: 'Resolved', thai: 'งานเสร็จแล้ว', eng: 'Resolved' },
  { id: 'Escalated', thai: 'งานส่งต่อ', eng: 'Escalated' },
  { id: 'Pending', thai: 'งานติดปัญหา', eng: 'Pending' }
];

const StatusBadge = ({ status }: { status: string }) => {
  const s = String(status || 'New').toLowerCase();
  const configs: Record<string, { color: string, label: string }> = {
    'new': { color: '#4facfe', label: 'งานใหม่' },
    'pending': { color: '#ea5455', label: 'งานติดปัญหา' },
    'assigned': { color: '#7367f0', label: 'รับงานแล้ว' },
    'in progress': { color: '#ff9f43', label: 'กำลังดำเนินการ' },
    'resolved': { color: '#28c76f', label: 'งานเสร็จแล้ว' },
    'closed': { color: '#94a3b8', label: 'ปิดงานแล้ว' },
    'escalated': { color: '#7367f0', label: 'งานส่งต่อ' }
  };
  const config = configs[s] || { color: 'gray', label: status };
  return (
    <span style={{ 
      padding: '4px 10px', 
      borderRadius: '8px', 
      fontSize: '11px', 
      fontWeight: '850', 
      textTransform: 'uppercase',
      background: `${config.color}15`, 
      color: config.color,
      border: `1px solid ${config.color}30`
    }}>{config.label}</span>
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
  const [claimingId, setClaimingId] = useState<string | null>(null);

  async function fetchData() {
    setDebugError(null);
    try {
      const { data: tData, error: tErr } = await supabase
        .from('tickets')
        .select(`
          *,
          customers (
            id,
            display_name,
            hospital_id,
            hospitals (
              name
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;
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


  const getConvId = (customerId: string) => {
     return conversations.find(c => c.customer_id === customerId)?.id;
  };

  const handleClaim = async (ticketId: string) => {
    setClaimingId(ticketId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please login to claim tickets');
        return;
      }
      await ticketService.claimTicket(ticketId, user.id);
      await fetchData(); // Refresh
      alert('รับงานเรียบร้อยแล้ว!');
    } catch (err: any) { 
      console.error('Claim Error:', err);
      alert('Failed to claim: ' + err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const filteredTickets = tickets.filter(t => {
     if (!searchTerm) return true;
     const tNo = String(t.ticket_no || '').toLowerCase();
     const tSub = String(t.subject || '').toLowerCase();
     return tNo.includes(searchTerm.toLowerCase()) || tSub.includes(searchTerm.toLowerCase());
  });

  if (loading) return (
     <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh', flexDirection: 'column', gap: '16px' }}>
       <Loader2 className="animate-spin" size={32} color="var(--primary)" />
       <p style={{ color: 'var(--text-muted)' }}>Refreshing Workspace...</p>
     </div>
  );

  return (
    <div style={{ 
      animation: 'fadeIn 0.5s ease-out', 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      maxWidth: '100%',
      overflow: 'hidden'
    }}>
      <div className="workspace-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '40px', 
        paddingRight: '20px',
        width: '100%',
        zIndex: 10
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '36px', fontWeight: '900', marginBottom: '10px', letterSpacing: '-1.5px', color: 'var(--text-main)' }}>
            Ticket Workspace <span style={{ color: 'var(--primary)', opacity: 0.8 }}>({tickets.length})</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500' }}>บัตรงานสนับสนุนและติดตามสถานะแบบเรียลไทม์</p>
          {debugError && <div style={{ color: '#ea5455', fontSize: '12px', marginTop: '8px' }}>⚠️ {debugError}</div>}
        </div>
        
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
           <div className="glass" style={{ display: 'flex', padding: '4px', background: 'rgba(255,255,255,0.02)', borderRadius: '14px', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <button 
                onClick={() => setViewMode('table')} 
                style={{ 
                  padding: '10px 24px', 
                  borderRadius: '10px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  background: viewMode === 'table' ? 'var(--primary)' : 'transparent', 
                  color: viewMode === 'table' ? '#0a0e14' : 'var(--text-muted)', 
                  fontSize: '12px', 
                  fontWeight: '850', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  transition: 'all 0.3s'
                }}
              >
                <List size={16} /> LIST
              </button>
              <button 
                onClick={() => setViewMode('board')} 
                style={{ 
                  padding: '10px 24px', 
                  borderRadius: '10px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  background: viewMode === 'board' ? 'var(--primary)' : 'transparent', 
                  color: viewMode === 'board' ? '#0a0e14' : 'var(--text-muted)', 
                  fontSize: '12px', 
                  fontWeight: '850', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  transition: 'all 0.3s'
                }}
              >
                <LayoutGrid size={16} /> BOARD
              </button>
           </div>
           
           <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} size={16} />
              <input 
                type="text" 
                placeholder="ค้นหาใบงาน..." 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                style={{ 
                  background: 'rgba(255,255,255,0.02)', 
                  border: '1px solid var(--border)', 
                  borderRadius: '14px', 
                  padding: '14px 18px 14px 48px', 
                  color: 'var(--text-main)', 
                  fontSize: '14px', 
                  width: '240px', 
                  outline: 'none',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                }} 
              />
           </div>
        </div>
      </div>

      {viewMode === 'board' ? (
         <div className="board-scroll-container" style={{ 
           display: 'flex', 
           gap: '28px', 
           overflowX: 'auto', 
           paddingBottom: '30px', 
           flex: 1, 
           alignItems: 'flex-start', 
           width: '100%', 
           minHeight: 0, 
           minWidth: 0
         }}>
            {WORKFLOW.map(col => {
               const columnTickets = filteredTickets.filter(t => (t.status || '').toLowerCase() === col.id.toLowerCase());
               const statusConfig: Record<string, { color: string, glow: string }> = {
                 'New': { color: 'var(--primary)', glow: 'rgba(0, 242, 254, 0.4)' },
                 'In Progress': { color: 'var(--warning, #ff9f43)', glow: 'rgba(255, 159, 67, 0.4)' },
                 'Resolved': { color: 'var(--success, #28c76f)', glow: 'rgba(40, 199, 111, 0.4)' },
                 'Escalated': { color: '#7367f0', glow: 'rgba(115, 103, 240, 0.4)' },
                 'Pending': { color: 'var(--danger, #ea5455)', glow: 'rgba(234, 84, 85, 0.4)' }
               };
               const config = statusConfig[col.id] || { color: 'var(--text-muted)', glow: 'rgba(0,0,0,0.1)' };
               
               return (
                 <div key={col.id} style={{ minWidth: '340px', maxWidth: '340px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-input)', borderRadius: '24px', padding: '12px' }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: `${config.color}15`, borderRadius: '18px', borderBottom: `3px solid ${config.color}`, boxShadow: `0 4px 12px ${config.color}10` }}>
                        <h3 style={{ fontSize: '15px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-main)' }}>
                           <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: config.color }}></span>
                           {col.thai} 
                        </h3>
                        <span style={{ fontSize: '12px', fontWeight: '900', color: config.color, background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '8px' }}>{columnTickets.length}</span>
                     </div>
                     
                     <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {columnTickets.map(ticket => {
                            const convId = getConvId(ticket.customer_id);
                            const isNew = String(ticket.status || '').toLowerCase() === 'new';
                            const hospitalName = ticket.customers?.hospitals?.name || 'ไม่ระบุโรงพยาบาล';
                            return (
                                <div key={ticket.id} className="glass-interactive" style={{ padding: '24px', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `6px solid ${config.color}`, display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Link href={`/tickets/${ticket.id}`} style={{ fontSize: '15px', fontWeight: '900', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link>
                                      <PriorityIndicator priority={ticket.priority} />
                                    </div>
                                    <div>
                                      <h4 style={{ fontSize: '14px', fontWeight: '700', lineHeight: '1.5', color: 'var(--text-main)', marginBottom: '8px' }}>{ticket.subject}</h4>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: `${config.color}10`, borderRadius: '12px', width: 'fit-content', border: `1px solid ${config.color}20` }}>
                                        <AlertCircle size={12} color={config.color} />
                                        <p style={{ fontSize: '14px', fontWeight: '800', color: config.color, letterSpacing: '0.05em' }}>{hospitalName}</p>
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                          <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} color="var(--text-muted)" /></div>
                                          <p style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '700' }}>{ticket.customers?.display_name || 'Customer'}</p>
                                       </div>
                                       <div style={{ display: 'flex', gap: '10px' }}>
                                          {convId && (
                                             <Link href={`/inbox?cid=${convId}`} className="glass-interactive flex-center" style={{ width: '38px', height: '38px', borderRadius: '12px', color: 'var(--primary)', background: 'var(--bg-input)', border: '1px solid var(--border)' }}><MessageCircle size={18} /></Link>
                                          )}
                                          <Link href={`/tickets/${ticket.id}`} className="glass-interactive flex-center" style={{ width: '38px', height: '38px', borderRadius: '12px', color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)' }}><ExternalLink size={18} /></Link>
                                       </div>
                                    </div>
                                    {isNew && (
                                       <button 
                                        disabled={claimingId === ticket.id}
                                        onClick={() => handleClaim(ticket.id)} 
                                        style={{ 
                                          width: '100%', 
                                          padding: '14px', 
                                          borderRadius: '14px', 
                                          background: claimingId === ticket.id ? 'var(--border)' : 'var(--primary)', 
                                          color: claimingId === ticket.id ? 'var(--text-muted)' : 'black', 
                                          border: 'none', 
                                          fontSize: '13px', 
                                          fontWeight: '850', 
                                          letterSpacing: '0.5px', 
                                          boxShadow: claimingId === ticket.id ? 'none' : '0 6px 20px rgba(0, 242, 254, 0.2)', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          gap: '8px',
                                          cursor: claimingId === ticket.id ? 'not-allowed' : 'pointer',
                                          transition: 'all 0.2s'
                                        }}
                                      >
                                        {claimingId === ticket.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} 
                                        {claimingId === ticket.id ? 'กำลังเข้ารับงาน...' : 'รับงาน (Claim)'}
                                      </button>
                                    )}

                                    {ticket.status === 'In Progress' && (
                                       <button 
                                        onClick={async () => {
                                          const summary = prompt('กรอกสรุปการแก้ไขงาน (Resolution Summary):');
                                          if (!summary) return;
                                          try {
                                            const { data: { user } } = await supabase.auth.getUser();
                                            if (!user) return;
                                            await ticketService.resolve(ticket.id, user.id, summary);
                                            fetchData();
                                            alert('ปิดงานสำเร็จ!');
                                          } catch (err: any) {
                                            alert('Failed: ' + err.message);
                                          }
                                        }}
                                        style={{ 
                                          width: '100%', 
                                          padding: '14px', 
                                          borderRadius: '14px', 
                                          background: 'var(--success)', 
                                          color: 'white', 
                                          border: 'none', 
                                          fontSize: '13px', 
                                          fontWeight: '850', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          gap: '8px',
                                          cursor: 'pointer'
                                        }}
                                      >
                                        <CheckCircle size={14} /> แก้ไขเสร็จสิ้น (Resolve)
                                      </button>
                                    )}
                                </div>
                            );
                        })}
                        {columnTickets.length === 0 && (
                           <div style={{ border: '2px dashed var(--border)', borderRadius: '24px', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                              <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)' }}>Empty Column</p>
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
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket ID</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>หัวข้อ</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>โรงพยาบาล</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ลูกค้า</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>สถานะ</th>
                    <th style={{ padding: '16px 20px', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>จัดการ</th>
                  </tr>
              </thead>
              <tbody>
                 {filteredTickets.map((ticket, idx) => {
                    const convId = getConvId(ticket.customer_id);
                    const hospitalName = ticket.customers?.hospitals?.name || '-';
                    return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                           <td style={{ padding: '16px 20px' }}><Link href={`/tickets/${ticket.id}`} style={{ fontWeight: '800', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link></td>
                           <td style={{ padding: '16px 20px', fontSize: '14px', fontWeight: '500' }}>{ticket.subject}</td>
                           <td style={{ padding: '16px 20px', fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>{hospitalName}</td>
                           <td style={{ padding: '16px 20px' }}>{ticket.customers?.display_name || '-'}</td>
                           <td style={{ padding: '16px 20px' }}><StatusBadge status={ticket.status} /></td>
                           <td style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                 {convId && (
                                    <Link href={`/inbox?cid=${convId}`} className="glass-interactive flex-center" style={{ width: '32px', height: '32px', borderRadius: '8px', color: 'var(--primary)', background: 'rgba(115, 103, 240, 0.1)' }}><MessageCircle size={16} /></Link>
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
       <style dangerouslySetInnerHTML={{ __html: `
         .board-scroll-container::-webkit-scrollbar {
           height: 8px;
         }
         .board-scroll-container::-webkit-scrollbar-track {
           background: rgba(255, 255, 255, 0.03);
           border-radius: 10px;
         }
         .board-scroll-container::-webkit-scrollbar-thumb {
           background: var(--border);
           border-radius: 10px;
         }
         .board-scroll-container::-webkit-scrollbar-thumb:hover {
           background: var(--primary);
         }
         @keyframes fadeIn {
           from { opacity: 0; transform: translateY(10px); }
           to { opacity: 1; transform: translateY(0); }
         }
         .workspace-header { width: 100%; }
       `}} />
    </div>
  );
}
