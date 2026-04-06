'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Clock, 
  MessageCircle, 
  Loader2,
  AlertCircle,
  FileText,
  SendHorizontal,
  Paperclip
} from 'lucide-react';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';
import { useLiff } from '@/hooks/useLiff';

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isReady, profile, error: liffError, setMockLogin } = useLiff();
  const [ticket, setTicket] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    async function fetchTicketData() {
      if (!id) return;
      setLoading(true);
      try {
        // Stage 1: Fetch Base Ticket
        const { data: tBase, error: e1 } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (e1) throw e1;
        if (!tBase) {
           console.warn('Ticket not found for ID:', id);
           setLoading(false);
           return;
        }

        // Stage 2: Attempt Relations
        const { data: ticketData, error: e2 } = await supabase
          .from('tickets')
          .select(`
            *,
            assigned_agent:profiles!assigned_agent_id(*)
          `)
          .eq('id', id)
          .maybeSingle();

        if (ticketData) {
          setTicket(ticketData);
        } else {
          setTicket(tBase);
        }
        
        // 1. Fetch linked conversation FIRST
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .eq('current_ticket_id', id)
          .maybeSingle();

        const cid = convData?.id || null;
        if (cid) setConversationId(cid);

        // 2. Fetch Logs & Messages
        const [lRes, mRes] = await Promise.all([
           supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
           supabase.from('messages')
             .select('*')
             .or(`ticket_id.eq.${id}${cid ? `,conversation_id.eq.${cid}` : ''}`)
             .order('created_at', { ascending: true })
        ]);

        if (lRes.data) setLogs(lRes.data);
        if (mRes.data) setMessages(mRes.data);

      } catch (err: any) {
        console.error('Error fetching ticket:', err);
      } finally {
        setLoading(false);
      }
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
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${conversationId || 'none'}`
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
    
    // Optimistic Update
    const optimisticMsg = {
       content: newMessage,
       sender_type: 'customer',
       created_at: new Date().toISOString(),
       ticket_id: id
    };
    setMessages(prev => [...prev, optimisticMsg]);
    const messageToSend = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert([{
        ticket_id: id,
        conversation_id: conversationId,
        sender_type: 'customer',
        content: messageToSend
      }]);
      if (error) throw error;
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
      setMessages(prev => prev.filter(m => m !== optimisticMsg));
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAttachment = async (file: File, type: 'image' | 'video' | 'file') => {
    setSending(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);

      const dbType = type === 'image' ? 'image' : 'file';
      const { error: dbError } = await supabase.from('messages').insert([{
        ticket_id: id,
        conversation_id: conversationId,
        sender_type: 'customer',
        content: publicUrl,
        message_type: dbType
      }]);
      if (dbError) throw dbError;
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isReady || loading) return (
     <div className="flex-center" style={{ height: '100vh', background: '#0a0e14' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
     </div>
  );

  if (liffError || !profile) {
    return (
      <div className="flex-center glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid var(--danger)' }}>
        <AlertCircle size={48} color="var(--danger)" />
        <h2 style={{ fontSize: '20px', fontWeight: '800' }}>Access Restricted</h2>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '14px' }}>Please log in via LINE application.</p>
        <button 
           onClick={() => setMockLogin('U_MOCK_ADMIN', 'Guest Admin')}
           className="glass-interactive" 
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px dotted var(--primary)', color: 'var(--primary)', fontWeight: '800', marginTop: '16px' }}
        >
           Mock Login (For Testing)
        </button>
      </div>
    );
  }

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

       {/* 2. Private Chat Workspace (MOVED TO TOP) */}
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
                   <p style={{ fontSize: '14px', fontWeight: '500' }}>
                       {msg.message_type === 'image' || (msg.content?.startsWith('http') && msg.content?.match(/\.(jpeg|jpg|gif|png)$/i)) ? (
                          <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '8px' }} alt="Attachment" />
                       ) : msg.message_type === 'file' || (msg.content?.startsWith('http') && msg.message_type !== 'text') ? (
                          <a href={msg.content} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}>
                             📎 Download Attachment
                          </a>
                       ) : (
                          msg.content
                       )}
                   </p>
                   <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '500' }}>
                      {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                   </p>
                </div>
             ))}
             {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', marginTop: '40px' }}>No messages yet. Say hi to the agent!</p>}
          </div>

          {/* Chat Input */}
          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setIsAttachModalOpen(true)} className="glass-interactive flex-center" style={{ width: '48px', height: '44px', borderRadius: '10px', border: 'none', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)' }}>
                 <Paperclip size={20} />
              </button>
              <input 
                type="text" 
                placeholder="Message your agent..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', color: 'white' }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={sending}
                className="glass-interactive flex-center" 
                style={{ width: '48px', height: '44px', borderRadius: '10px', border: 'none', background: 'var(--primary)', color: 'black' }}>
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={20} />}
              </button>
            </div>
          ) : (
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0, 255, 127, 0.05)', border: '1px dotted var(--success)', textAlign: 'center' }}>
               <p style={{ fontSize: '12px', color: 'var(--success)', fontWeight: '700' }}>
                  ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ
               </p>
            </div>
          )}
       </section>

       {/* 3. Status Tracker */}
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

       {/* 4. Ticket Info Grid */}
       <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '32px' }}>
          <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <FileText size={18} color="var(--primary)" />
                <p style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Work Subject</p>
             </div>
             <p style={{ fontSize: '18px', fontWeight: '700' }}>{ticket.subject || 'Standard Request'}</p>
          </div>
       </div>

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

        <ChatAttachmentModal 
          isOpen={isAttachModalOpen}
          onClose={() => setIsAttachModalOpen(false)}
          onConfirm={handleConfirmAttachment}
        />
    </div>
  );
}
