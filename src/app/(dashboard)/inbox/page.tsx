'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  Smile, 
  CheckCircle,
  User,
  Phone,
  Mail,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  Share2,
  Copy,
  ArrowLeft,
  Info
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { ticketService } from '@/lib/services/ticketService';
import TransferModal from '@/components/modals/TransferModal';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';

export default function InboxPage() {
  const { conversations, loading: inboxLoading } = useRealtimeInbox();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chat' | 'details'>('list');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [agent, setAgent] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);

  // 1. Fetch current agent profile
  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        setAgent(profile || user);
      }
    }
    getProfile();
  }, []);

  // 2. Fetch messages for selected chat
  useEffect(() => {
    if (!selectedChat) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedChat.id)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    }

    fetchMessages();

    // Subscribe to new messages for THIS conversation
    const channel = supabase
      .channel(`chat:${selectedChat.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${selectedChat.id}` 
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  // 3. Actions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !agent) return;

    setSending(true);
    try {
      // 1. Save to Supabase
      const { data: savedMsg, error: dbError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        sender_type: 'agent',
        sender_id: agent.id,
        content: newMessage,
        message_type: 'text'
      }]).select().single();
      
      if (dbError) throw dbError;

      // 2. Real Push to LINE
      const lineUserId = selectedChat.customers?.line_user_id;
      if (lineUserId) {
        await fetch('/api/line/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'text', text: newMessage }]
          })
        });
      }

      setNewMessage('');
    } catch (err: any) {
      console.error('Send Error:', err);
      alert('Failed to send message: ' + (err.message || 'Check API keys'));
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAttachment = async (file: File, type: 'image' | 'video' | 'file') => {
    if (!selectedChat || !agent) return;
    setSending(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${selectedChat.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);

      const dbType = type === 'image' ? 'image' : 'file';
      const { error: dbError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        sender_type: 'agent',
        sender_id: agent.id,
        content: publicUrl,
        message_type: dbType
      }]);
      if (dbError) throw dbError;

      const lineUserId = selectedChat.customers?.line_user_id;
      if (lineUserId) {
         if (type === 'image') {
           await fetch('/api/line/push', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               to: lineUserId,
               messages: [{ type: 'image', originalContentUrl: publicUrl, previewImageUrl: publicUrl }]
             })
           });
         } else {
           await fetch('/api/line/push', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({
               to: lineUserId,
               messages: [{ type: 'text', text: `📎 แนบไฟล์/เอกสาร: ${publicUrl}` }]
             })
           });
         }
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const selectChat = (chat: any) => {
    setSelectedChat(chat);
    setViewMode('chat');
  };

  const handleClaim = async () => {
    if (!selectedChat?.current_ticket_id || !agent) return;
    try {
      await ticketService.claimTicket(selectedChat.current_ticket_id, agent.id);
      alert('Conversation Claimed');
    } catch (err) {
      alert('Failed to claim ticket');
    }
  };

  const handleResolve = async () => {
    if (!selectedChat?.current_ticket_id || !agent) return;
    const summary = prompt('Enter resolution summary:');
    if (!summary) return;

    try {
      // 1. Update Database Status
      await ticketService.resolve(selectedChat.current_ticket_id, agent.id, summary);
      
      const surveyLink = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
      const lineUserId = selectedChat.customers?.line_user_id;
      const resolutionMsg = `Resolved: ${summary}\nPlease give us feedback here: ${surveyLink}`;

      // 2. Add System Message to DB
      await supabase.from('messages').insert([{
         conversation_id: selectedChat.id,
         sender_type: 'system',
         content: resolutionMsg,
         message_type: 'text'
      }]);

      // 3. Send to LINE
      if (lineUserId) {
        await fetch('/api/line/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: lineUserId,
            messages: [
              { type: 'text', text: `งานของคุณได้รับการแก้ไขแล้ว: ${summary}` },
              { type: 'text', text: `กรุณาให้คะแนนความพึงพอใจได้ที่นี่: ${surveyLink}` }
            ]
          })
        });
      }

      alert('Ticket Resolved and Notification Sent to LINE');
    } catch (err: any) {
      console.error('Resolve Error:', err);
      alert('Failed to resolve ticket: ' + (err.message || 'API Error'));
    }
  };

  const copySurveyLink = () => {
     if (!selectedChat?.current_ticket_id) return;
     const link = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
     navigator.clipboard.writeText(link);
     alert('Survey link copied to clipboard');
  };

  if (inboxLoading) return (
    <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
      <Loader2 className="animate-spin" size={32} color="var(--primary)" />
      <p style={{ color: 'var(--text-muted)' }}>Loading Inbox...</p>
    </div>
  );

  return (
    <div className="inbox-layout" style={{ display: 'flex', height: '100%', gap: '24px', animation: 'fadeIn 0.5s ease-out' }}>
      {/* 1. Left Panel: Conversation List */}
      <div className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`} style={{ width: '320px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '16px' }}>Messages</h2>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              placeholder="Search chat..." 
              style={{
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '10px 10px 10px 36px',
                color: 'white',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.length === 0 && (
             <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>No active conversations</p>
             </div>
          )}
          {conversations.map((chat) => (
            <div 
              key={chat.id} 
              onClick={() => selectChat(chat)}
              className="glass-interactive"
              style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selectedChat?.id === chat.id ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                borderColor: selectedChat?.id === chat.id ? 'rgba(0, 242, 254, 0.2)' : 'var(--border)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <p style={{ fontWeight: '700', fontSize: '15px' }}>{chat.customers?.display_name || 'LINE User'}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                   {new Date(chat.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="truncate" style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '180px' }}>{chat.status}</p>
                {chat.status === 'active' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Middle Panel: Chat Window */}
      <div className={`glass inbox-chat-panel ${viewMode !== 'chat' ? 'hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedChat ? (
           <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <button 
                  onClick={() => setViewMode('list')}
                  className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '8px' }}>
                    <ArrowLeft size={18} />
                 </button>
                 <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#0a0e14' }}>
                    {selectedChat.customers?.display_name?.charAt(0) || 'L'}
                 </div>
                 <div>
                    <p style={{ fontWeight: '700', fontSize: '15px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
                    <p style={{ fontSize: '11px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} /> Active
                    </p>
                 </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                 <button 
                  onClick={() => setViewMode('details')}
                  className="show-mobile glass-interactive flex-center" style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', color: 'var(--text-muted)' }}>
                    <Info size={18} />
                 </button>
                 <button className="glass-interactive flex-center" style={{ width: '36px', height: '36px', borderRadius: '8px', border: 'none', color: 'var(--text-muted)' }}>
                    <MoreVertical size={18} />
                 </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.map((msg) => (
                 <div key={msg.id} style={{ alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <div style={{ 
                       padding: '12px 16px', 
                       borderRadius: '16px', 
                       background: msg.sender_type === 'agent' ? 'var(--secondary)' : (msg.sender_type === 'system' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
                       border: (msg.sender_type === 'agent' || msg.sender_type === 'system') ? 'none' : '1px solid var(--border)',
                       fontSize: '14px',
                       lineHeight: '1.5',
                       boxShadow: msg.sender_type === 'agent' ? '0 4px 15px rgba(115, 103, 240, 0.3)' : 'none',
                       color: msg.sender_type === 'system' ? 'var(--primary)' : 'inherit'
                    }}>
                       {msg.message_type === 'image' || (msg.content.startsWith('http') && msg.content.match(/\.(jpeg|jpg|gif|png)$/)) ? (
                          <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '8px' }} alt="Attachment" />
                       ) : msg.message_type === 'file' || (msg.content.startsWith('http') && msg.message_type !== 'text') ? (
                          <a href={msg.content} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'inherit', fontWeight: 'bold' }}>
                             📎 Download Attachment
                          </a>
                       ) : (
                          msg.content
                       )}
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', textAlign: msg.sender_type === 'agent' ? 'right' : 'left' }}>
                       {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                 </div>
              ))}
            </div>

            <form onSubmit={handleSendMessage} style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(10, 14, 20, 0.4)' }}>
              <div className="glass" style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-input)', borderRadius: '12px' }}>
                 <button type="button" onClick={() => setIsAttachModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Paperclip size={18} /></button>
                 <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..." 
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', padding: '10px 0', fontSize: '14px' }}
                 />
                 <button 
                  type="submit"
                  disabled={sending}
                  style={{ background: 'var(--primary)', border: 'none', color: '#0a0e14', width: '36px', height: '36px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: sending ? 0.6 : 1 }}>
                    <Send size={16} />
                 </button>
              </div>
            </form>
           </>
        ) : (
           <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '50%' }}>
                 <Mail size={48} color="var(--border)" />
              </div>
              <p style={{ color: 'var(--text-muted)' }}>Select a conversation to start chatting</p>
           </div>
        )}
      </div>

      {/* 3. Right Panel: Customer Profile & Ticket Detail */}
      <div className={`glass inbox-details-panel ${viewMode !== 'details' ? 'hidden-mobile' : ''}`} style={{ width: '320px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        {selectedChat ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer Profile</h3>
               <button onClick={() => setViewMode('chat')} className="show-mobile glass-interactive flex-center" style={{ padding: '6px', borderRadius: '6px', border: 'none' }}>
                  <ArrowLeft size={16} />
               </button>
            </div>
            
            <div className="glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <User size={24} color="#0a0e14" />
                  </div>
                  <div>
                     <p className="truncate" style={{ fontWeight: '800', fontSize: '16px', width: '150px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
                     <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {selectedChat.customers?.line_user_id?.substring(0, 8)}...</p>
                  </div>
               </div>
            </div>

            <h3 style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Ticket Workspace</h3>
            
            <div className="glass" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
               <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>Ticket Number</p>
               <p className="truncate" style={{ fontWeight: '800', fontSize: '15px', marginBottom: '16px' }}>{selectedChat.current_ticket_id || 'No Active Ticket'}</p>
               
               <p style={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '4px' }}>SLA Status</p>
               <span className="badge" style={{ background: 'rgba(0, 242, 254, 0.1)', color: 'var(--primary)' }}>Healthy</span>
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               <button onClick={handleClaim} className="glass-interactive" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  Claim Task
               </button>
               <button onClick={handleResolve} className="glass-interactive" style={{ width: '100%', padding: '12px', borderRadius: '10px', background: 'var(--success)', color: 'white', border: 'none', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <CheckCircle size={18} /> Resolve
               </button>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setIsTransferModalOpen(true)} className="glass-interactive" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Share2 size={16} /> Transfer
                   </button>
                   <button onClick={copySurveyLink} className="glass-interactive" style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <Copy size={16} /> Survey
                   </button>
               </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>
            <p>No selection</p>
          </div>
        )}
      </div>

      <TransferModal 
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        ticketId={selectedChat?.current_ticket_id}
        fromAgentId={agent?.id}
        onSuccess={() => { alert('Transfer successful'); setViewMode('list'); }}
      />
      
      <ChatAttachmentModal 
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        onConfirm={handleConfirmAttachment}
      />

      <style jsx global>{`
        @media (max-width: 1024px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
