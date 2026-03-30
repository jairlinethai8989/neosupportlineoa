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
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        {/* Main Area: Chat Workspace (Left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div className="glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Chat Workspace</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,255,127,0.1)', borderRadius: '20px' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                   <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '800' }}>LIVE SESSION</span>
                </div>
              </div>
              
              {/* Message History */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '12px' }}>
                 {messages.map((msg, idx) => (
                    <div key={idx} style={{ 
                       alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                       maxWidth: '75%',
                       display: 'flex',
                       flexDirection: 'column',
                       alignItems: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start'
                    }}>
                       <div style={{ 
                          padding: '12px 18px',
                          borderRadius: '18px',
                          borderTopRightRadius: msg.sender_type === 'agent' ? '4px' : '18px',
                          borderTopLeftRadius: msg.sender_type === 'customer' ? '4px' : '18px',
                          background: msg.sender_type === 'agent' ? 'var(--primary)' : 'var(--secondary)',
                          color: msg.sender_type === 'agent' ? 'black' : 'var(--text)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                       }}>
                          <p style={{ fontSize: '14px', fontWeight: msg.sender_type === 'agent' ? '700' : '500', lineHeight: '1.5' }}>{msg.content}</p>
                       </div>
                       <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '600' }}>
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {msg.sender_type === 'agent' && ' • Sent by you'}
                       </p>
                    </div>
                 ))}
                 {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.3 }}>
                       <MessageSquare size={48} style={{ marginBottom: '16px' }} />
                       <p style={{ fontSize: '16px', fontWeight: '800' }}>No messages yet</p>
                       <p style={{ fontSize: '12px' }}>Start supporting your customer</p>
                    </div>
                 )}
              </div>

              {/* Input Area */}
              <div style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                 <input 
                    type="text" 
                    placeholder="Type your response to customer..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px', color: 'var(--text)', fontSize: '14px', fontWeight: '500', outline: 'none' }}
                 />
                 <button 
                  onClick={handleSendMessage}
                  disabled={sending}
                  className="glass-interactive flex-center" 
                  style={{ width: '48px', height: '48px', borderRadius: '12px', border: 'none', background: 'var(--primary)', color: 'black' }}>
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={20} />}
                 </button>
              </div>
           </div>
        </div>

        {/* Sidebar Space (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           {/* 1. Customer Context */}
           <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                 <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--secondary)', overflow: 'hidden' }}>
                    {ticket.customers?.avatar_url ? (
                       <img src={ticket.customers.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <User size={24} />}
                 </div>
                 <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>{ticket.customers?.display_name || 'Customer'}</h4>
                    <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(0,242,254,0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: '800' }}>CUSTOMER</span>
                 </div>
              </div>
              <button className="glass-interactive" style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border)' }}>View Full Profile</button>
           </div>

           {/* 2. Issue Overview (Smaller) */}
           <div className="glass" style={{ padding: '20px' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Issue Details</label>
              <h5 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', lineHeight: '1.4' }}>{ticket.subject}</h5>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div>
                    <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
                    <select 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700' }}
                    >
                      <option value="New">Pending</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                 </div>
                 <div>
                    <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Priority</label>
                    <select 
                      value={priority} 
                      onChange={(e) => setPriority(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700' }}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                 </div>
              </div>
           </div>

           {/* 3. Timeline (Compressed) */}
           <div className="glass" style={{ padding: '20px' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Recent activity</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', marginLeft: '6px', paddingLeft: '16px' }}>
                 {logs.slice(0, 3).map((log, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                       <div style={{ position: 'absolute', left: '-19.5px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                       <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleDateString()}</p>
                       <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
                          {log.action_type === 'status_change' ? `Modified to ${log.to_status}` : log.action_type}
                       </p>
                    </div>
                 ))}
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
