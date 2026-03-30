'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare,
  ShieldAlert,
  Loader2,
  Save,
  Trash2,
  MoreVertical,
  SendHorizontal
} from 'lucide-react';

export default function StaffTicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // State for editing
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const [chatLoading, setChatLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      const { data: ticketData } = await supabase
        .from('tickets')
        .select(`
          *,
          customers (*),
          profiles:assigned_agent_id(*)
        `)
        .eq('id', id)
        .single();

      if (ticketData) {
        setTicket(ticketData);
        setStatus(ticketData.status);
        setPriority(ticketData.priority);

        // Fetch Logs
        const { data: logData } = await supabase
          .from('ticket_logs')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: false });
        if (logData) setLogs(logData);

        // Fetch Internal Messages for this ticket
        const { data: messageData } = await supabase
          .from('messages')
          .select('*')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true });
        
        if (messageData) setMessages(messageData);
      }
      setLoading(false);
      setChatLoading(false);
    }

    fetchData();

    // Subscribe to new messages for THIS ticket
    const channel = supabase
      .channel(`ticket-messages-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `ticket_id=eq.${id}`
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Create optimistic message
    const optimisticMsg = {
       content: newMessage,
       sender_type: 'agent',
       created_at: new Date().toISOString(),
       ticket_id: id
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    const messageToSend = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      // INTERNAL ONLY: Save to Supabase messages table
      const { error } = await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'agent',
        content: messageToSend
      }]);

      if (error) throw error;
    } catch (err: any) {
      alert('Error: ' + err.message);
      // Rollback on error if needed
      setMessages(prev => prev.filter(m => m !== optimisticMsg));
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ status: 'Resolved', updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // 1. Add Log
      await supabase.from('ticket_logs').insert([{
        ticket_id: id,
        action_type: 'status_change',
        from_status: ticket.status,
        to_status: 'Resolved',
        note: 'Agent formally resolved the ticket.'
      }]);

      // 2. Send automated closing message to private chat
      await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'agent',
        content: '[System: ใบงานนี้ได้รับการแก้ไขเรียบร้อยแล้ว และระบบสิ้นสุดการสนทนาขอบคุณที่ใช้บริการครับ 🙏]'
      }]);

      setStatus('Resolved');
      setTicket({ ...ticket, status: 'Resolved' });
      
      // Refresh logs & messages
      const { data: newLogs } = await supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false });
      if (newLogs) setLogs(newLogs);
      
      const { data: newMsgs } = await supabase.from('messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
      if (newMsgs) setMessages(newMsgs);

      // Trigger SUCCESS FEEDBACK
      setToastMsg('Ticket resolved successfully! 🎉');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (err: any) {
      alert('Failed to resolve: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status, 
          priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Add a log entry for the change
      if (status !== ticket.status) {
        await supabase.from('ticket_logs').insert([{
          ticket_id: id,
          action_type: 'status_change',
          from_status: ticket.status,
          to_status: status,
          note: `Agent updated status to ${status}`
        }]);
      }

      setTicket({ ...ticket, status, priority });
      
      // Refresh logs
      const { data: newLogs } = await supabase
        .from('ticket_logs')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false });
      if (newLogs) setLogs(newLogs);
      
      // Trigger SUCCESS FEEDBACK
      setToastMsg('Changes saved successfully! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (err: any) {
      alert('Failed to update ticket: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex-center" style={{ height: '70vh' }}>
      <Loader2 className="animate-spin" size={32} color="var(--primary)" />
    </div>
  );

  if (!ticket) return (
    <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '20px' }}>
      <ShieldAlert size={64} color="var(--danger)" />
      <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Ticket Not Found</h2>
      <button onClick={() => router.push('/tickets')} className="glass-interactive" style={{ padding: '12px 24px', borderRadius: '12px' }}>
        Back to List
      </button>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Navbar Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.push('/tickets')} className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>#{ticket.ticket_no}</h1>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', background: 'rgba(255, 171, 0, 0.1)', color: 'var(--warning)', letterSpacing: '1px' }}>
                 {ticket.status.toUpperCase()}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Ticket Details & Management</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {status !== 'Resolved' && status !== 'Closed' && (
            <button 
              onClick={handleResolve}
              disabled={updating}
              className="glass-interactive flex-center" 
              style={{ padding: '0 20px', height: '44px', borderRadius: '12px', border: '1px solid var(--success)', background: 'rgba(0, 255, 127, 0.1)', color: 'var(--success)', fontWeight: '800', gap: '8px' }}>
              {updating ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} End Conversation
            </button>
          )}
          <button 
            onClick={handleUpdate}
            disabled={updating}
            className="glass-interactive flex-center" 
            style={{ padding: '0 20px', height: '44px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'var(--primary)', color: 'black', fontWeight: '800', gap: '8px' }}>
            {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
          </button>
          <button className="glass-interactive flex-center" style={{ width: '44px', height: '44px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--danger)' }}>
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '24px' }}>
        {/* Left Column: Details & Timeline */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Main Info Card */}
          <div className="glass" style={{ padding: '32px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={20} color="var(--primary)" /> Issue Overview
            </h3>
            
            <div style={{ marginBottom: '32px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Subject</label>
              <h2 style={{ fontSize: '22px', fontWeight: '800' }}>{ticket.subject}</h2>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Current Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontWeight: '700' }}
                >
                  <option value="New">Pending</option>
                  <option value="Assigned">Assigned</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Escalated">Escalated</option>
                  <option value="Resolved">Resolved</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Set Priority</label>
                <select 
                  value={priority} 
                  onChange={(e) => setPriority(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontWeight: '700' }}
                >
                  <option value="Low">Low Priority</option>
                  <option value="Medium">Medium Priority</option>
                  <option value="High">High Priority</option>
                </select>
              </div>
            </div>
          </div>

          {/* Timeline Card */}
          <div className="glass" style={{ padding: '32px' }}>
             <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Clock size={20} color="var(--primary)" /> Case Timeline
             </h3>
             <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderLeft: '2px solid var(--border)', marginLeft: '12px', paddingLeft: '24px' }}>
                {logs.map((log, idx) => (
                  <div key={idx} style={{ position: 'relative', marginBottom: '32px' }}>
                    <div style={{ 
                      position: 'absolute', 
                      left: '-31px', 
                      top: '0', 
                      width: '12px', 
                      height: '12px', 
                      borderRadius: '50%', 
                      background: idx === 0 ? 'var(--primary)' : 'var(--border)',
                      border: idx === 0 ? '4px solid rgba(0, 242, 254, 0.2)' : 'none'
                    }} />
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: '800' }}>
                       {log.action_type === 'status_change' ? `Status changed from ${log.from_status} to ${log.to_status}` : log.action_type}
                    </p>
                    {log.note && <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '8px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>{log.note}</p>}
                  </div>
                ))}
                {logs.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No logs yet.</p>}
             </div>
          </div>
        </div>

        {/* Right Column: Customer & Chat Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           {/* Customer Card */}
           <div className="glass" style={{ padding: '32px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>Customer Profile</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
                 <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    {ticket.customers?.avatar_url ? (
                       <img src={ticket.customers.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <User size={32} />}
                 </div>
                 <div>
                    <h4 style={{ fontSize: '18px', fontWeight: '800' }}>{ticket.customers?.display_name || 'Neo Customer'}</h4>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>LINE Channel Partner</p>
                 </div>
              </div>
              
              <div style={{ padding: '20px', borderRadius: '16px', background: 'rgba(0, 242, 254, 0.05)', border: '1px solid rgba(0, 242, 254, 0.1)' }}>
                 <p style={{ fontSize: '12px', lineHeight: '1.6', color: 'rgba(255,255,255,0.7)' }}>
                    Customer linked via LINE Messaging API. Metadata includes LINE User ID and Profile Sync.
                 </p>
              </div>
           </div>

           {/* Chat Workspace */}
           <div className="glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', minHeight: '400px' }}>
              <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>Chat Workspace</label>
              
              {/* Message History */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                 {messages.map((msg, idx) => (
                    <div key={idx} style={{ 
                       alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                       maxWidth: '85%',
                       padding: '10px 14px',
                       borderRadius: '12px',
                       background: msg.sender_type === 'agent' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                       color: msg.sender_type === 'agent' ? 'black' : 'white',
                    }}>
                       <p style={{ fontSize: '13px', fontWeight: msg.sender_type === 'agent' ? '700' : '500' }}>{msg.content}</p>
                       <p style={{ fontSize: '9px', opacity: 0.6, textAlign: 'right', marginTop: '4px' }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                 ))}
                 {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '40px', opacity: 0.3 }}>
                       <MessageSquare size={32} style={{ marginBottom: '10px' }} />
                       <p style={{ fontSize: '12px' }}>Start conversation...</p>
                    </div>
                 )}
              </div>

              {/* Input Area */}
              <div style={{ display: 'flex', gap: '10px' }}>
                 <input 
                    type="text" 
                    placeholder="Type message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 16px', color: 'white' }}
                 />
                  <button 
                  onClick={handleSendMessage}
                  disabled={sending}
                  className="glass-interactive flex-center" 
                  style={{ width: '44px', height: '44px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'black' }}>
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
                 </button>
              </div>
           </div>
        </div>
      </div>
       {/* Success Toast */}
       {showToast && (
         <div style={{
           position: 'fixed',
           top: '24px',
           right: '24px',
           background: 'var(--success)',
           color: 'black',
           padding: '16px 24px',
           borderRadius: '12px',
           fontWeight: '800',
           display: 'flex',
           alignItems: 'center',
           gap: '12px',
           boxShadow: '0 8px 32px rgba(0, 255, 127, 0.3)',
           zIndex: 9999,
           animation: 'slideInRight 0.3s ease-out'
         }}>
           <CheckCircle size={20} />
           {toastMsg}
         </div>
       )}
    </div>
  );
}
