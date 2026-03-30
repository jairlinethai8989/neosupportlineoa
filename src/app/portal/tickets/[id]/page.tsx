'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Clock, 
  CheckCircle, 
  MessageCircle, 
  User, 
  Loader2,
  Calendar,
  AlertCircle,
  FileText
} from 'lucide-react';

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function fetchTicketData() {
      const { data: ticketData } = await supabase
        .from('tickets')
        .select(`
          *,
          assigned_agent:profiles!assigned_agent_id(*),
          assigned_team:teams!assigned_team_id(*)
        `)
        .eq('id', id)
        .single();

      if (ticketData) {
        setTicket(ticketData);
        const { data: logData } = await supabase
          .from('ticket_logs')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: false });
        if (logData) setLogs(logData);
      }
      setLoading(false);
    }
    fetchTicketData();
  }, [id]);

  if (loading) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
     </div>
  );

  if (!ticket) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14', color: 'white', flexDirection: 'column', gap: '16px' }}>
        <AlertCircle size={48} color="var(--danger)" />
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Ticket Not Found</h2>
        <button onClick={() => router.push('/portal')} className="glass-interactive" style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', color: 'white' }}>
           Back to Portal
        </button>
     </div>
  );

  // Status mapping for visual tracker
  const statusLevels: any = {
    'Pending': 1,
    'Assigned': 2,
    'Escalated': 3,
    'Resolved': 4
  };
  const currentLevel = statusLevels[ticket.status] || 1;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
       {/* 1. Navbar */}
       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <button onClick={() => router.push('/portal')} className="glass-interactive" style={{ padding: '8px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white' }}>
             <ArrowLeft size={24} />
          </button>
          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>#{ticket.ticket_no} Details</h2>
       </div>

       {/* 2. Status Tracker */}
       <section className="glass" style={{ padding: '24px', marginBottom: '32px', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
             <h3 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current Status</h3>
             <span style={{ fontSize: '14px', fontWeight: '900', color: ticket.status === 'Resolved' ? 'var(--success)' : 'var(--primary)' }}>
                {ticket.status}
             </span>
          </div>

          {/* Progress Bar */}
          <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden', display: 'flex', gap: '4px', marginBottom: '24px' }}>
             {[1, 2, 3, 4].map(step => (
                <div key={step} style={{ 
                   flex: 1, 
                   background: step <= currentLevel ? (ticket.status === 'Resolved' ? 'var(--success)' : 'var(--primary)') : 'transparent',
                   transition: 'background 0.3s ease'
                }} />
             ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
             <span>Pending</span>
             <span>In Progress</span>
             <span>Escalated</span>
             <span>Resolved</span>
          </div>
       </section>

       {/* 3. Ticket Info Grid */}
       <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '32px' }}>
          <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FileText size={18} color="var(--primary)" />
                <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Work Subject</p>
             </div>
             <p style={{ fontSize: '18px', fontWeight: '700' }}>{ticket.subject || 'Standard Request'}</p>
          </div>

          <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <User size={18} color="var(--primary)" />
                <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Assigned Agent</p>
             </div>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   {ticket.assigned_agent?.avatar_url ? (
                      <img src={ticket.assigned_agent.avatar_url} alt="agent" style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
                   ) : <User size={20} />}
                </div>
                <div>
                   <p style={{ fontWeight: '700', fontSize: '15px' }}>{ticket.assigned_agent?.full_name || 'System Auto'}</p>
                   <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ticket.assigned_team?.name || 'Support Team'}</p>
                </div>
             </div>
          </div>
       </div>

       {/* 4. Timeline / Logs */}
       <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
             <Clock size={16} color="var(--primary)" />
             <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Progress Timeline</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderLeft: '2px solid var(--border)', marginLeft: '12px', paddingLeft: '24px' }}>
             {logs.map((log, index) => (
                <div key={log.id} style={{ position: 'relative', marginBottom: '32px' }}>
                   <div style={{ 
                      position: 'absolute', 
                      left: '-31px', 
                      top: '0', 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: index === 0 ? 'var(--primary)' : 'var(--border)',
                      border: index === 0 ? '4px solid rgba(0, 242, 254, 0.2)' : 'none'
                   }} />
                   <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                   <p style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>
                      {log.action_type === 'status_change' ? `Moved to ${log.to_status}` : 
                       log.action_type === 'resolve' ? 'Ticket Resolved' : 
                       log.action_type === 'claim' ? 'Agent Claimed' : 'Task Update'}
                   </p>
                   {log.note && (
                      <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
                         "{log.note}"
                      </p>
                   )}
                </div>
             ))}
             {logs.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Waiting for updates...</p>
             )}
          </div>
       </section>

       {/* 5. Quick Resolve Button if needed or Help */}
       <div style={{ marginTop: '40px', textAlign: 'center' }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Need more assistance with this ticket?</p>
          <button onClick={() => window.open(`https://line.me/R/oaMessage/${process.env.NEXT_PUBLIC_LINE_BOT_ID || ''}/?Ticket%20%23${ticket.ticket_no}`)} className="glass-interactive" style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
             <MessageCircle size={18} /> Chat with Agent
          </button>
       </div>
    </div>
  );
}
