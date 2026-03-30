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
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

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
        
        // Fetch Logs
        const { data: logData } = await supabase
          .from('ticket_logs')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: false });
        if (logData) setLogs(logData);

        // Fetch Internal Messages
        const { data: msgData } = await supabase
          .from('messages')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true });
        if (msgData) setMessages(msgData);
      }
      setLoading(false);
    }
    fetchTicketData();

    // Real-time subscription for private chat
    const channel = supabase
      .channel(`customer-chat-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `ticket_id=eq.${id}`
      }, () => {
        fetchTicketData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'customer',
        content: newMessage
      }]);
      if (error) throw error;
      setNewMessage('');
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
    } finally {
      setSending(false);
    }
  };

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
       </div>

       {/* 4. Private Chat Workspace */}
       <section className="glass" style={{ padding: '24px', marginBottom: '32px', display: 'flex', flexDirection: 'column', minHeight: '350px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
             <MessageCircle size={18} color="var(--primary)" />
             <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Private Chat (Internal)</h3>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
             {messages.map((msg, idx) => (
                <div key={idx} style={{ 
                   alignSelf: msg.sender_type === 'customer' ? 'flex-end' : 'flex-start',
                   maxWidth: '85%',
                   padding: '10px 14px',
                   borderRadius: '12px',
                   background: msg.sender_type === 'customer' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                   color: msg.sender_type === 'customer' ? 'black' : 'white',
                }}>
                   <p style={{ fontSize: '14px', fontWeight: '500' }}>{msg.content}</p>
                   <p style={{ fontSize: '9px', opacity: 0.6, textAlign: 'right', marginTop: '4px' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                </div>
             ))}
             {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px' }}>No messages yet. Say hi to the agent!</p>}
          </div>

          {/* Chat Input */}
          <div style={{ display: 'flex', gap: '8px' }}>
             <input 
              type="text" 
              placeholder="Message your agent..." 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', color: 'white' }}
             />
             <button 
              onClick={handleSendMessage}
              disabled={sending}
              className="glass-interactive flex-center" 
              style={{ width: '48px', height: '44px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'black' }}>
                {sending ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={20} />}
             </button>
          </div>
       </section>

       {/* 5. Timeline / Logs */}
       <section className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
             <Clock size={16} color="var(--primary)" />
             <h3 style={{ fontSize: '16px', fontWeight: '800' }}>Progress Timeline</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderLeft: '2px solid var(--border)', marginLeft: '12px', paddingLeft: '24px' }}>
             {logs.map((log, index) => (
                <div key={log.id} style={{ position: 'relative', marginBottom: '24px' }}>
                   <div style={{ 
                      position: 'absolute', 
                      left: '-31px', 
                      top: '0', 
                      width: '10px', 
                      height: '10px', 
                      borderRadius: '50%', 
                      background: index === 0 ? 'var(--primary)' : 'var(--border)',
                   }} />
                   <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {new Date(log.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                   <p style={{ fontSize: '13px', fontWeight: '700' }}>
                      {log.action_type === 'status_change' ? `Moved to ${log.to_status}` : 'Task Update'}
                   </p>
                </div>
             ))}
          </div>
       </section>
    </div>
  );
}
