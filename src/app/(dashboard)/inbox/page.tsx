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
  Maximize,
  UserPlus,
  LogOut
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { ticketService } from '@/lib/services/ticketService';
import { sendAgentMessageAction, sendSystemMessageAction, closeConversationAction, deleteMessageAction } from '@/app/actions/messageActions';
import TransferModal from '@/components/modals/TransferModal';
import ChatAttachmentModal from '@/components/chat/ChatAttachmentModal';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import ImageViewerModal from '@/components/modals/ImageViewerModal';

import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { TicketSidebar } from '@/components/inbox/TicketSidebar';
import Skeleton from '@/components/ui/Skeleton';

function InboxContent() {
  const { conversations, loading: inboxLoading } = useRealtimeInbox();
  const { addToast } = useNotificationContext();
  const [selectedChat, setSelectedChat] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'chat' | 'details'>('list');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [agent, setAgent] = useState<any | null>(null);
  const [sending, setSending] = useState<boolean>(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState<boolean>(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [viewingImage, setViewingImage] = useState<string>('');
  const [editingImage, setEditingImage] = useState<string>('');
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');
  const [currentTicket, setCurrentTicket] = useState<any | null>(null);
  const [cannedResponses, setCannedResponses] = useState<string[]>([]);
  const [showCanned, setShowCanned] = useState<boolean>(false);
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resSummary, setResSummary] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [resolutionTemplates, setResolutionTemplates] = useState<string[]>([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState<boolean>(false);
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
    
    async function fetchModules() {
       const { data: companyData } = await supabase.from('company_settings').select('modules, resolution_templates').limit(1).single();
       if (companyData) {
          if (companyData.modules) setAvailableModules(companyData.modules);
          if (companyData.resolution_templates) setResolutionTemplates(companyData.resolution_templates);
       }
    }
    fetchModules();
    
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
      
      if (data) {
         // Transform media paths to signed URLs
         const enrichedMessages = await Promise.all(data.map(async (msg: any) => {
            if (msg.message_type === 'image' || msg.message_type === 'video' || msg.message_type === 'audio' || msg.message_type === 'file') {
               if (msg.content && !msg.content.startsWith('http')) {
                  const { data: signedData } = await supabase.storage.from('chat_media').createSignedUrl(msg.content, 3600);
                  return { ...msg, content: signedData?.signedUrl || msg.content };
               }
            }
            return msg;
         }));
         setMessages(enrichedMessages);
      }

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
        table: 'messages',
        filter: `conversation_id=eq.${selectedChat.id}`
      }, (payload: any) => {
        if (payload.eventType === 'INSERT' && payload.new) {
          setMessages((prev: any[]) => {
            if (prev.some((m: any) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        } else if (payload.eventType === 'DELETE' && payload.old) {
          setMessages((prev: any[]) => prev.filter(m => m.id !== payload.old.id));
        } else {
          fetchMessages();
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
      await sendAgentMessageAction(
        selectedChat.id,
        selectedChat.current_ticket_id || null,
        currentMsg,
        'text'
      );
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
      await sendAgentMessageAction(
        selectedChat.id,
        selectedChat.current_ticket_id || null,
        publicUrl,
        dbType
      );
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleClaim = async () => {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !agent) {
      console.error('Claim Error: No Ticket ID found', { ticketId, agentId: agent?.id });
      return;
    }
    try {
      await ticketService.claimTicket(ticketId, agent.id);
      
      // Refetch ticket data to update UI immediately
      const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
      if (ticket) setCurrentTicket(ticket);
      
      addToast({
        id: 'claim-success',
        type: 'ticket',
        title: 'รับงานสำเร็จ',
        body: `คุณได้เป็นผู้ดูแลใบงาน #${ticket?.ticket_no} เรียบร้อยแล้ว`
      });
    } catch (err: any) {
      alert('Failed to claim ticket: ' + err.message);
    }
  };

  const handleResolve = async () => {
    if (!selectedChat?.current_ticket_id || !agent) return;

    const isOwner = currentTicket?.assigned_agent_id === agent.id;
    const isAdmin = agent.role === 'Administrator';
    const isSessionActive = selectedChat.status === 'active' || selectedChat.is_active;

    if (isSessionActive) {
       alert('กรุณากด "จบการสนทนา (CLOSE CHAT)" ก่อนทำการปิดงานใบงานครับ');
       return;
    }
    
    if (!isOwner && !isAdmin) {
       alert('คุณไม่มีสิทธิ์ปิดใบงานนี้ (เฉพาะเจ้าหน้าที่ที่รับงานหรือ Manager เท่านั้น)');
       return;
    }

    setResSummary('');
    setSelectedModule(currentTicket.module || '');
    setShowResolveModal(true);
  };

  const handleExecuteResolve = async () => {
    if (!selectedChat?.current_ticket_id) return;
    
    if (!selectedModule) {
       alert('กรุณาเลือก Module ก่อนทำการปิดงานครับ');
       return;
    }
    
    if (!resSummary.trim()) {
       alert('กรุณากรอกสรุปผลการแก้ไขงานก่อนครับ');
       return;
    }

    setSending(true);
    try {
      await ticketService.resolve(selectedChat.current_ticket_id, agent.id, resSummary, selectedModule);
      
      const surveyLink = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
      const moduleStr = selectedModule ? `\nโมดูล: ${selectedModule}` : '';
      const resolutionMsg = `[SYSTEM] งานได้รับการแก้ไขแล้ว: ${resSummary}${moduleStr}\nแบบประเมิน: ${surveyLink}`;

      await sendSystemMessageAction(selectedChat.id, resolutionMsg);

      alert('ปิดงานสำเร็จ! ส่งแบบประเมินไปยัง LIFF เรียบร้อย');
      setShowResolveModal(false);
      setSelectedChat(null);
    } catch (err: any) {
      console.error('Resolve Error:', err);
      alert('Failed to resolve ticket: ' + (err.message || 'API Error'));
    } finally {
      setSending(false);
    }
  };

  const saveResTemplates = (list: string[]) => {
     setResolutionTemplates(list);
     localStorage.setItem('neo_resolution_templates', JSON.stringify(list));
  };

  const addResTemplate = (text: string) => {
     if (!text.trim()) return;
     if (resolutionTemplates.includes(text.trim())) return;
     saveResTemplates([...resolutionTemplates, text.trim()]);
  };

  const removeResTemplate = (index: number) => {
     const next = resolutionTemplates.filter((_, i) => i !== index);
     saveResTemplates(next);
  };
   
  const handleCloseSession = async () => {
    if (!selectedChat || !confirm('คุณต้องการจบการสนทนานี้โดยไม่เชื่อมโยงใบงานใช่หรือไม่?')) return;
    
    try {
      await closeConversationAction(selectedChat.id);
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

  const addResTemplate = async (text: string) => {
    const updated = [...resolutionTemplates, text];
    setResolutionTemplates(updated);
    const { error } = await supabase.from('company_settings').update({ resolution_templates: updated }).neq('id', '00000000-0000-0000-0000-000000000000'); // Update matching all as we usually have 1 record
    if (error) console.error('Update templates error:', error);
  };

  const removeResTemplate = async (index: number) => {
    const updated = resolutionTemplates.filter((_, i) => i !== index);
    setResolutionTemplates(updated);
    const { error } = await supabase.from('company_settings').update({ resolution_templates: updated }).neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) console.error('Remove template error:', error);
  };

  const copySurveyLink = () => {
     if (!selectedChat?.current_ticket_id) return;
     const link = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
     navigator.clipboard.writeText(link);
     alert('คัดลอกลิงก์แบบประเมินแล้ว');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('คุณต้องการยกเลิกการส่งข้อความนี้ใช่หรือไม่?')) return;
    try {
      const res = await deleteMessageAction(messageId);
      if (res && !res.success) {
        alert('Failed to unsend: ' + res.error);
        return;
      }
      addToast({
        id: `delete-${messageId}`,
        type: 'message',
        title: 'Unsent Success',
        body: 'ยกเลิกการส่งข้อความเรียบร้อยแล้ว'
      });
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
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
        selectedChat={selectedChat} 
        onSelectChat={(c) => { setSelectedChat(c); setViewMode('chat'); }} 
        viewMode={viewMode}
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
            onSendMessage={handleSendMessage}
            sending={sending}
            agent={agent}
            currentTicket={currentTicket}
            onClaim={handleClaim}
            onAttachClick={() => setIsAttachModalOpen(true)}
            onEditImage={(src) => { setViewingImage(src); setIsViewerOpen(true); }}
            cannedResponses={cannedResponses}
            showCanned={showCanned}
            setShowCanned={setShowCanned}
            onUseCanned={useCanned}
            onAddCanned={handleAddCanned}
            onEditCanned={handleEditCanned}
            onDeleteCanned={handleDeleteCanned}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onDeleteMessage={handleDeleteMessage}
            messagesEndRef={messagesEndRef}
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
              selectedChat={selectedChat}
              currentTicket={currentTicket} 
              agent={agent}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onFetchGlobalHistory={() => alert('ระบบประวัติสนทนากำลังพัฒนา (Coming Soon)...')}
              onResolve={handleResolve}
              onTransfer={() => setIsTransferModalOpen(true)}
              onCloseSession={handleCloseSession}
              onCopySurvey={copySurveyLink}
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

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
               {/* CASE 1: Ticket exists but NOT assigned yet (Show CLAIM) */}
               {currentTicket && !currentTicket.assigned_agent_id && (
                  <button 
                     onClick={handleClaim} 
                     className="glass-interactive flex-center" 
                     style={{ 
                        width: '100%', 
                        padding: '16px', 
                        borderRadius: '12px', 
                        background: 'var(--primary)', 
                        color: 'black', 
                        border: 'none', 
                        fontWeight: '900', 
                        fontSize: '15px',
                        gap: '10px',
                        boxShadow: '0 8px 24px rgba(0, 242, 254, 0.4)'
                     }}
                  >
                     <UserPlus size={20} /> รับงานนี้ (CLAIM TICKET)
                  </button>
               )}

               {/* CASE 2: Close Session (Only for active sessions) */}
               {(selectedChat.status === 'active' || selectedChat.is_active) && (
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
                        fontWeight: '850', 
                        fontSize: '14px',
                        gap: '10px',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
                     }}
                  >
                     <CheckCircle size={18} /> จบการสนทนา (CLOSE CHAT)
                  </button>
               )}

               {/* CASE 3: Resolve Ticket (Show if claimed and not resolved) */}
               {currentTicket && currentTicket.assigned_agent_id && !['Resolved', 'Closed'].includes(currentTicket.status) && (
                  <button 
                    onClick={handleResolve} 
                    disabled={(currentTicket.assigned_agent_id !== agent?.id && agent?.role !== 'Administrator') || (selectedChat.status === 'active' || selectedChat.is_active)}
                    className="glass-interactive flex-center" 
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      background: (selectedChat.status === 'active' || selectedChat.is_active) ? 'rgba(255,255,255,0.05)' : 'var(--success)', 
                      color: (selectedChat.status === 'active' || selectedChat.is_active) ? 'rgba(255,255,255,0.3)' : 'white', 
                      border: 'none', 
                      fontWeight: '850', 
                      fontSize: '14px',
                      gap: '10px',
                      boxShadow: '0 4px 12px rgba(40, 199, 111, 0.2)',
                      opacity: (selectedChat.status === 'active' || selectedChat.is_active) ? 0.6 : 1,
                      cursor: (selectedChat.status === 'active' || selectedChat.is_active) ? 'not-allowed' : 'pointer'
                    }}
                  >
                     <CheckCircle size={18} /> {(selectedChat.status === 'active' || selectedChat.is_active) ? 'รอจบสนทนา -> จึงจะปิดงานได้' : 'ปิดงานนี้ (RESOLVE TICKET)'}
                  </button>
               )}

               {/* CASE 4: Sub-actions (Transfer, Survey) */}
               <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button 
                     onClick={() => setIsTransferModalOpen(true)} 
                     disabled={!currentTicket || ['Resolved', 'Closed'].includes(currentTicket.status)}
                     className="glass-interactive flex-center" 
                     style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '700', fontSize: '11px', gap: '8px', opacity: (!currentTicket || ['Resolved', 'Closed'].includes(currentTicket.status)) ? 0.3 : 1 }}
                  >
                     <Share2 size={14} /> ส่งต่อแผนก
                  </button>
                  <button 
                     onClick={copySurveyLink} 
                     className="glass-interactive flex-center" 
                     style={{ padding: '12px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-main)', border: '1px solid var(--border)', fontWeight: '700', fontSize: '11px', gap: '8px' }}
                  >
                     <Copy size={14} /> คัดลอกลิงก์
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

      {isViewerOpen && viewingImage && (
        <ImageViewerModal 
           imageUrl={viewingImage} 
           onClose={() => setIsViewerOpen(false)} 
           onEdit={(src) => {
              setEditingImage(src);
              setIsEditorOpen(true);
           }}
        />
      )}

      {isEditorOpen && editingImage && (
        <ImageEditorModal 
          imageUrl={editingImage}
          onClose={() => setIsEditorOpen(false)}
          onSave={async (blob) => {
            const file = new File([blob], "edited_image.png", { type: "image/png" });
            await handleConfirmAttachment(file, 'image');
            setIsEditorOpen(false);
          }}
        />
      )}

      {showResolveModal && (
          <div style={{
             position: 'fixed',
             inset: 0,
             zIndex: 10000,
             display: 'flex',
             alignItems: 'center',
             justifyContent: 'center',
             background: 'rgba(5, 8, 12, 0.85)',
             backdropFilter: 'blur(20px)',
             padding: '20px'
          }}>
             <div className="glass" style={{
                width: '100%',
                maxWidth: '480px',
                padding: '40px',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                color: 'white'
             }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                   <div style={{ 
                     width: '64px', 
                     height: '64px', 
                     borderRadius: '20px', 
                     background: 'rgba(0, 255, 127, 0.1)', 
                     color: 'var(--success)', 
                     display: 'inline-flex',
                     alignItems: 'center',
                     justifyContent: 'center',
                     marginBottom: '20px'
                   }}>
                      <CheckCircle size={32} />
                   </div>
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'white', marginBottom: '8px' }}>ปิดงานใบงาน #{currentTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตด่วน</label>
                       <button 
                          onClick={() => setIsManagingTemplates(!isManagingTemplates)}
                          style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                       >
                          {isManagingTemplates ? 'เสร็จสิ้น' : 'จัดการเทมเพลต'}
                       </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {resolutionTemplates.map((t, idx) => (
                         <div key={idx} style={{ position: 'relative' }}>
                            <button 
                             type="button" 
                             onClick={() => setResSummary(t)} 
                             style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                               {t}
                            </button>
                            {isManagingTemplates && (
                               <button 
                                 onClick={() => {
                                    console.log('Removing template at index:', idx);
                                    removeResTemplate(idx);
                                 }}
                                 style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                               >
                                  ×
                               </button>
                            )}
                         </div>
                       ))}
                       {isManagingTemplates && (
                          <button 
                            onClick={() => {
                               const val = prompt('เพิ่มข้อความเทมเพลตใหม่:');
                               if (val) addResTemplate(val);
                            }}
                            style={{ padding: '6px 14px', borderRadius: '8px', border: '1px dashed var(--primary)', background: 'none', fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}
                          >
                             + เพิ่ม
                          </button>
                       )}
                    </div>
                </div>

                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: 'rgba(255,255,255,0.6)', marginBottom: '8px' }}>Module</label>
                    <div style={{ position: 'relative' }}>
                       <select 
                         value={selectedModule} 
                         onChange={(e) => setSelectedModule(e.target.value)}
                         style={{ 
                            width: '100%', 
                            padding: '14px 40px 14px 16px', 
                            borderRadius: '12px', 
                            border: 'none', 
                            background: 'var(--primary)', 
                            color: 'black', 
                            fontSize: '14px', 
                            fontWeight: '800', 
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 8px 24px rgba(0,242,254,0.25)',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 16px center',
                            backgroundSize: '16px'
                         }}
                       >
                          <option value="" style={{ background: 'white', color: 'black' }}>-- ไม่ระบุโมดูล --</option>
                          {availableModules.map(m => (
                            <option key={m} value={m} style={{ background: 'white', color: 'black' }}>{m}</option>
                          ))}
                       </select>
                    </div>
                </div>

                <div style={{ marginBottom: '32px' }}>
                   <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน</label>
                   <textarea 
                     value={resSummary}
                     onChange={(e) => setResSummary(e.target.value)}
                     placeholder="ระบุรายละเอียดการแก้ไข..."
                     style={{
                        width: '100%',
                        height: '100px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid var(--border)',
                        borderRadius: '16px',
                        padding: '16px',
                        color: 'white',
                        fontSize: '14px',
                        resize: 'none',
                        outline: 'none'
                     }}
                   />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                   <button 
                     onClick={() => setShowResolveModal(false)}
                     style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: '800', cursor: 'pointer' }}
                   >
                      ยกเลิก
                   </button>
                   <button 
                     onClick={handleExecuteResolve}
                     disabled={sending || !resSummary.trim()}
                     style={{ 
                       flex: 1.5, 
                       padding: '16px', 
                       borderRadius: '14px', 
                       border: 'none', 
                       background: (sending || !resSummary.trim()) ? 'rgba(255,255,255,0.05)' : 'var(--success)', 
                       color: (sending || !resSummary.trim()) ? 'rgba(255,255,255,0.2)' : 'black', 
                       fontWeight: '900', 
                       cursor: 'pointer',
                       display: 'flex',
                       alignItems: 'center',
                       justifyContent: 'center',
                       gap: '10px'
                     }}
                   >
                      {sending ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันสมบูรณ์</>}
                   </button>
                </div>
             </div>
          </div>
       )}

       <style dangerouslySetInnerHTML={{ __html: `
          @keyframes scaleIn {
             from { opacity: 0; transform: scale(0.95); }
             to { opacity: 1; transform: scale(1); }
          }
       `}} />

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



