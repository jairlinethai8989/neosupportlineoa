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
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import ProfileRegistrationModal from '@/components/portal/ProfileRegistrationModal';

export default function PortalPage() {
  const { profile, isReady, error: liffError, setMockLogin } = useLiff();
  const [tickets, setTickets] = useState<any[]>([]);
  const [customerData, setCustomerData] = useState<any>(null);
  const [fetching, setFetching] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const fetchTickets = async () => {
    if (!profile?.userId) return;
    setFetching(true);
    // Find customer by line_user_id
    const { data: customer } = await supabase
      .from('customers')
      .select('id, hospital_id, department_id, position_id')
      .eq('line_user_id', profile.userId)
      .maybeSingle(); // Use maybeSingle to avoid 406 Error if none exists

    if (customer) {
      setCustomerData(customer);
      setNeedsRegistration(false);
      // Fetch all tickets for this customer
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false });

      if (ticketData) setTickets(ticketData);
    } else {
      setNeedsRegistration(true);
    }
    setFetching(false);
  };

  useEffect(() => {
    let isMounted = true;
    if (profile) {
      setTimeout(() => {
        if (isMounted) fetchTickets();
      }, 0);
    }
    return () => { isMounted = false; };
  }, [profile]);

  if (!isReady || (profile && fetching && !needsRegistration)) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--portal-primary)" />
        <p style={{ color: 'var(--portal-text-muted)', fontSize: '14px', fontWeight: '600' }}>กำลังเตรียมข้อมูลศูนย์ช่วยเหลือ...</p>
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

  const activeStatuses = ['new', 'assigned', 'in progress', 'escalated', 'pending'];
  const activeTickets = tickets.filter(t => activeStatuses.includes(String(t.status || '').toLowerCase()));
  const pastTickets = tickets.filter(t => !activeStatuses.includes(String(t.status || '').toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <div>
            <p style={{ color: 'var(--portal-primary)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '10px', marginBottom: '6px' }}>Dashboard</p>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#1e293b' }}>สวัสดี, {profile?.displayName?.split(' ')[0] || 'คุณลูกค้า'}</h2>
         </div>
         <button onClick={() => setIsEditModalOpen(true)} className="portal-glass flex-center" style={{ width: '44px', height: '44px', border: '1px solid var(--portal-border)', background: 'white', color: '#64748b', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }} aria-label="Edit Profile">
            <Settings size={20} />
         </button>
      </div>

      <section style={{ marginBottom: '40px' }}>
         <Link href="/portal/create" style={{ textDecoration: 'none' }}>
            <div className="portal-btn-primary" style={{ 
               padding: '24px', 
               borderRadius: '24px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '16px'
            }}>
               <div style={{ background: 'rgba(255,255,255,0.15)', padding: '10px', borderRadius: '14px' }}>
                  <MessageSquare size={24} />
               </div>
               <p style={{ fontSize: '18px', fontWeight: '800' }}>แจ้งปัญหาการใช้งานใหม่</p>
            </div>
         </Link>
      </section>

      <section style={{ marginBottom: '48px' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
               ใบงานที่กำลังดำเนินการ
            </h3>
            {activeTickets.length > 0 && (
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                {activeTickets.length} กรายการ
              </span>
            )}
         </div>

         {activeTickets.length === 0 ? (
            <div className="portal-glass" style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--portal-text-muted)', borderStyle: 'dashed', borderRadius: '28px', background: 'transparent' }}>
               <Inbox size={40} style={{ marginBottom: '16px', opacity: 0.15 }} />
               <p style={{ fontSize: '14px', fontWeight: '500' }}>ขณะนี้คุณไม่มีใบงานที่ค้างอยู่</p>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
               {activeTickets.map(ticket => (
                  <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="portal-glass" style={{ padding: '20px', background: 'white', border: '1px solid rgba(0,0,0,0.03)', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                             <p style={{ fontWeight: '800', fontSize: '15px', marginBottom: '4px', color: '#1e293b' }}>#{ticket.ticket_no}</p>
                             <p className="truncate" style={{ fontSize: '13px', color: 'var(--portal-text-muted)' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                             <span style={{ 
                                background: ticket.status === 'Assigned' ? '#f0f9ff' : '#fefce8',
                                color: ticket.status === 'Assigned' ? '#0369a1' : '#a16207',
                                padding: '6px 14px',
                                fontSize: '11px',
                                fontWeight: '800',
                                borderRadius: '30px'
                             }}>{ticket.status}</span>
                             <ArrowRight size={16} color="#cbd5e1" />
                          </div>
                       </div>
                    </div>
                  </Link>
               ))}
            </div>
         )}
      </section>



      {/* 4. History (Optional) */}
      {pastTickets.length > 0 && (
        <section>
          <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Resolved History</h3>
          <div style={{ opacity: 0.6 }}>
             {pastTickets.slice(0, 3).map(ticket => (
                <div key={ticket.id} style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div>
                      <p style={{ fontSize: '13px', fontWeight: '700' }}>Ticket #{ticket.ticket_no}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(ticket.resolved_at).toLocaleDateString()}</p>
                   </div>
                   <CheckCircle size={16} color="var(--success)" />
                </div>
             ))}
          </div>
        </section>
      )}

      {/* 5. Modals */}
      <ProfileRegistrationModal 
         isOpen={needsRegistration || isEditModalOpen} 
         profile={profile} 
         existingCustomer={needsRegistration ? null : customerData}
         onComplete={() => {
            setIsEditModalOpen(false);
            fetchTickets(); // Refresh global customerData and hide registration
         }}
         onClose={() => setIsEditModalOpen(false)}
      />
    </div>
  );
}
