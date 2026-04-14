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
  Pencil,
  Monitor,
  Maximize
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { ticketService } from '@/lib/services/ticketService';
import TransferModal from '@/components/modals/TransferModal';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';
import ImageEditorModal from '@/components/chat/ImageEditorModal';
import ImageViewerModal from '@/components/chat/ImageViewerModal';

import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { TicketSidebar } from '@/components/inbox/TicketSidebar';
import Skeleton from '@/components/ui/Skeleton';

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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string>('');
  const [editingImage, setEditingImage] = useState<string>('');
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

  useEffect(() => {
    if (cid && conversations.length > 0) {
      const target = conversations.find((c: any) => c.id === cid);
      if (target) {
        setSelectedChat(target);
        if (window.innerWidth <= 1024) setViewMode('chat');
      }
    }
  }, [cid, conversations]);

  useEffect(() => {
    if (selectedChat && conversations.length > 0) {
      const updated = conversations.find((c: any) => c.id === selectedChat.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedChat)) {
        setSelectedChat(updated);
      }
    }
  }, [conversations, selectedChat]);

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
        const { data: recentTicket } = await supabase
          .from('tickets')
          .select('*')
          .eq('customer_id', selectedChat.customer_id)
          .not('status', 'in', '("Resolved","Closed")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentTicket) {
           await supabase.from('conversations').update({ current_ticket_id: recentTicket.id }).eq('id', selectedChat.id);
           setCurrentTicket(recentTicket);
        } else {
           setCurrentTicket(null);
        }
      }
    }

    fetchMessages();
    const channel = supabase
      .channel(`chat_realtime_${selectedChat.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages'
      }, (payload) => {
        if (payload.new && (payload.new as any).conversation_id === selectedChat.id) {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => {
              if (prev.some(m => m.id === (payload.new as any).id)) return prev;
              return [...prev, payload.new];
            });
          } else {
            fetchMessages();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !agent) return;
    
    const isResolved = currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed';
    if (isResolved) {
      alert('ใบงานนี้ถูกปิดแล้ว (Resolved/Closed) ไม่สามารถส่งข้อความได้');
      return;
    }

    if (agent.role !== 'Administrator' && agent.permissions?.inbox === 'view') {
      alert('คุณไม่มีสิทธิ์ในการส่งข้อความ (View Only Access)');
      return;
    }

    const isUnassigned = currentTicket && !currentTicket.assigned_agent_id;
    const isAdmin = agent?.role === 'Administrator';

    if ((isResolved || isUnassigned) && !isAdmin) {
       alert(isResolved ? 'ใบงานนี้ถูกปิดแล้ว' : 'กรุณากดรับงานก่อนเริ่มการสนทนาครับ');
       return;
    }

    const currentMsg = newMessage;
    setNewMessage('');
    setSending(true);
    try {
      const { error: dbError } = await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        ticket_id: selectedChat.current_ticket_id || null,
        sender_type: 'agent',
        staff_id: agent.id,
        content: currentMsg,
        message_type: 'text'
      }]);
      
      if (dbError) throw dbError;

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
        ticket_id: selectedChat.current_ticket_id || null,
        sender_type: 'agent',
        staff_id: agent.id,
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

    const isOwner = currentTicket?.assigned_agent_id === agent.id;
    const isAdmin = agent.role === 'Administrator';
    
    if (!isOwner && !isAdmin) {
      alert('คุณไม่มีสิทธิ์ปิดใบงานนี้ (เฉพาะเจ้าหน้าที่ที่รับงานหรือ Manager เท่านั้น)');
      return;
    }

    const summary = prompt('กรอกสรุปการแก้ไขงาน (Resolution Summary):');
    if (!summary) return;

    try {
      await ticketService.resolve(selectedChat.current_ticket_id, agent.id, summary);
      
      const surveyLink = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
      const resolutionMsg = `[SYSTEM] งานได้รับการแก้ไขแล้ว: ${summary}\nแบบประเมิน: ${surveyLink}`;

      await supabase.from('messages').insert([{
         conversation_id: selectedChat.id,
         sender_type: 'system',
         content: resolutionMsg,
         message_type: 'text'
      }]);

      alert('ปิดงานสำเร็จ! ส่งแบบประเมินไปยัง LIFF เรียบร้อย');
      setSelectedChat(null);
    } catch (err: any) {
      console.error('Resolve Error:', err);
      alert('Failed to resolve ticket: ' + (err.message || 'API Error'));
    }
  };

  const handleCloseSession = async () => {
    if (!selectedChat || !confirm('คุณต้องการจบการสนทนานี้โดยไม่เชื่อมโยงใบงานใช่หรือไม่?')) return;
    
    try {
      await supabase.from('conversations')
        .update({ status: 'closed' })
        .eq('id', selectedChat.id);
      
      await supabase.from('messages').insert([{
        conversation_id: selectedChat.id,
        sender_type: 'system',
        content: '[SYSTEM] จบการสนทนาโดยเจ้าหน้าที่',
        message_type: 'text'
      }]);
      
      alert('จบการสนทนาเรียบร้อยแล้ว');
      setSelectedChat(null);
    } catch (err: any) {
      alert('Failed to close chat: ' + err.message);
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
     const link = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
     navigator.clipboard.writeText(link);
     alert('คัดลอกลิงก์แบบประเมินแล้ว');
  };

  if (inboxLoading) return (
    <div className="animate-page-in" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '24px' }}>
      <div className="glass" style={{ width: '360px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
          <Skeleton width="60%" height={24} marginBottom={20} />
          <Skeleton width="100%" height={40} borderRadius={10} />
        </div>
        <div style={{ flex: 1, padding: '12px' }}>
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} style={{ padding: '16px', display: 'flex', gap: '12px' }}>
               <Skeleton width={48} height={48} borderRadius={12} />
               <div style={{ flex: 1 }}>
                  <Skeleton width="70%" height={16} marginBottom={8} />
                  <Skeleton width="40%" height={12} />
               </div>
            </div>
          ))}
        </div>
      </div>
      
      <div className="glass" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
         <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <Skeleton width={42} height={42} borderRadius={12} />
               <Skeleton width={200} height={20} />
            </div>
         </div>
         <div style={{ flex: 1, padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
               <Skeleton width={32} height={32} borderRadius="50%" />
               <Skeleton width="40%" height={60} borderRadius="20px" />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
               <Skeleton width="30%" height={60} borderRadius="20px" />
               <Skeleton width={32} height={32} borderRadius="50%" />
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-start' }}>
               <Skeleton width={32} height={32} borderRadius="50%" />
               <Skeleton width="45%" height={120} borderRadius="20px" />
            </div>
         </div>
         <div style={{ padding: '24px', borderTop: '1px solid var(--border)' }}>
            <Skeleton width="100%" height={52} borderRadius={14} />
         </div>
      </div>

      <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
         <div className="glass" style={{ height: '400px', padding: '24px' }}>
            <Skeleton width="50%" height={20} marginBottom={24} />
            <Skeleton width="100%" height={100} borderRadius={16} marginBottom={24} />
            <Skeleton width="100%" height={20} marginBottom={12} />
            <Skeleton width="100%" height={20} marginBottom={12} />
            <Skeleton width="100%" height={20} />
         </div>
         <Skeleton width="100%" height={56} borderRadius={12} />
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Skeleton width="100%" height={48} borderRadius={12} />
            <Skeleton width="100%" height={48} borderRadius={12} />
         </div>
      </div>
    </div>
  );

  return (
    <div className="animate-page-in inbox-layout" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '24px' }}>
      <InboxSidebar 
        conversations={conversations} 
        loading={inboxLoading} 
        selectedId={selectedChat?.id} 
        onSelect={(c) => { setSelectedChat(c); setViewMode('chat'); }} 
      />
      
      {/* Mobile Control Toggle */}
      <div 
        className={`inbox-main-view ${viewMode}`}
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          background: 'rgba(255,255,255,0.01)',
          borderRadius: '24px',
          border: '1px solid var(--border)',
          overflow: 'hidden'
        }}
      >
        {selectedChat ? (
          <ChatWindow 
            selectedChat={selectedChat}
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSendMessage={handleSendMessage}
            sending={sending}
            agent={agent}
            currentTicket={currentTicket}
            handleClaim={handleClaim}
            onOpenAttachment={() => setIsAttachModalOpen(true)}
            onOpenImage={(src) => { setViewingImage(src); setIsViewerOpen(true); }}
            cannedResponses={cannedResponses}
            showCanned={showCanned}
            setShowCanned={setShowCanned}
            onUseCanned={useCanned}
            onAddCanned={handleAddCanned}
            onEditCanned={handleEditCanned}
            onDeleteCanned={handleDeleteCanned}
          />
        ) : (
          <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: '16px', color: 'var(--text-muted)' }}>
            <MessageSquare size={64} style={{ opacity: 0.1 }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>กราบสวัสดีครับ NEO SUPPORT</h3>
            <p style={{ fontSize: '14px' }}>โปรดเลือกแชทเพื่อเริ่มการสนทนา</p>
          </div>
        )}
      </div>

      <div 
        className={`inbox-details-sidebar ${viewMode === 'details' ? 'showing' : ''}`}
        style={{ 
          width: '320px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '24px' 
        }}
      >
        {selectedChat ? (
          <>
            <TicketSidebar 
              customer={selectedChat.customers}
              ticket={currentTicket} 
              onClaim={handleClaim}
              agent={agent}
            />
            
            <button 
               className="glass-interactive flex-center"
               style={{
                 width: '100%',
                 padding: '12px',
                 borderRadius: '12px',
                 border: '1px solid var(--primary)',
                 color: 'var(--primary)',
                 fontSize: '12px',
                 fontWeight: '800',
                 gap: '8px',
                 background: 'rgba(54, 153, 255, 0.05)'
               }}
            >
               <History size={14} /> <u>ดูประวัติสนทนาเก่าทั้งหมด (Global Log)</u>
            </button>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {selectedChat.current_ticket_id ? (
                   <button 
                    onClick={handleResolve} 
                    disabled={!currentTicket || currentTicket.status === 'Resolved' || (currentTicket.assigned_agent_id !== agent.id && agent.role !== 'Administrator')}
                    className="glass-interactive flex-center" 
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      background: (!currentTicket || currentTicket.status === 'Resolved' || (currentTicket.assigned_agent_id !== agent.id && agent.role !== 'Administrator')) ? 'var(--bg-input)' : 'var(--success)', 
                      color: 'white', 
                      border: 'none', 
                      fontWeight: '800', 
                      gap: '10px',
                      opacity: (!currentTicket || currentTicket.status === 'Resolved' || (currentTicket.assigned_agent_id !== agent.id && agent.role !== 'Administrator')) ? 0.5 : 1
                    }}
                   >
                      <CheckCircle size={20} /> แก้ไขเสร็จสิ้น (RESOLVE)
                   </button>
               ) : (
                 <button 
                  onClick={handleCloseSession} 
                  className="glass-interactive flex-center" 
                  style={{ 
                    width: '100%', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'var(--secondary)', 
                    color: 'white', 
                    border: 'none', 
                    fontWeight: '800', 
                    gap: '10px'
                  }}
                 >
                    <CheckCircle size={20} /> จบการสนทนา (CLOSE CHAT)
                 </button>
               )}
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

      <ImageEditorModal 
        isOpen={isEditorOpen}
        imageSrc={editingImage}
        onClose={() => setIsEditorOpen(false)}
        onSave={(blob) => {
          const file = new File([blob], "edited_image.png", { type: "image/png" });
          handleConfirmAttachment(file, 'image');
        }}
      />

      <ImageViewerModal 
        isOpen={isViewerOpen}
        imageSrc={viewingImage}
        onClose={() => setIsViewerOpen(false)}
        onEdit={(src) => {
          setIsViewerOpen(false);
          setEditingImage(src);
          setIsEditorOpen(true);
        }}
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



