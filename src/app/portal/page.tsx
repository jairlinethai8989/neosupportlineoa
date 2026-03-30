'use client';

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
  Inbox
} from 'lucide-react';
import Link from 'next/link';

export default function PortalPage() {
  const { profile, loading: liffLoading, error: liffError } = useLiff();
  const [tickets, setTickets] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!profile?.userId) return;

    async function fetchTickets() {
      // Find customer by line_user_id
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('line_user_id', profile.userId)
        .single();

      if (customer) {
        // Fetch all tickets for this customer
        const { data: ticketData } = await supabase
          .from('tickets')
          .select('*, profiles!assigned_agent_id(*)')
          .eq('customer_id', customer.id)
          .order('created_at', { ascending: false });

        if (ticketData) setTickets(ticketData);
      }
      setFetching(false);
    }
    fetchTickets();
  }, [profile]);

  if (liffLoading || fetching) {
    return (
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)' }}>Initializing Support Portal...</p>
      </div>
    );
  }

  if (liffError) {
    return (
      <div className="flex-center glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid var(--danger)' }}>
        <ShieldAlert size={48} color="var(--danger)" />
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Access Denied</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>{liffError}</p>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>Please ensure you are accessing this portal via LINE app.</p>
      </div>
    );
  }

  const activeTickets = tickets.filter(t => t.status !== 'Resolved');
  const pastTickets = tickets.filter(t => t.status === 'Resolved');

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* 1. Header Hero */}
      <div style={{ marginBottom: '32px' }}>
         <p style={{ color: 'var(--primary)', fontWeight: '800', letterSpacing: '1px', textTransform: 'uppercase', fontSize: '11px', marginBottom: '8px' }}>Welcome Back</p>
         <h2 style={{ fontSize: '28px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px' }}>
            {profile?.displayName || 'Support Guest'}
            {profile?.pictureUrl ? (
               <img src={profile.pictureUrl} alt="profile" style={{ width: '36px', height: '36px', borderRadius: '50%', border: '2px solid var(--primary)' }} />
            ) : <User size={32} />}
         </h2>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
         <div className="glass-interactive flex-center" style={{ height: '100px', flexDirection: 'column', gap: '10px' }}>
            <MessageSquare size={24} color="var(--primary)" />
            <p style={{ fontSize: '12px', fontWeight: '700' }}>FAQ Center</p>
         </div>
         <div className="glass-interactive flex-center" style={{ height: '100px', flexDirection: 'column', gap: '10px' }}>
            <CheckCircle size={24} color="var(--success)" />
            <p style={{ fontSize: '12px', fontWeight: '700' }}>Tutorials</p>
         </div>
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

      <style jsx global>{`
        .badge {
          border-radius: 6px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
