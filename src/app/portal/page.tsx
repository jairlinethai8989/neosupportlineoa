'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  MessageSquare, 
  CheckCircle, 
  Clock, 
  User, 
  ExternalLink,
  ShieldAlert,
  Inbox,
  Settings,
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';

const ProfileRegistrationModal = React.lazy(() => import('@/components/portal/ProfileRegistrationModal'));

export default function PortalPage() {
  const { profile, isReady, error: liffError, setMockLogin } = useLiff();
  const [tickets, setTickets] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [totalHistory, setTotalHistory] = useState(0);
  const ITEMS_PER_PAGE = 5;

  const fetchTickets = async (silent = false) => {
    if (!profile?.userId) return;
    if (!silent) setFetching(true);
    
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select(`*, hospitals(name, abbreviation)`)
        .eq('line_user_id', profile.userId)
        .maybeSingle();

      if (customer) {
        setCustomerData(customer);
        if (customer.hospital_id) {
          setNeedsRegistration(false);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const from = (historyPage - 1) * ITEMS_PER_PAGE;
          const to = from + ITEMS_PER_PAGE - 1;

          const query = supabase
            .from('tickets')
            .select('id, ticket_no, subject, status, created_at, resolved_at', { count: 'exact' })
            .eq('customer_id', customer.id)
            .or(`status.not.in.(Resolved,Closed,Canceled,Canceled),created_at.gte.${thirtyDaysAgo.toISOString()}`)
            .order('created_at', { ascending: false })
            .range(from, to);

          const { data: ticketData, count } = await query;
          
          if (ticketData) setTickets(ticketData);
          if (count !== null) setTotalHistory(count);
        } else {
          setNeedsRegistration(true);
        }
      } else {
        setNeedsRegistration(true);
      }
    } catch (err) {
      console.error('Portal Fetch Error:', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (profile?.userId) {
       fetchTickets();
    }
    
    // Refresh on focus or back navigation
    const onRefresh = () => {
       if (profile?.userId) fetchTickets(true);
    };
    window.addEventListener('focus', onRefresh);
    window.addEventListener('popstate', onRefresh);

    return () => { 
       window.removeEventListener('focus', onRefresh);
       window.removeEventListener('popstate', onRefresh);
    };
  }, [profile?.userId, isReady, historyPage]);

  // Realtime subscription for ticket updates
  useEffect(() => {
    if (!customerData?.id) return;

    const channel = supabase
      .channel(`portal_tickets_${customerData.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tickets',
        filter: `customer_id=eq.${customerData.id}`
      }, () => {
        fetchTickets(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerData?.id]);

  if (!isReady || (profile && fetching && !needsRegistration)) {
    return (
      <div className="animate-page-in">
        <div style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Skeleton width={120} height={12} marginBottom={12} />
            <Skeleton width={250} height={32} />
          </div>
          <Skeleton width={44} height={44} borderRadius={12} />
        </div>

        <div style={{ marginBottom: '40px' }}>
          <div className="portal-glass" style={{ padding: '24px', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
             <Skeleton width={44} height={44} borderRadius={14} />
             <Skeleton width={200} height={24} />
          </div>
        </div>

        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
             <Skeleton width={180} height={16} />
             <Skeleton width={80} height={16} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
             {[1, 2, 3].map((i) => (
               <div key={i} className="portal-glass" style={{ padding: '20px', borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                     <Skeleton width={120} height={20} marginBottom={8} />
                     <Skeleton width="60%" height={16} />
                  </div>
                  <Skeleton width={80} height={24} borderRadius={30} />
               </div>
             ))}
          </div>
        </div>
      </div>
    );
  }

  if (liffError || !profile) {
    return (
      <div className="flex-center portal-glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid #fee2e2', background: 'white' }}>
        <ShieldAlert size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>ไม่สามารถเข้าถึงได้</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE เพื่อการบริการที่สมบูรณ์</p>
        <button 
           onClick={() => setMockLogin()}
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: '700', marginTop: '16px', cursor: 'pointer' }}
        >
           จำลองสถานะการทำงาน (Mock Login)
        </button>
      </div>
    );
  }

  // Status values from DB: 'New', 'Assigned', 'In Progress', 'Escalated', 'Resolved', 'Closed', 'Canceled'
  const doneStatuses = ['resolved', 'closed', 'canceled'];
  const activeTickets = tickets.filter(t => !doneStatuses.includes(String(t.status || '').toLowerCase()));
  const pastTickets = tickets.filter(t => doneStatuses.includes(String(t.status || '').toLowerCase()));

  return (
    <>
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <p style={{ color: 'var(--portal-primary)', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', fontSize: '10px', marginBottom: '4px' }}>Support Portal</p>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a' }}>สวัสดี, {profile?.displayName?.split(' ')[0] || 'คุณลูกค้า'}</h2>
         </div>
          <div style={{ display: 'flex', gap: '10px' }}>
             <button onClick={() => fetchTickets()} style={{ padding: '8px', border: '1px solid var(--portal-border)', borderRadius: '8px', background: 'white', color: fetching ? 'var(--portal-primary)' : '#64748b', cursor: 'pointer' }} aria-label="Refresh">
                <RefreshCw size={20} className={fetching ? 'animate-spin' : ''} />
             </button>
             <button onClick={() => setIsEditModalOpen(true)} style={{ padding: '8px', border: '1px solid var(--portal-border)', borderRadius: '8px', background: 'white', color: '#64748b', cursor: 'pointer' }} aria-label="Settings">
                <Settings size={20} />
             </button>
          </div>
      </div>

      <section style={{ marginBottom: '32px' }}>
         <Link href="/portal/create" style={{ textDecoration: 'none' }}>
            <div className="portal-btn-primary" style={{ 
               padding: '16px', 
               borderRadius: '12px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '12px'
            }}>
               <MessageSquare size={20} />
               <p style={{ fontSize: '16px', fontWeight: '700' }}>แจ้งปัญหาการใช้งานใหม่</p>
            </div>
         </Link>
      </section>

      <section style={{ marginBottom: '32px' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>
               ใบงานที่กำลังดำเนินการ
            </h3>
         </div>

         {activeTickets.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: '12px' }}>
               <p style={{ fontSize: '13px' }}>ขณะนี้คุณไม่มีใบงานที่ค้างอยู่</p>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {activeTickets.map(ticket => (
                  <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="portal-glass" style={{ padding: '16px', background: 'white' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                             <p style={{ fontWeight: '700', fontSize: '14px', marginBottom: '2px', color: '#0f172a' }}>#{ticket.ticket_no}</p>
                             <p className="truncate" style={{ fontSize: '12px', color: '#64748b' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <span style={{ 
                                background: 
                                  String(ticket.status).toLowerCase() === 'in progress' ? '#dbeafe' :
                                  String(ticket.status).toLowerCase() === 'pending' ? '#fef3c7' :
                                  String(ticket.status).toLowerCase() === 'escalated' ? '#fee2e2' :
                                  '#f1f5f9',
                                color: 
                                  String(ticket.status).toLowerCase() === 'in progress' ? '#1e40af' :
                                  String(ticket.status).toLowerCase() === 'pending' ? '#92400e' :
                                  String(ticket.status).toLowerCase() === 'escalated' ? '#991b1b' :
                                  '#475569',
                                padding: '6px 12px',
                                fontSize: '11px',
                                fontWeight: '800',
                                borderRadius: '8px',
                                border: '1px solid rgba(0,0,0,0.05)'
                             }}>{ticket.status}</span>
                             <ArrowRight size={14} color="#94a3b8" />
                          </div>
                       </div>
                    </div>
                  </Link>
               ))}
            </div>
         )}
      </section>

      {/* 4. History (Optional) */}
      <section style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderTop: '1px solid var(--portal-border)', paddingTop: '24px' }}>
           <Clock size={16} color="var(--portal-text-muted)" />
           <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>ประวัติการแจ้งงาน</h3>
        </div>
        
        {pastTickets.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '12px' }}>ยังไม่มีประวัติการแจ้งงาน</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {pastTickets.map(ticket => (
                  <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                     <div className="portal-glass" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', border: '1px solid rgba(0,0,0,0.02)' }}>
                        <div>
                           <p style={{ fontSize: '14px', fontWeight: '800', color: '#1e293b' }}>#{ticket.ticket_no}</p>
                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                              <span style={{ 
                                 background: '#dcfce7', 
                                 color: '#166534', 
                                 padding: '2px 8px', 
                                 borderRadius: '6px', 
                                 fontSize: '10px', 
                                 fontWeight: '800' 
                              }}>สำเร็จ</span>
                              <p style={{ fontSize: '11px', color: 'var(--portal-text-muted)' }}>{new Date(ticket.resolved_at || ticket.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</p>
                           </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                           <CheckCircle size={16} color="#22c55e" />
                           <ArrowRight size={14} color="#cbd5e1" />
                        </div>
                     </div>
                  </Link>
               ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
               <button 
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(1)}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', opacity: historyPage === 1 ? 0.3 : 1, cursor: 'pointer' }}
               >
                  <ChevronsLeft size={16} />
               </button>
               <button 
                  disabled={historyPage === 1}
                  onClick={() => setHistoryPage(prev => prev - 1)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', fontWeight: '700', fontSize: '13px', opacity: historyPage === 1 ? 0.3 : 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
               >
                  <ChevronLeft size={16} /> ก่อนหน้า
               </button>
               
               <span style={{ fontSize: '13px', fontWeight: '800', color: '#64748b', margin: '0 8px' }}>
                  หน้า {historyPage} / {Math.ceil(totalHistory / ITEMS_PER_PAGE) || 1}
               </span>

               <button 
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage(prev => prev + 1)}
                  style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', fontWeight: '700', fontSize: '13px', opacity: historyPage * ITEMS_PER_PAGE >= totalHistory ? 0.3 : 1, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
               >
                  ถัดไป <ChevronRight size={16} />
               </button>
               <button 
                  disabled={historyPage * ITEMS_PER_PAGE >= totalHistory}
                  onClick={() => setHistoryPage(Math.ceil(totalHistory / ITEMS_PER_PAGE))}
                  style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--portal-border)', background: 'white', opacity: historyPage * ITEMS_PER_PAGE >= totalHistory ? 0.3 : 1, cursor: 'pointer' }}
               >
                  <ChevronsRight size={16} />
               </button>
            </div>
          </>
        )}
      </section>
    </div>

    {/* MODALS - Moved outside container to avoid transform-fixed ghosting */}
    <React.Suspense fallback={null}>
      <ProfileRegistrationModal 
          isOpen={needsRegistration || isEditModalOpen} 
          profile={profile}
          existingCustomer={customerData}
          onComplete={() => {
              setIsEditModalOpen(false);
              fetchTickets();
          }}
          onClose={() => setIsEditModalOpen(false)}
      />
    </React.Suspense>
    </>
  );
}
