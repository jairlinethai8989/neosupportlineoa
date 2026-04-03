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
  Settings
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
      .select('id, hospital_id, department_id')
      .eq('line_user_id', profile.userId)
      .maybeSingle(); // Use maybeSingle to avoid 406 Error if none exists

    if (customer) {
      setCustomerData(customer);
      setNeedsRegistration(false);
      // Fetch all tickets for this customer
      const { data: ticketData } = await supabase
        .from('tickets')
        .select('*, profiles!assigned_agent_id(*)')
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

  const activeTickets = tickets.filter(t => t.status !== 'Resolved');
  const pastTickets = tickets.filter(t => t.status === 'Resolved');

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

      {/* 2. Active Tickets */}
      <section style={{ marginBottom: '40px' }}>
         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Active Support Tasks</h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '6px' }}>
              {activeTickets.length} ongoing
            </span>
         </div>

         {activeTickets.length === 0 ? (
            <div className="glass" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>
               <Inbox size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
               <p>No active tickets found.</p>
               <p style={{ fontSize: '12px' }}>If you need help, message us on LINE OA!</p>
            </div>
         ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               {activeTickets.map(ticket => (
                  <Link href={`/portal/tickets/${ticket.id}`} key={ticket.id} style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="glass-interactive" style={{ padding: '20px', border: '1px solid var(--border)' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                          <div>
                             <p style={{ fontWeight: '800', fontSize: '16px', marginBottom: '4px' }}>Ticket #{ticket.ticket_no}</p>
                             <p className="truncate" style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '200px' }}>{ticket.subject || 'Technical Support Request'}</p>
                          </div>
                          <span className="badge" style={{ 
                             background: ticket.status === 'Assigned' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 171, 0, 0.1)',
                             color: ticket.status === 'Assigned' ? 'var(--primary)' : 'var(--warning)',
                             padding: '6px 10px',
                             fontSize: '11px',
                             fontWeight: '800'
                          }}>{ticket.status}</span>
                       </div>

                       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <Clock size={16} color="var(--text-muted)" />
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Updated: {new Date(ticket.updated_at).toLocaleDateString()}
                          </p>
                          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', fontSize: '12px', fontWeight: '700' }}>
                            View <ExternalLink size={14} />
                          </div>
                       </div>
                    </div>
                  </Link>
               ))}
            </div>
         )}
      </section>

      {/* 3. Quick Actions */}
      <h3 style={{ fontSize: '16px', fontWeight: '800', marginBottom: '16px' }}>Quick Support</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
         <Link href="/portal/create" style={{ textDecoration: 'none' }}>
            <div className="glass-interactive flex-center" style={{ padding: '20px', flexDirection: 'row', gap: '16px', background: 'var(--primary)', color: 'black', borderRadius: '16px' }}>
               <MessageSquare size={24} />
               <p style={{ fontSize: '15px', fontWeight: '900' }}>แจ้งปัญหาใหม่ (Open New Ticket)</p>
            </div>
         </Link>
      </div>



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
