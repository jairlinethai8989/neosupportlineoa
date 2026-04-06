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
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)' }}>Initializing Support Portal...</p>
      </div>
    );
  }

  if (liffError || !profile) {
    return (
      <div className="flex-center glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid var(--danger)' }}>
        <ShieldAlert size={48} color="var(--danger)" />
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Access Restricted</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{liffError || 'Please log in via LINE application.'}</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>This portal is designed exclusively for LINE OA.</p>
        <button 
           onClick={() => setMockLogin()}
           className="glass-interactive" 
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px dotted var(--primary)', color: 'var(--primary)', fontWeight: '800', marginTop: '16px' }}
        >
           Mock Admin Login (For Testing)
        </button>
      </div>
    );
  }

  const activeStatuses = ['new', 'assigned', 'in progress', 'escalated', 'pending'];
  const activeTickets = tickets.filter(t => activeStatuses.includes(String(t.status || '').toLowerCase()));
  const pastTickets = tickets.filter(t => !activeStatuses.includes(String(t.status || '').toLowerCase()));

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* 1. Header Hero */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
         <div>
            <p style={{ color: 'var(--primary)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '11px', marginBottom: '8px' }}>Welcome Back</p>
            <h2 style={{ fontSize: '28px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px' }}>
               {profile?.displayName || 'Support Guest'}
               {profile?.pictureUrl ? (
                  <img src={profile.pictureUrl} alt="profile" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
               ) : <User size={32} />}
            </h2>
         </div>
         <button onClick={() => setIsEditModalOpen(true)} className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)' }} aria-label="Edit Profile">
            <Settings size={20} />
         </button>
      </div>

      {/* 2. Primary Action: Open New Ticket (Prominent & Minimal) */}
      <section style={{ marginBottom: '32px' }}>
         <Link href="/portal/create" style={{ textDecoration: 'none' }}>
            <div className="glass-interactive" style={{ 
               padding: '24px', 
               background: 'var(--primary)', 
               color: 'black', 
               borderRadius: '24px',
               display: 'flex',
               alignItems: 'center',
               justifyContent: 'center',
               gap: '16px',
               boxShadow: '0 12px 30px rgba(0, 242, 254, 0.2)'
            }}>
               <MessageSquare size={24} />
               <p style={{ fontSize: '17px', fontWeight: '900' }}>แจ้งปัญหาการใช้งานใหม่</p>
            </div>
         </Link>
      </section>

      {/* 3. Active Tickets (Minimal List) */}
      <section style={{ marginBottom: '40px' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
               ใบงานที่กำลังดำเนินการ
            </h3>
            {activeTickets.length > 0 && (
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', opacity: 0.8 }}>
                {activeTickets.length} รายการ
              </span>
            )}
         </div>

         {activeTickets.length === 0 ? (
            <div className="glass" style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed', borderRadius: '24px' }}>
               <Inbox size={32} style={{ marginBottom: '12px', opacity: 0.2 }} />
               <p style={{ fontSize: '13px' }}>ขณะนี้คุณไม่มีใบงานที่ค้างอยู่</p>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {activeTickets.map(ticket => (
                  <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="glass-interactive" style={{ padding: '18px 20px', border: '1px solid var(--border)', borderRadius: '20px' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                             <p style={{ fontWeight: '800', fontSize: '14px', marginBottom: '2px' }}>#{ticket.ticket_no}</p>
                             <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <span className="badge" style={{ 
                                background: ticket.status === 'Assigned' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 171, 0, 0.1)',
                                color: ticket.status === 'Assigned' ? 'var(--primary)' : 'var(--warning)',
                                padding: '4px 10px',
                                fontSize: '10px',
                                fontWeight: '900',
                                borderRadius: '20px'
                             }}>{ticket.status}</span>
                             <ArrowRight size={14} color="var(--text-muted)" />
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
