'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
  Zap,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
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

function TicketsContent() {
  const searchParams = useSearchParams();
  const filterCustomerId = searchParams.get('customerId');
  
  const [tickets, setTickets] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'board' | 'table'>('board');
  const [searchTerm, setSearchTerm] = useState('');
  const { addToast } = useNotificationContext();
  const [debugError, setDebugError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<any>(null);
  const [resSummary, setResSummary] = useState('');

  // Date Filter State
  const [timeRange, setTimeRange] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'created_at', direction: 'desc' });

  async function fetchData() {
    setDebugError(null);
    try {
      let from: Date | null = null;
      let to: Date = new Date();
      to.setHours(23, 59, 59, 999);

      if (timeRange === 'today') {
        from = new Date(); from.setHours(0, 0, 0, 0);
      } else if (timeRange === 'week') {
        from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
      } else if (timeRange === 'month') {
        from = new Date(); from.setMonth(from.getMonth() - 31); from.setHours(0, 0, 0, 0);
      } else if (timeRange === 'custom') {
        from = customStart ? new Date(customStart) : new Date();
        to = customEnd ? new Date(customEnd) : new Date();
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
      }

      const { data: cData } = await supabase
        .from('conversations')
        .select('id, customer_id, current_ticket_id, status')
        .order('last_message_at', { ascending: false });

      const { data: tData, error: tErr } = await supabase
        .from('tickets')
        .select('*')
        .gte('created_at', from ? from.toISOString() : '2000-01-01T00:00:00Z')
        .lte('created_at', to.toISOString())
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;

      // In-memory join to resolve hospital/customer names without ambiguity
      const hospitalIds = Array.from(new Set(tData?.map(t => t.hospital_id).filter(Boolean)));
      const customerIds = Array.from(new Set(tData?.map(t => t.customer_id).filter(Boolean)));

      const [hRes, cRes] = await Promise.all([
        supabase.from('hospitals').select('id, name').in('id', hospitalIds),
        supabase.from('customers').select('id, display_name').in('id', customerIds)
      ]);

      const hMap = Object.fromEntries(hRes.data?.map(h => [h.id, h]) || []);
      const cMap = Object.fromEntries(cRes.data?.map(c => [c.id, c]) || []);

      const joinedTickets = tData?.map(t => ({
        ...t,
        hospitals: hMap[t.hospital_id],
        customers: cMap[t.customer_id]
      })) || [];

      setTickets(joinedTickets);
      
      setConversations(cData || []);
    } catch (err: any) {
      console.error('Fetch tickets error:', err);
      setDebugError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleExecuteResolve = async () => {
    if (!resolvingTicket || !resSummary.trim()) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await ticketService.resolve(resolvingTicket.id, user.id, resSummary);
      setShowResolveModal(false);
      setResolvingTicket(null);
      setResSummary('');
      fetchData();
      
      addToast({
        id: `resolve-${resolvingTicket.id}`,
        type: 'ticket',
        title: 'Work Completed! 🎉',
        body: `ใบงาน #${resolvingTicket.ticket_no} ถูกปิดงานเรียบร้อยแล้ว`
      });
    } catch (err: any) {
      addToast({
        id: 'resolve-fail',
        type: 'ticket',
        title: 'Error',
        body: 'ไม่สามารถปิดงานได้: ' + err.message
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('role, permissions').eq('id', user.id).single();
        setUserProfile(p);
      }
    }
    fetchUser();
    
    fetchData();
    const channel = supabase
      .channel('workspace-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [timeRange, customStart, customEnd, filterCustomerId]);


  const getConvId = (ticket: any) => {
     const linked = conversations.find(c => c.current_ticket_id === ticket.id);
     if (linked) return linked.id;
     const active = conversations.find(c => c.customer_id === ticket.customer_id && c.status === 'active');
     if (active) return active.id;
     return conversations.find(c => c.customer_id === ticket.customer_id)?.id;
  };

  const handleClaim = async (ticketId: string) => {
    if (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') {
      alert('คุณไม่มีสิทธิ์ในการรับงาน (View Only Access)');
      return;
    }
    setClaimingId(ticketId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Please login to claim tickets');
        return;
      }
      await ticketService.claimTicket(ticketId, user.id);
      await fetchData();
      
      addToast({
        id: `claim-${ticketId}`,
        type: 'ticket',
        title: 'Work Claimed! ⚡',
        body: 'คุณเข้ารับงานเรียบร้อย เริ่มการสนทนาได้เลย'
      });
    } catch (err: any) { 
      console.error('Claim Error:', err);
      addToast({
        id: 'claim-fail',
        type: 'ticket',
        title: 'Error',
        body: 'รับงานไม่สำเร็จ: ' + err.message
      });
    } finally {
      setClaimingId(null);
    }
  };
  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredTickets = useMemo(() => {
    let result = [...tickets];

    if (filterCustomerId) {
      result = result.filter(t => t.customer_id === filterCustomerId);
    }

    if (searchTerm) {
      const query = searchTerm.toLowerCase();
      result = result.filter(t => {
        const tNo = String(t.ticket_no || '').toLowerCase();
        const tSub = String(t.subject || '').toLowerCase();
        const tCust = String(t.customers?.display_name || '').toLowerCase();
        return tNo.includes(query) || tSub.includes(query) || tCust.includes(query);
      });
    }

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'ticket_no':
            aValue = a.ticket_no;
            bValue = b.ticket_no;
            break;
          case 'subject':
            aValue = a.subject;
            bValue = b.subject;
            break;
          case 'hospital':
            aValue = a.customers?.hospitals?.name || '';
            bValue = b.customers?.hospitals?.name || '';
            break;
          case 'customer':
            aValue = a.customers?.display_name || '';
            bValue = b.customers?.display_name || '';
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'created_at':
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          default:
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [tickets, filterCustomerId, searchTerm, sortConfig]);

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
        width: '100%',
        position: 'relative'
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-1.5px', color: 'var(--text-main)', margin: 0 }}>
              {filterCustomerId ? 'Filtered Workspace' : 'Ticket Workspace'} <span style={{ color: 'var(--primary)', opacity: 0.8 }}>({filteredTickets.length})</span>
              {filterCustomerId && (
                 <Link href="/tickets" style={{ fontSize: '12px', marginLeft: '16px', color: 'var(--danger)', fontWeight: '800' }}>[ล้างตัวกรอง]</Link>
              )}
            </h1>
            
            <div style={{ display: 'flex', background: 'var(--bg-card)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)', marginLeft: '12px' }}>
              {[
                { id: 'all', thai: 'ทั้งหมด' },
                { id: 'today', thai: 'วันนี้' },
                { id: 'week', thai: 'สัปดาห์นี้' },
                { id: 'month', thai: 'เดือนนี้' },
                { id: 'custom', thai: 'ช่วงเวลา' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setTimeRange(opt.id as any)}
                  style={{
                    padding: '4px 12px',
                    borderRadius: '7px',
                    fontSize: '11px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    background: timeRange === opt.id ? 'var(--primary)' : 'transparent',
                    color: timeRange === opt.id ? '#0a0e14' : 'var(--text-muted)',
                    transition: 'all 0.2s'
                  }}
                >
                  {opt.thai}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: '500', margin: 0 }}>
              {filterCustomerId ? `Viewing tickets for specific customer` : 'บัตรงานสนับสนุนและติดตามสถานะแบบเรียลไทม์'}
            </p>
            {timeRange === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', animation: 'fadeIn 0.3s ease-out' }}>
                <input 
                  type="date" 
                  value={customStart} 
                  onChange={e => setCustomStart(e.target.value)}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', color: 'white', fontSize: '11px' }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>—</span>
                <input 
                  type="date" 
                  value={customEnd} 
                  onChange={e => setCustomEnd(e.target.value)}
                  style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '4px 8px', color: 'white', fontSize: '11px' }}
                />
              </div>
            )}
          </div>
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
          <div className="board-scroll-container glass" style={{ 
            display: 'flex', 
            overflowX: 'auto', 
            padding: '24px', 
            flex: 1, 
            width: '100%',
            maxWidth: '100%',
            minHeight: '600px',
            background: 'var(--bg-card)',
            borderRadius: '32px',
            border: '1px solid var(--border)',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x'
          }}>
            <div style={{ display: 'flex', gap: '28px', width: 'max-content', alignItems: 'flex-start' }}>
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
                            const convId = getConvId(ticket);
                            const isNew = String(ticket.status || '').toLowerCase() === 'new';
                            const hospitalName = ticket.hospitals?.name || 'ไม่ระบุโรงพยาบาล';
                            return (
                                <div key={ticket.id} className="glass-interactive" style={{ padding: '24px', borderRadius: '24px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: `6px solid ${config.color}`, display: 'flex', flexDirection: 'column', gap: '18px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <Link href={`/tickets/${ticket.id}`} style={{ fontSize: '16px', fontWeight: '900', color: 'var(--primary)', textDecoration: 'none' }}>#{ticket.ticket_no}</Link>
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
                                        disabled={claimingId === ticket.id || (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view')}
                                        onClick={() => handleClaim(ticket.id)} 
                                        style={{ 
                                          width: '100%', 
                                          padding: '14px', 
                                          borderRadius: '14px', 
                                          background: (claimingId === ticket.id || (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view')) ? 'var(--border)' : 'var(--primary)', 
                                          color: (claimingId === ticket.id || (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view')) ? 'var(--text-muted)' : 'black', 
                                          border: 'none', 
                                          fontSize: '13px', 
                                          fontWeight: '850', 
                                          letterSpacing: '0.5px', 
                                          boxShadow: (claimingId === ticket.id || (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view')) ? 'none' : '0 6px 20px rgba(0, 242, 254, 0.2)', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          gap: '8px',
                                          cursor: (claimingId === ticket.id || (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view')) ? 'not-allowed' : 'pointer',
                                          transition: 'all 0.2s',
                                          opacity: (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') ? 0.5 : 1
                                        }}
                                      >
                                        {claimingId === ticket.id ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />} 
                                        {userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view' ? 'อ่านอย่างเดียว' : (claimingId === ticket.id ? 'กำลังเข้ารับงาน...' : 'รับงาน (Claim)')}
                                      </button>
                                    )}

                                    {ticket.status === 'In Progress' && (
                                       <button 
                                        disabled={userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view'}
                                        onClick={() => {
                                          if (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') return;
                                          setResolvingTicket(ticket);
                                          setResSummary('');
                                          setShowResolveModal(true);
                                        }}
                                        style={{ 
                                          width: '100%', 
                                          padding: '14px', 
                                          borderRadius: '14px', 
                                          background: (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') ? 'var(--bg-input)' : 'var(--success)', 
                                          color: 'white', 
                                          border: 'none', 
                                          fontSize: '13px', 
                                          fontWeight: '850', 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          justifyContent: 'center', 
                                          gap: '8px',
                                          cursor: (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') ? 'not-allowed' : 'pointer',
                                          opacity: (userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view') ? 0.5 : 1
                                        }}
                                      >
                                        <CheckCircle size={14} /> {userProfile?.role !== 'Administrator' && userProfile?.permissions?.tickets === 'view' ? 'อ่านอย่างเดียว' : 'แก้ไขเสร็จสิ้น (Resolve)'}
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
          </div>
      ) : (
          <div className="glass board-scroll-container" style={{ overflowX: 'auto', padding: '1px' }}>
           <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ background: 'rgba(255, 255, 255, 0.03)', borderBottom: '1px solid var(--border)' }}>
                  <tr>
                    {[
                      { key: 'ticket_no', label: 'Ticket ID' },
                      { key: 'subject', label: 'หัวข้อ' },
                      { key: 'hospital', label: 'โรงพยาบาล' },
                      { key: 'customer', label: 'ลูกค้า' },
                      { key: 'status', label: 'สถานะ' },
                      { key: 'actions', label: 'จัดการ', noSort: true }
                    ].map((col) => (
                      <th 
                        key={col.key} 
                        onClick={() => !col.noSort && handleSort(col.key)}
                        style={{ 
                          padding: '16px 20px', 
                          fontSize: '11px', 
                          fontWeight: '800', 
                          color: 'var(--text-muted)', 
                          textTransform: 'uppercase',
                          cursor: col.noSort ? 'default' : 'pointer',
                          userSelect: 'none'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {col.label}
                          {!col.noSort && (
                            <span style={{ display: 'flex', alignItems: 'center' }}>
                              {sortConfig.key === col.key ? (
                                sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                              ) : (
                                <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
              </thead>
              <tbody>
                 {filteredTickets.map((ticket, idx) => {
                    const convId = getConvId(ticket);
                    const hospitalName = ticket.hospitals?.name || '-';
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
           height: 10px;
         }
         .board-scroll-container::-webkit-scrollbar-track {
           background: rgba(255, 255, 255, 0.02);
           border-radius: 20px;
           margin: 0 20px;
         }
         .board-scroll-container::-webkit-scrollbar-thumb {
           background: linear-gradient(to right, var(--primary), #7367f0);
           border-radius: 20px;
           border: 3px solid rgba(10, 14, 20, 0.9);
         }
         .board-scroll-container::-webkit-scrollbar-thumb:hover {
           background: var(--primary);
           box-shadow: 0 0 15px var(--primary);
         }
         .board-scroll-container {
           scroll-behavior: smooth;
           padding-bottom: 30px !important;
         }
         @keyframes fadeIn {
           from { opacity: 0; transform: translateY(10px); }
           to { opacity: 1; transform: translateY(0); }
         }
         .workspace-header { width: 100%; }
       `}} />
      {/* Resolution Modal */}
      {showResolveModal && (
          <div style={{
             position: 'fixed',
             inset: 0,
             zIndex: 10000,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             background: 'rgba(5, 8, 12, 0.85)',
             backdropFilter: 'blur(20px)',
             padding: '20px'
          }}>
             <div className="glass" style={{
                width: '100%',
                maxWidth: '480px',
                padding: '40px',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
             }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                   <div style={{ 
                     width: '64px', 
                     height: '64px', 
                     borderRadius: '20px', 
                     background: 'rgba(0, 255, 127, 0.1)', 
                     color: 'var(--success)', 
                     display: 'inline-flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     marginBottom: '20px'
                   }}>
                      <CheckCircle size={32} />
                   </div>
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{resolvingTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
                </div>

                <div style={{ marginBottom: '32px' }}>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>
                   <textarea 
                     value={resSummary}
                     onChange={(e) => setResSummary(e.target.value)}
                     placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว', 'อัปเดตสถานะการจัดส่งสำเร็จ'..."
                     style={{
                        width: '100%',
                        height: '140px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        padding: '16px',
                        color: 'var(--text-main)',
                        fontSize: '14px',
                        resize: 'none',
                        outline: 'none',
                        transition: 'all 0.3s'
                     }}
                   />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                   <button 
                     onClick={() => setShowResolveModal(false)}
                     style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: '800', cursor: 'pointer' }}
                   >
                      ยกเลิก
                   </button>
                   <button 
                     onClick={handleExecuteResolve}
                     disabled={loading || !resSummary.trim()}
                     style={{ 
                       flex: 1.5, 
                       padding: '16px', 
                       borderRadius: '14px', 
                       border: 'none', 
                       background: (loading || !resSummary.trim()) ? 'rgba(255,255,255,0.05)' : 'var(--success)', 
                       color: (loading || !resSummary.trim()) ? 'rgba(255,255,255,0.2)' : 'black', 
                       fontWeight: '900', 
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '10px'
                     }}
                   >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันสมบูรณ์</>}
                   </button>
                </div>
             </div>
          </div>
       )}

       <style dangerouslySetInnerHTML={{ __html: `
         @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
         }
       `}} />
    </div>
  );
}

export default function TicketsPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      </div>
    }>
      <TicketsContent />
    </Suspense>
  );
}
