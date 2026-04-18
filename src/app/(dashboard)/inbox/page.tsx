'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Loader2, 
  MessageSquare, 
  Search, 
  Filter, 
  MoreVertical, 
  CheckCircle,
  Clock,
  Send,
  PlusCircle,
  Image as ImageIcon,
  Paperclip,
  Smile,
  ChevronLeft,
  X,
  User,
  ShieldAlert,
  Edit,
  Trash2,
  Settings,
  MoreHorizontal
} from 'lucide-react';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { sendAgentMessageAction, sendSystemMessageAction, deleteMessageAction, closeConversationAction } from '@/app/actions/messageActions';
import { ticketService } from '@/lib/services/ticketService';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import ImageViewerModal from '@/components/modals/ImageViewerModal';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { TicketSidebar } from '@/components/inbox/TicketSidebar';

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
  const [showCanned, setShowCanned] = useState<boolean>(false);
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);
  const [resSummary, setResSummary] = useState<string>('');
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState<boolean>(false);
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);
  const [selectedIssueType, setSelectedIssueType] = useState<string>('');
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
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
        if (window.innerWidth <= 1000) setViewMode('chat');
      }
    }
  }, [cid, conversations]);

  // Sync selected chat with latest data from conversations hook
  useEffect(() => {
    if (selectedChat && conversations.length > 0) {
      const updated = conversations.find((c: any) => c.id === selectedChat.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedChat)) {
        setSelectedChat(updated);
      }
    }
  }, [conversations, selectedChat]);

  // Load Profile and Modules
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
        // Strictly pull from profile. No more system defaults.
        if (profile?.quick_replies) {
           setPersonalQuickReplies(profile.quick_replies);
        }
        if (profile?.resolution_templates) {
           setPersonalResTemplates(profile.resolution_templates);
        }
      }
    }
    getProfile();
    
    async function fetchModules() {
       const { data: companyData } = await supabase.from('company_settings').select('id, modules, issue_types').limit(1).single();
       const defaultModules = [
          "ห้องทำงานแพทย์", "ห้องพยาบาล", "ห้องยาผู้ป่วยใน", "ห้องเวชระเบียน", "ห้องผ่าตัด", "ห้องวิสัญญี", "ห้อง Consult", "All"
       ];
       if (companyData) {
          if (companyData.modules && companyData.modules.length > 0) setAvailableModules(companyData.modules);
          else setAvailableModules(defaultModules);
          if (companyData.issue_types && companyData.issue_types.length > 0) setAvailableIssueTypes(companyData.issue_types);
       } else {
          setAvailableModules(defaultModules);
       }
    }
    fetchModules();
  }, []);

  // Realtime Messages for Selected Chat
  useEffect(() => {
    if (!selectedChat) return;

    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', selectedChat.id)
        .order('created_at', { ascending: true });
      
      if (data) {
         // enriched urls for signed media if needed (simplifying for now as per project standard)
         setMessages(data);
      }

      // Check current ticket for this conversation
      if (selectedChat.current_ticket_id) {
        const { data: ticket } = await supabase.from('tickets').select('*').eq('id', selectedChat.current_ticket_id).single();
        setCurrentTicket(ticket);
      } else {
        // Look for any open ticket for this customer
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
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${selectedChat.id}`
      }, (payload: any) => {
        setMessages((prev: any[]) => {
          if (prev.some((m: any) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'messages',
        filter: `conversation_id=eq.${selectedChat.id}`
      }, (payload: any) => {
        setMessages((prev: any[]) => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', { 
        event: 'DELETE', 
        schema: 'public', 
        table: 'messages'
      }, (payload: any) => {
        setMessages((prev: any[]) => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChat]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat || !agent) return;
    
    // Prevent sending messages to closed/resolved tickets
    if (currentTicket?.status === 'Resolved' || currentTicket?.status === 'Closed') {
      alert('ใบงานนี้ถูกปิดแล้ว ไม่สามารถส่งข้อความได้');
      return;
    }

    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: newMessage,
      sender_type: 'agent',
      staff_id: agent.id,
      conversation_id: selectedChat.id,
      ticket_id: selectedChat.current_ticket_id || null,
      message_type: 'text',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setSending(true);
    try {
      await sendAgentMessageAction(selectedChat.id, selectedChat.current_ticket_id || null, optimisticMsg.content, 'text');
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      alert('Failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleClaim = async () => {
    const ticketId = currentTicket?.id || selectedChat?.current_ticket_id;
    if (!ticketId || !agent) return;
    try {
      await ticketService.claimTicket(ticketId, agent.id);
      const { data: ticket } = await supabase.from('tickets').select('*').eq('id', ticketId).single();
      if (ticket) setCurrentTicket(ticket);
      addToast({ id: 'claim-success', type: 'ticket', title: 'รับงานสำเร็จ', body: `คุณได้เป็นผู้ดูแลใบงาน #${ticket?.ticket_no} เรียบร้อยแล้ว` });
    } catch (err: any) { alert('Failed to claim: ' + err.message); }
  };

  const handleResolve = () => {
    const ticketId = selectedChat?.current_ticket_id || currentTicket?.id;
    if (!ticketId || !agent) {
       console.error('Missing ticketId or agent', { ticketId, agent });
       return;
    }
    
    setResSummary('');
    setSelectedModule(currentTicket?.module || '');
    setSelectedIssueType(currentTicket?.issue_type || ''); // Sync issue type too
    setShowResolveModal(true);
  };

  const handleExecuteResolve = async () => {
    if (!selectedChat?.current_ticket_id || !selectedModule || !resSummary.trim()) return;
    setSending(true);
    try {
      await ticketService.resolve(selectedChat.current_ticket_id, agent.id, resSummary, selectedModule, selectedIssueType);
      const surveyLink = `${window.location.origin}/survey/${selectedChat.current_ticket_id}`;
      const resolutionMsg = `[SYSTEM] งานได้รับการแก้ไขแล้ว: ${resSummary}\nโมดูล: ${selectedModule}\nแบบประเมิน: ${surveyLink}`;
      await sendSystemMessageAction(selectedChat.id, resolutionMsg);
      setShowResolveModal(false);
      setSelectedChat(null); // Clear selection after full resolution success
      addToast({ id: 'resolve-success', type: 'ticket', title: 'ปิดงานสำเร็จ', body: 'ใบงานได้รับการสรุปผลและแจ้งลูกค้าเรียบร้อยแล้ว' });
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setSending(false); }
  };

  const addResTemplate = async (text: string) => {
     if (!text.trim() || !agent) return;
     const updated = [...personalResTemplates, text.trim()];
     setPersonalResTemplates(updated);
     await supabase.from('profiles').update({ resolution_templates: updated }).eq('id', agent.id);
  };

  const removeResTemplate = async (index: number) => {
     if (!agent) return;
     const updated = personalResTemplates.filter((_, i) => i !== index);
     setPersonalResTemplates(updated);
     await supabase.from('profiles').update({ resolution_templates: updated }).eq('id', agent.id);
  };
   
  const handleCloseSession = async () => {
    if (!selectedChat || !confirm('คุณต้องการจบการสนทนานี้ใช่หรือไม่?')) return;
    try {
      await closeConversationAction(selectedChat.id);
      setSelectedChat((prev: any) => prev ? { ...prev, status: 'closed' } : null);
      addToast({ id: 'close-success', type: 'ticket', title: 'จบการสนทนาแลว', body: 'คุณสามารถกดปิดงาน (Resolve) ได้ทันทีที่แถบด้านขวาครับ' });
    } catch (err: any) { alert('Failed: ' + err.message); }
  };

  const handleAddCanned = async () => {
    const text = prompt('กรอกข้อความที่ต้องการบันทึกเป็นข้อความส่วนตัว:');
    if (text && text.trim() && agent) {
      const updated = [...personalQuickReplies, text.trim()];
      setPersonalQuickReplies(updated);
      await supabase.from('profiles').update({ quick_replies: updated }).eq('id', agent.id);
    }
  };

  const handleEditCanned = async (index: number) => {
    const current = personalQuickReplies[index];
    const text = prompt('แก้ไขข้อความส่วนตัว:', current);
    if (text && text.trim() && text !== current && agent) {
      const updated = [...personalQuickReplies];
      updated[index] = text.trim();
      setPersonalQuickReplies(updated);
      await supabase.from('profiles').update({ quick_replies: updated }).eq('id', agent.id);
    }
  };

  const handleDeleteCanned = async (index: number) => {
    if (agent && confirm('ลบข้อความส่วนตัวนี้?')) {
      const updated = personalQuickReplies.filter((_, i) => i !== index);
      setPersonalQuickReplies(updated);
      await supabase.from('profiles').update({ quick_replies: updated }).eq('id', agent.id);
    }
  };

  if (inboxLoading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" /></div>;

  return (
    <div className="animate-page-in inbox-layout" style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '24px' }}>
      <InboxSidebar conversations={conversations} selectedChat={selectedChat} onSelectChat={(c:any) => { setSelectedChat(c); setViewMode('chat'); }} viewMode={viewMode} />
      
      <div className={`inbox-main-view ${viewMode}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', borderRadius: '24px', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {selectedChat ? (
          <ChatWindow 
            selectedChat={selectedChat} messages={messages} newMessage={newMessage} setNewMessage={setNewMessage}
            onSendMessage={handleSendMessage} sending={sending} agent={agent} currentTicket={currentTicket}
            onClaim={handleClaim} onAttachClick={() => setIsAttachModalOpen(true)}
            onEditImage={(src:string) => { setViewingImage(src); setIsViewerOpen(true); }}
            cannedResponses={personalQuickReplies} showCanned={showCanned} setShowCanned={setShowCanned}
            onUseCanned={(t:string) => { setNewMessage(t); setShowCanned(false); }}
            onAddCanned={handleAddCanned} onEditCanned={handleEditCanned} onDeleteCanned={handleDeleteCanned}
            viewMode={viewMode} setViewMode={setViewMode}
            onDeleteMessage={async (id:string) => { if(confirm('ยกเลิกส่ง?')) await deleteMessageAction(id); }}
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

      <div className={`inbox-details-sidebar ${viewMode === 'details' ? 'showing' : ''}`} style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {selectedChat && (
          <TicketSidebar 
            selectedChat={selectedChat} currentTicket={currentTicket} agent={agent} viewMode={viewMode} setViewMode={setViewMode}
            onFetchGlobalHistory={() => alert('ฟีเจอร์ประวัติการสนทนาส่วนกลาง (Global Log) กำลังอยู่ระหว่างการพัฒนาครับ')}
            onResolve={handleResolve} onTransfer={() => setIsTransferModalOpen(true)} onCloseSession={handleCloseSession}
            onCopySurvey={() => { navigator.clipboard.writeText(`${window.location.origin}/survey/${selectedChat.current_ticket_id}`); alert('คัดลอกลิงก์ประเมินแล้ว!'); }}
          />
        )}
      </div>

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
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                maxHeight: '90vh',
                overflowY: 'auto'
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
                   <h3 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>ปิดงานใบงาน #{currentTicket?.ticket_no}</h3>
                   <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
                </div>

                 {/* 1. Module */}
                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>Module ที่เกี่ยวข้อง <span style={{ color: '#ef4444' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                       <select 
                         value={selectedModule} 
                         onChange={(e) => setSelectedModule(e.target.value)}
                         style={{ 
                            width: '100%', 
                            padding: '14px 40px 14px 16px', 
                            borderRadius: '12px', 
                            background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border)', 
                            fontSize: '14px', 
                            fontWeight: '800', 
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer',
                            backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 16px center',
                            backgroundSize: '16px'
                         }}
                       >
                          <option value="" >-- เลือกโมดูล --</option>
                          {availableModules.map(m => (
                            <option key={m} value={m} >{m}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {/* 2. ประเภทงาน */}
                 <div style={{ marginBottom: '32px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>ประเภทงาน <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                       <select
                         value={selectedIssueType}
                         onChange={(e) => setSelectedIssueType(e.target.value)}
                         style={{
                            width: '100%',
                            padding: '14px 40px 14px 16px',
                            borderRadius: '12px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg-input)',
                            color: 'var(--text-main)',
                            fontSize: '14px',
                            fontWeight: '700',
                            outline: 'none',
                            appearance: 'none',
                            cursor: 'pointer'
                         }}
                       >
                          <option value="">-- เลือกประเภทงาน (ไม่บังคับ) --</option>
                          {availableIssueTypes.map(it => (
                            <option key={it} value={it}>{it}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 {/* 3. เทมเพลตสรุปงาน */}
                 <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตสรุปงาน</label>
                       <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer' }}>จัดการเทมเพลต</a>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {personalResTemplates.map((t, idx) => (
                          <button
                             key={idx}
                             type="button"
                             onClick={() => setResSummary(t)}
                             style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', transition: 'all 0.2s' }}
                          >{t}</button>
                       ))}
                       {personalResTemplates.length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต — <a href="/settings/profile" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>ตั้งค่าที่นี่</a></p>
                       )}
                    </div>
                 </div>

                 {/* 4. สรุปผลการแก้ไขงาน */}
                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (RESOLUTION SUMMARY) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <textarea 
                      value={resSummary}
                      onChange={(e) => setResSummary(e.target.value)}
                      placeholder="ระบุรายละเอียดการแก้ไข เช่น 'แก้ไขส่วนลดให้แล้ว', 'อัปเดตสถานะการจัดส่งสำเร็จ'..."
                      style={{
                         width: '100%',
                         height: '140px',
                         background: 'var(--bg-input)',
                         border: '1px solid var(--border)',
                         borderRadius: '16px',
                         padding: '16px',
                         color: 'var(--text-main)',
                         fontSize: '14px',
                         resize: 'none',
                         outline: 'none',
                         transition: 'all 0.3s'
                      }}
                    />
                 </div>

                 <div style={{ display: 'flex', gap: '16px' }}>
                    <button 
                      onClick={() => setShowResolveModal(false)}
                      style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}
                    >
                       ยกเลิก
                    </button>
                    <button 
                      onClick={handleExecuteResolve}
                      disabled={sending || !resSummary.trim() || !selectedModule || !selectedIssueType}
                      style={{ 
                        flex: 1.5, 
                        padding: '16px', 
                        borderRadius: '14px', 
                        border: 'none', 
                        background: (sending || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'rgba(16, 185, 129, 0.15)' : 'var(--success)', 
                        color: (sending || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'var(--text-muted)' : 'black', 
                        fontWeight: '900', 
                        cursor: (sending || !resSummary.trim() || !selectedModule || !selectedIssueType) ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '10px'
                      }}
                    >
                       {sending ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันปิดงาน</>}
                    </button>
                 </div>
              </div>
          </div>
        )}
        {isViewerOpen && viewingImage && <ImageViewerModal imageUrl={viewingImage} onClose={() => setIsViewerOpen(false)} />}
       {isEditorOpen && editingImage && (
         <ImageEditorModal 
           imageUrl={editingImage} 
           onClose={() => setIsEditorOpen(false)} 
           onSave={async (blob: Blob) => {
             setSending(true);
             try {
               const fileName = `edited_inbox_${selectedChat?.id}_${Date.now()}.jpg`;
               const { error: upErr } = await supabase.storage.from('chat_media').upload(fileName, blob, { contentType: 'image/jpeg' });
               if (upErr) throw upErr;
               const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
               await sendAgentMessageAction(selectedChat?.id, selectedChat?.current_ticket_id || null, publicUrl, 'image');
               setIsEditorOpen(false);
             } catch (err: any) {
               alert('Upload Failed: ' + err.message);
             } finally {
               setSending(false);
             }
           }} 
         />
       )}

       <style dangerouslySetInnerHTML={{ __html: `@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }` }} />
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
