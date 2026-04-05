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
  MessageSquare,
  Plus,
  Trash2,
  Pencil
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { ticketService } from '@/lib/services/ticketService';
import TransferModal from '@/components/modals/TransferModal';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';

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
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');
  const [currentTicket, setCurrentTicket] = useState<any>(null);
  const [cannedResponses, setCannedResponses] = useState<string[]>([]);
  const [showCanned, setShowCanned] = useState(false);
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
    
    // Load Canned Responses from LocalStorage
    const saved = localStorage.getItem('neo_canned_responses');
    if (saved) {
      setCannedResponses(JSON.parse(saved));
    } else {
      const defaults = [
        "สวัสดีครับ NEO SUPPORT ยินดีให้บริการครับ",
        "รบกวนขอทราบเลขที่ใบงาน (Ticket ID) เพื่อตรวจสอบข้อมูลครับ",
        "ขณะนี้เราได้รับข้อมูลแล้ว กำลังเร่งเปรประสานงานให้ครับ",
        "ขอบคุณที่ใช้บริการ NEO SUPPORT ครับ หากมีข้อสงสัยเพิ่มเติมสอบถามได้เลยครับ"
      ];
      setCannedResponses(defaults);
      localStorage.setItem('neo_canned_responses', JSON.stringify(defaults));
    }
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
        if (payload.new.conversation_id === selectedChat.id) {
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

  const handleAddCanned = () => {
    const text = prompt('กรอกข้อความที่ต้องการบันทึกเป็นข้อความสำเร็จรูป:');
    if (text && text.trim()) {
      const updated = [...cannedResponses, text.trim()];
      setCannedResponses(updated);
      localStorage.setItem('neo_canned_responses', JSON.stringify(updated));
    }
  };

  const handleEditCanned = (index: number) => {
    const current = cannedResponses[index];
    const text = prompt('แก้ไขข้อความสำเร็จรูป:', current);
    if (text && text.trim() && text !== current) {
      const updated = [...cannedResponses];
      updated[index] = text.trim();
      setCannedResponses(updated);
      localStorage.setItem('neo_canned_responses', JSON.stringify(updated));
    }
  };

  const handleDeleteCanned = (index: number) => {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบข้อความนี้?')) {
      const updated = cannedResponses.filter((_, i) => i !== index);
      setCannedResponses(updated);
      localStorage.setItem('neo_canned_responses', JSON.stringify(updated));
    }
  };

  const useCanned = (text: string) => {
    setNewMessage(text);
    setShowCanned(false);
  };

  const copySurveyLink = () => {
     if (!selectedChat?.current_ticket_id) return;
     const link = `${window.location.origin}/portal/survey/${selectedChat.current_ticket_id}`;
     navigator.clipboard.writeText(link);
     alert('คัดลอกลิงก์แบบประเมินแล้ว');
  };

  if (inboxLoading) return (
    <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
      <Loader2 className="animate-spin" size={32} color="var(--primary)" aria-hidden="true" />
      <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดกล่องข้อความ…</p>
    </div>
  );

  return (
    <div className="inbox-layout" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '24px', animation: 'fadeIn 0.5s ease-out' }}>
      {/* 1. Left Panel: Conversation List */}
      <div className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`} style={{ width: '360px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>แชททั้งหมด</h2>
            <div style={{ background: 'var(--primary)', color: 'black', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
               {conversations.length} รายการ
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={16} aria-hidden="true" />
            <input 
              type="text" 
              placeholder="ค้นหาชื่อลูกค้าหรือตั๋ว…" 
              aria-label="ค้นหาชื่อลูกค้าหรือตั๋ว"
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                padding: '12px 12px 12px 40px',
                color: 'white',
                fontSize: '14px',
                outline: 'none'
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
          {conversations.length === 0 ? (
             <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Mail size={40} style={{ marginBottom: '16px', opacity: 0.2 }} />
                <p style={{ fontSize: '14px' }}>ยังไม่มีข้อความส่งเข้ามา</p>
             </div>
          ) : conversations.map((chat) => (
            <div 
              key={chat.id} 
              onClick={() => selectChat(chat)}
              className="glass-interactive"
              style={{ 
                padding: '18px 24px', 
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selectedChat?.id === chat.id ? 'var(--bg-input)' : 'transparent',
                borderLeft: selectedChat?.id === chat.id ? '4px solid var(--primary)' : '4px solid transparent',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={{ fontWeight: '700', fontSize: '15px' }}>{chat.customers?.display_name || 'LINE User'}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                   {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                  สถานะ: <span style={{ color: chat.status === 'active' ? 'var(--primary)' : 'inherit' }}>{chat.status.toUpperCase()}</span>
                </p>
                {chat.status === 'active' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Middle Panel: Chat Window */}
      <div className={`glass inbox-chat-panel ${viewMode !== 'chat' ? 'hidden-mobile' : ''}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedChat ? (
           <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-topbar)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <button 
                  onClick={() => setViewMode('list')}
                  aria-label="Back to conversations"
                  className="show-mobile glass-interactive flex-center" style={{ width: '36px', height: '36px', borderRadius: '8px', border: '1px solid var(--border)', marginRight: '8px' }}>
                    <ArrowLeft size={18} aria-hidden="true" />
                 </button>
                 <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', color: '#0a0e14', boxShadow: '0 4px 12px rgba(0,242,254,0.2)' }}>
                    {selectedChat.customers?.display_name?.charAt(0) || 'L'}
                 </div>
                 <div>
                    <p style={{ fontWeight: '800', fontSize: '16px' }}>{selectedChat.customers?.display_name || 'LINE User'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                      <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: '700', textTransform: 'uppercase' }}>Active Session</span>
                    </div>
                 </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                 <button 
                  onClick={() => setViewMode('details')}
                  className="show-mobile glass-interactive flex-center" style={{ width: '38px', height: '38px', borderRadius: '10px', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    <Info size={18} aria-hidden="true" />
                 </button>
              </div>
            </div>

            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="no-scrollbar">
              {messages.length === 0 && (
                <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <p style={{ fontSize: '14px' }}>กำลังรอข้อความใหม่…</p>
                </div>
              )}
              {messages.map((msg) => (
                 <div key={msg.id} style={{ alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                    <div style={{ 
                       padding: '12px 18px', 
                       borderRadius: msg.sender_type === 'agent' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', 
                       background: msg.sender_type === 'agent' ? 'var(--secondary)' : (msg.sender_type === 'system' ? 'var(--bg-input)' : 'var(--bg-card)'),
                       border: '1px solid ' + (msg.sender_type === 'agent' ? 'rgba(115, 103, 240, 0.2)' : 'var(--border)'),
                       fontSize: '14px',
                       lineHeight: '1.6',
                       boxShadow: msg.sender_type === 'agent' ? '0 4px 15px rgba(115, 103, 240, 0.2)' : 'none',
                       color: msg.sender_type === 'system' ? 'var(--primary)' : 'white'
                    }}>
                       {msg.message_type === 'image' || (msg.content.startsWith('http') && msg.content.match(/\.(jpeg|jpg|gif|png)$/)) ? (
                          <img src={msg.content} style={{ maxWidth: '100%', borderRadius: '10px', display: 'block' }} alt="Chat attachment" />
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

            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-topbar)', position: 'relative' }}>
              {showCanned && (
                <div className="glass animate-fade-in" style={{ position: 'absolute', bottom: '100%', left: '24px', right: '24px', marginBottom: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 100, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 -10px 25px rgba(0,0,0,0.5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 8px' }}>
                    <p style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>ข้อความสำเร็จรูป (QUICK REPLIES)</p>
                    <button 
                      type="button" 
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleAddCanned(); }} 
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '800' }}>
                       <Plus size={12} /> เพิ่มใหม่
                    </button>
                  </div>
                  {cannedResponses.map((res, i) => (
                    <div key={i} style={{ display: 'flex', gap: '4px' }}>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); useCanned(res); }} 
                        className="glass-interactive" 
                        style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid transparent', color: 'var(--text-main)', fontSize: '13px', textAlign: 'left', transition: 'all 0.2s', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {res}
                      </button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditCanned(i); }} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}><Pencil size={14} /></button>
                      <button 
                        type="button" 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteCanned(i); }} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '8px' }}><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
              <form onSubmit={handleSendMessage}>
                <div className="glass" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-input)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                   <button type="button" onClick={() => setShowCanned(!showCanned)} aria-label="Quick replies" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: showCanned ? 'var(--primary)' : 'var(--text-muted)', cursor: 'pointer' }}><MessageSquare size={19} aria-hidden="true" /></button>
                   <button type="button" onClick={() => setIsAttachModalOpen(true)} aria-label="Attach file" className="glass-interactive flex-center" style={{ width: '36px', height: '36px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Paperclip size={20} aria-hidden="true" /></button>
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
                    {sending ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
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
               <button onClick={handleResolve} className="glass-interactive flex-center" style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--success)', color: 'white', border: 'none', fontWeight: '800', gap: '10px' }}>
                  <CheckCircle size={20} /> แก้ไขเสร็จสิ้น (RESOLVE)
               </button>
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button onClick={() => setIsTransferModalOpen(true)} className="glass-interactive flex-center" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '700', fontSize: '12px', gap: '8px' }}>
                      <Share2 size={16} /> ส่งต่อ
                   </button>
                   <button onClick={copySurveyLink} className="glass-interactive flex-center" style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '700', fontSize: '12px', gap: '8px' }}>
                      <Copy size={16} /> แบบประเมิน
                   </button>
               </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
            <Mail size={32} style={{ opacity: 0.1, marginBottom: '12px' }} aria-hidden="true" />
            <p style={{ fontSize: '13px' }}>โปรดเลือกการสนทนาเพื่อดูรายละเอียดข้อมูล</p>
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
      
      <ChatAttachmentModal 
        isOpen={isAttachModalOpen}
        onClose={() => setIsAttachModalOpen(false)}
        onConfirm={handleConfirmAttachment}
      />

    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={
      <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" size={32} color="var(--primary)" aria-hidden="true" />
        <p style={{ color: 'var(--text-muted)' }}>Loading Inbox…</p>
      </div>
    }>
      <InboxContent />
    </Suspense>
  );
}
