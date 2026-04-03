'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
import { 
  Search, 
  MoreVertical, 
  Send, 
  Paperclip, 
  CheckCircle,
  User,
  Loader2,
  Share2,
  Copy,
  ArrowLeft,
  Info,
  Mail,
  History,
  Clock,
  Layout,
  Pencil
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { ticketService } from '@/lib/services/ticketService';
import TransferModal from '@/components/modals/TransferModal';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';
import ImageEditorModal from '@/components/modals/ImageEditorModal';

function InboxContent() {
  const { conversations, loading: inboxLoading } = useRealtimeInbox();
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chat' | 'details'>('list');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [agent, setAgent] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState(false);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 0. Initial URL-based selection
  useEffect(() => {
    if (cid && conversations.length > 0) {
      const target = conversations.find((c: any) => c.id === cid);
      if (target) {
        setSelectedChat(target);
        if (window.innerWidth <= 1024) setViewMode('chat');
      }
    }
  }, [cid, conversations]);

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

      if (selectedChat.current_ticket_id) {
        const { data: ticket } = await supabase.from('tickets').select('*').eq('id', selectedChat.current_ticket_id).single();
        setCurrentTicket(ticket);
      } else {
        setCurrentTicket(null);
      }
    }

    fetchMessages();

    // Subscribe to ALL new messages and filter in JS to avoid subscription limits
    const channel = supabase
      .channel(`chat_realtime`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        // Show if matches conversation OR active ticket
        const matchConv = payload.new.conversation_id === selectedChat.id;
        const matchTicket = selectedChat.current_ticket_id && payload.new.ticket_id === selectedChat.current_ticket_id;
        
        if (matchConv || matchTicket) {
          setMessages(prev => [...prev, payload.new]);
        }
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

    const currentMsg = newMessage;
    setNewMessage('');
    setSending(true);
    try {
      const { error: dbError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        ticket_id: selectedChat.current_ticket_id || null,
        sender_type: 'agent',
        sender_id: agent.id,
        content: currentMsg,
        message_type: 'text'
      }]);
      
      if (dbError) throw dbError;

      // Update conversation last message timestamp
      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', selectedChat.id);

    } catch (err: any) {
      console.error('Send Error:', err);
      alert('Failed to send message: ' + (err.message || 'Check connection'));
      setNewMessage(currentMsg);
    } finally {
      setSending(false);
    }
  };

  const handleSaveEditedImage = async (blob: Blob) => {
    if (!selectedChat || !agent) return;
    
    try {
      // 1. Upload to Supabase Storage
      const fileName = `edited_${Date.now()}.jpg`;
      const filePath = `chat/${selectedChat.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('chat_media')
        .upload(filePath, blob, { contentType: 'image/jpeg' });
        
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      
      // 2. Send Message
      const { error: msgError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        ticket_id: selectedChat.current_ticket_id || null,
        sender_type: 'agent',
        sender_id: agent.id,
        content: publicUrl,
        message_type: 'image'
      }]);
      
      if (msgError) throw msgError;

      // Update timestamp
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selectedChat.id);
      
      setEditingImageUrl(null);
    } catch (err: any) {
      console.error('Save edited image error:', err);
      alert('ไม่สามารถส่งรูปภาพที่แก้ไขได้: ' + err.message);
    }
  };

  const handleConfirmAttachment = async (file: File, type: 'image' | 'video' | 'file') => {
    if (!selectedChat || !agent) return;
    setSending(true);
    try {
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `chat/${selectedChat.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);

      const dbType = type === 'image' ? 'image' : 'file';
      const { error: dbError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        ticket_id: selectedChat.current_ticket_id || null,
        sender_type: 'agent',
        sender_id: agent.id,
        content: publicUrl,
        message_type: dbType
      }]);
      if (dbError) throw dbError;

      await supabase.from('conversations').update({
        last_message_at: new Date().toISOString()
      }).eq('id', selectedChat.id);

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
    } catch (err) {
      alert('Failed to claim ticket');
    }
  };

  const handleResolve = async () => {
    if (!selectedChat?.current_ticket_id || !agent) return;
    const summary = prompt('กรอกสรุปการแก้ไขงาน (Resolution Summary):');
    if (!summary) return;

    try {
      await ticketService.resolve(selectedChat.current_ticket_id, agent.id, summary);
      
      const surveyLink = `${window.location.origin}/portal/survey/${selectedChat.current_ticket_id}`;
      const resolutionMsg = `[SYSTEM] งานได้รับการแก้ไขแล้ว: ${summary}\nแบบประเมิน: ${surveyLink}`;

      await supabase.from('messages').insert([{
         conversation_id: selectedChat.id,
         sender_type: 'system',
         content: resolutionMsg,
         message_type: 'text'
      }]);

      alert('ปิดงานสำเร็จ! ส่งแบบประเมินไปยัง LIFF เรียบร้อย');
    } catch (err: any) {
      console.error('Resolve Error:', err);
      alert('Failed to resolve ticket: ' + (err.message || 'API Error'));
    }
  };

  const copySurveyLink = () => {
     if (!selectedChat?.current_ticket_id) return;
     const surveyLink = `${window.location.origin}/portal/survey/${selectedChat.current_ticket_id}`;
     navigator.clipboard.writeText(surveyLink);
     alert('คัดลอกลิงก์แบบประเมินแล้ว');
  };

  if (inboxLoading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div className="inbox-container" style={{ display: 'flex', height: 'calc(100vh - 100px)', gap: '24px', animation: 'fadeIn 0.5s ease-out' }}>
      
      {/* 1. Left Panel: Conversations List */}
      <div className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`} style={{ width: '380px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '16px' }}>Inbox</h2>
          <div className="glass" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', background: 'var(--bg-input)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <Search size={18} color="var(--text-muted)" />
            <input type="text" placeholder="ค้นหาการสนทนา..." style={{ background: 'none', border: 'none', outline: 'none', color: 'white', flex: 1, fontSize: '14px' }} />
          </div>
        </div>
        
        <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.map((chat: any) => (
            <div 
              key={chat.id} 
              onClick={() => selectChat(chat)}
              className="glass-interactive"
              style={{ 
                padding: '16px 24px', 
                borderBottom: '1px solid var(--border)', 
                cursor: 'pointer',
                background: selectedChat?.id === chat.id ? 'rgba(0, 242, 254, 0.05)' : 'none',
                borderLeft: selectedChat?.id === chat.id ? '4px solid var(--primary)' : '4px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                <div style={{ position: 'relative' }}>
                   <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <User size={24} color="var(--primary)" />
                   </div>
                   {chat.unread_count > 0 && <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '18px', height: '18px', background: 'var(--danger)', borderRadius: '50%', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', border: '2px solid #0a0e14' }}>{chat.unread_count}</div>}
                </div>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <p style={{ fontWeight: '700', fontSize: '15px' }}>{chat.customers?.display_name || 'LINE User'}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(chat.last_message_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <p className="truncate" style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{chat.last_message || 'เริ่มการสนทนาใหม่'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Middle Panel: Chat Window */}
      <div className={`glass inbox-chat-panel ${viewMode !== 'chat' ? 'hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(10, 14, 20, 0.4)' }}>
        {selectedChat ? (
           <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(10, 14, 20, 0.6)' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button onClick={() => setViewMode('list')} className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: 'none' }}>
                     <ArrowLeft size={18} />
                  </button>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <User size={20} color="#0a0e14" />
                  </div>
                  <div>
                    <p style={{ fontWeight: '800', fontSize: '15px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#28c76f' }} />
                       <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Real-time Connected</p>
                    </div>
                  </div>
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setViewMode('details')} className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: 'none' }}>
                     <Info size={18} />
                  </button>
                  <button className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'none', border: 'none', color: 'var(--text-muted)' }}>
                    <MoreVertical size={20} />
                  </button>
               </div>
            </div>

            <div className="no-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {messages.map((msg: any) => (
                 <div key={msg.id} style={{ alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div style={{ 
                       padding: '12px 18px', 
                       borderRadius: msg.sender_type === 'agent' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                       background: msg.sender_type === 'agent' ? 'var(--secondary)' : (msg.sender_type === 'system' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255, 255, 255, 0.05)'),
                       border: '1px solid ' + (msg.sender_type === 'agent' ? 'rgba(115, 103, 240, 0.2)' : 'rgba(255,255,255,0.05)'),
                       fontSize: '14px',
                       lineHeight: '1.6',
                       boxShadow: msg.sender_type === 'agent' ? '0 4px 15px rgba(115, 103, 240, 0.2)' : 'none',
                       color: msg.sender_type === 'system' ? 'var(--primary)' : 'white'
                    }}>
                        {msg.message_type === 'image' || (msg.content.startsWith('http') && msg.content.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i)) ? (
                           <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden' }} className="image-msg-container">
                             <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="Attachment" />
                             <button 
                               onClick={() => setEditingImageUrl(msg.content)}
                               className="edit-img-btn"
                               style={{
                                 position: 'absolute', top: '8px', right: '8px',
                                 background: 'rgba(0,0,0,0.6)', border: 'none', color: 'white',
                                 padding: '8px', borderRadius: '8px', cursor: 'pointer',
                                 display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '700',
                                 backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s'
                               }}
                             >
                                <Pencil size={14} /> แก้ไขภาพ
                             </button>
                           </div>
                        ) : msg.message_type === 'file' || (msg.content.startsWith('http') && msg.message_type !== 'text' && !msg.content.includes('/portal/')) ? (
                           <a href={msg.content} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                              <Clock size={16} /> ดูไฟล์แนบ
                           </a>
                        ) : (
                           msg.content
                        )}
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', textAlign: msg.sender_type === 'agent' ? 'right' : 'left', opacity: 0.7 }}>
                       {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </p>
                 </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'rgba(10, 14, 20, 0.6)' }}>
              <div className="glass" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-input)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                 <button type="button" onClick={() => setIsAttachModalOpen(true)} className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Paperclip size={20} /></button>
                 <input 
                    type="text" 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="พิมพ์ข้อความตอบกลับ..." 
                    style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'white', padding: '12px 0', fontSize: '14px' }}
                 />
                 <button 
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  style={{ 
                    background: 'var(--primary)', 
                    border: 'none', 
                    color: '#0a0e14', 
                    width: '42px', 
                    height: '36px', 
                    borderRadius: '10px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    opacity: (sending || !newMessage.trim()) ? 0.4 : 1 
                  }}>
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                 </button>
              </div>
            </form>
           </>
        ) : (
           <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '20px' }}>
              <div className="glass" style={{ width: '120px', height: '120px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed var(--border)' }}>
                 <Mail size={48} color="var(--border)" style={{ opacity: 0.3 }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', marginBottom: '8px' }}>กล่องแชทส่วนกลาง</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: '300px', fontSize: '14px' }}>เลือกการสนทนาทางด้านซ้ายเพื่อเริ่มต้นพูดคุยกับลูกค้าแบบ Real-time</p>
              </div>
           </div>
        )}
      </div>

      {/* 3. Right Panel: Customer Profile & Ticket Detail */}
      <div className={`glass inbox-details-panel ${viewMode !== 'details' ? 'hidden-mobile' : ''}`} style={{ width: '360px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        {selectedChat ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color="var(--primary)" />
                  <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Customer Meta</h3>
               </div>
               <button onClick={() => setViewMode('chat')} className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: 'none' }}>
                  <ArrowLeft size={18} />
               </button>
            </div>
            
            <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
               <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,242,254,0.3)' }}>
                     <User size={40} color="#0a0e14" />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                     <p style={{ fontWeight: '800', fontSize: '18px', marginBottom: '4px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
                     <code style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                        ID: {selectedChat.customers?.line_user_id?.substring(0, 16)}...
                     </code>
                  </div>
               </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <Layout size={16} color="var(--primary)" />
               <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Ticket Info</h3>
            </div>
            
            <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
               {currentTicket ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>TICKET ID</p>
                        <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>#{currentTicket.ticket_no}</p>
                     </div>
                     <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>SUBJECT</p>
                        <p style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.4' }}>{currentTicket.subject}</p>
                     </div>
                     <div>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>STATUS</p>
                        <div style={{ display: 'flex' }}>
                           <span style={{ 
                             fontSize: '11px', 
                             padding: '4px 12px', 
                             borderRadius: '30px', 
                             background: 'rgba(255,255,255,0.1)',
                             border: '1px solid var(--border)',
                             fontWeight: '800'
                           }}>{currentTicket.status}</span>
                        </div>
                     </div>
                  </div>
               ) : (
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                     <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No ticket linked to this chat.</p>
                  </div>
               )}
            </div>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               <button onClick={handleClaim} className="glass-interactive flex-center" style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', color: '#0a0e14', border: 'none', fontWeight: '800', gap: '10px' }}>
                  <History size={20} /> รับเรื่อง (CLAIM TASK)
               </button>
               <button onClick={handleResolve} className="glass-interactive flex-center" style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--success)', color: 'white', border: 'none', fontWeight: '800', gap: '10px' }}>
                  <CheckCircle size={20} /> แก้ไขเสร็จสิ้น (RESOLVE)
               </button>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => setIsTransferModalOpen(true)} className="glass-interactive flex-center" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontWeight: '700', fontSize: '12px', gap: '8px' }}>
                      <Share2 size={16} /> ส่งต่อ
                   </button>
                   <button onClick={copySurveyLink} className="glass-interactive flex-center" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--border)', fontWeight: '700', fontSize: '12px', gap: '8px' }}>
                      <Copy size={16} /> แบบประเมิน
                   </button>
               </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
            <Mail size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
            <p style={{ fontSize: '13px' }}>โปรดเลือกการสนทนาเพื่อนดูรายละเอียดข้อมูล</p>
          </div>
        )}
      </div>

      <TransferModal 
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        ticketId={selectedChat?.current_ticket_id}
        fromAgentId={agent?.id}
        onSuccess={() => { alert('โอนสายเรียบร้อยแล้ว'); setViewMode('list'); }}
      />
      
      {isAttachModalOpen && (
          <ChatAttachmentModal 
             isOpen={isAttachModalOpen}
             onClose={() => setIsAttachModalOpen(false)} 
             onConfirm={handleConfirmAttachment}
          />
       )}

       {editingImageUrl && (
          <ImageEditorModal 
             imageUrl={editingImageUrl}
             onClose={() => setEditingImageUrl(null)}
             onSave={handleSaveEditedImage}
          />
       )}

       <style dangerouslySetInnerHTML={{ __html: `
         .image-msg-container:hover .edit-img-btn {
           opacity: 1;
           visibility: visible;
         }
         .edit-img-btn {
           opacity: 0;
           visibility: hidden;
           transition: all 0.2s;
         }
        @media (max-width: 1024px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 1025px) {
          .show-mobile { display: none !important; }
        }
        .truncate {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
       `}} />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        <p style={{ color: 'var(--text-muted)' }}>Loading Inbox...</p>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
