'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ShieldAlert, 
  Loader2, 
  CheckCircle,
  X 
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/utils/exportUtils';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import ImageViewerModal from '@/components/modals/ImageViewerModal';
import SummaryExportModal from '@/components/modals/SummaryExportModal';
import { ticketService } from '@/lib/services/ticketService';
import { TicketHeader } from '@/components/tickets/TicketHeader';
import { TicketChat } from '@/components/tickets/TicketChat';
import { TicketSidebar } from '@/components/tickets/TicketSidebar';
import { deleteMessageAction, closeConversationAction } from '@/app/actions/messageActions';
import Skeleton from '@/components/ui/Skeleton';
import { useNotificationContext } from '@/contexts/NotificationContext';

export default function StaffTicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const adminFileRef = React.useRef<HTMLInputElement>(null);

  // Core Data State
  const [ticket, setTicket] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const { addToast } = useNotificationContext();

  // Edit State
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<string[]>([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [companySettingsId, setCompanySettingsId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // UI / Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const quickReplies = [
    "สวัสดีครับ แอดมินรับเรื่องแล้ว กำลังเร่งตรวจสอบให้นะครับ ⏳",
    "รบกวนแจ้ง Error Code หรือจับภาพหน้าจอที่พบปัญหาให้ทีมงานหน่อยครับ 📸",
    "ดำเนินการแก้ไขและอัปเดตระบบเรียบร้อยแล้ว ลองใช้งานใหม่อีกครั้งนะครับ ✅",
    "ขอบคุณที่ใช้บริการครับ ทางเราขออนุญาตปิดตั๋วงานนี้นะครับ 🙏"
  ];

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customers!tickets_customer_id_fkey (*),
          assigned_agent:profiles!assigned_agent_id(*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (ticketData) {
        setTicket(ticketData);
        setStatus(ticketData.status);
        setPriority(ticketData.priority);
        setSelectedDept(ticketData.department || '');
        setSelectedModule(ticketData.module || '');

        // Fetch Logs & Messages
        const [lRes, mRes] = await Promise.all([
           supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
           supabase.from('messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true })
        ]);
        if (lRes.data) setLogs(lRes.data);
        if (mRes.data) setMessages(mRes.data);

        // Fetch active conversation
        const { data: conv } = await supabase
           .from('conversations')
           .select('id, status')
           .eq('customer_id', ticketData.customer_id)
           .eq('status', 'active')
           .maybeSingle();
        if (conv) {
          setConversationId(conv.id);
          setIsChatActive(true);
        } else {
          setIsChatActive(false);
        }
      }

      const { data: companyData } = await supabase.from('company_settings').select('id, departments, modules, resolution_templates').limit(1).single();
      const defaultModules = [
         "ห้องทำงานแพทย์", "ห้องพยาบาล", "ห้องยาผู้ป่วยใน", "ห้องเวชระเบียน", "ห้องผ่าตัด", "ห้องวิสัญญี", "ห้อง Consult", "All"
      ];

      if (companyData) {
         setCompanySettingsId(companyData.id);
         if (companyData.departments) setAvailableDepts(companyData.departments);
         if (companyData.modules && companyData.modules.length > 0) setAvailableModules(companyData.modules);
         else setAvailableModules(defaultModules);
         if (companyData.resolution_templates) setAvailableTemplates(companyData.resolution_templates);
      } else {
         setAvailableModules(defaultModules);
      }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
         const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
         setUser({ ...authUser, ...profile });
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveResTemplates = async (list: string[]) => {
     setAvailableTemplates(list);
     if (companySettingsId) {
       await supabase.from('company_settings').update({ resolution_templates: list }).eq('id', companySettingsId);
     }
  };

  const addResTemplate = (text: string) => {
     if (!text.trim()) return;
     if (availableTemplates.includes(text.trim())) return;
     saveResTemplates([...availableTemplates, text.trim()]);
  };

  const removeResTemplate = (index: number) => {
     const next = availableTemplates.filter((_, i) => i !== index);
     saveResTemplates(next);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`ticket-messages-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `ticket_id=eq.${id}`
      }, (payload: any) => {
        setMessages(prev => {
           if (prev.some(m => m.id === payload.new.id)) return prev;
           return [...prev, payload.new];
        });
      });

    if (conversationId) {
      channel.on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      }, (payload: any) => {
        setMessages(prev => {
           if (prev.some(m => m.id === payload.new.id)) return prev;
           return [...prev, payload.new];
        });
      });
    }

    channel
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages'
      }, (payload: any) => {
         setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${id}`
      }, (payload: any) => {
        setTicket((prev: any) => prev ? ({ ...prev, ...payload.new }) : prev);
        setStatus(payload.new.status);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`Staff Realtime Connected (${id})`);
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [id, conversationId]);

  const handleExportSummary = (format: 'pdf' | 'xlsx') => {
    if (!ticket) return;
    try {
      const summaryData = [{
        'Ticket No': ticket.ticket_no,
        'Subject': ticket.subject,
        'Customer': ticket.customers?.display_name || 'N/A',
        'Status': ticket.status,
        'Priority': ticket.priority,
        'Department': ticket.department || 'N/A',
        'Created At': new Date(ticket.created_at).toLocaleString('th-TH'),
        'Resolved At': ticket.resolved_at ? new Date(ticket.resolved_at).toLocaleString('th-TH') : '-',
        'Resolution summary': ticket.resolution_summary || '-'
      }];
      if (format === 'xlsx') exportToExcel(summaryData, `Summary_Ticket_${ticket.ticket_no}`);
      else exportToPDF(summaryData, `Summary_Ticket_${ticket.ticket_no}`, `NeoSupport Summary: Ticket #${ticket.ticket_no}`);
    } catch (err) { console.error('Export Error:', err); }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const content = newMessage;
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      content: content,
      sender_type: 'agent',
      staff_id: user?.id,
      ticket_id: id,
      conversation_id: conversationId,
      message_type: 'text',
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert([{
        conversation_id: conversationId,
        ticket_id: id,
        sender_type: 'agent',
        staff_id: user?.id,
        message_type: 'text',
        content
      }]);
      if (error) throw error;
      // Note: fetchData() will eventually replace the temp message with the DB one via realtime or fetch
      fetchData();
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      alert('Error: ' + err.message);
      setNewMessage(content);
    }
    finally { setSending(false); }
  };

  const handleAdminFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        setSending(true);
        try {
           const fileExt = file.name.split('.').pop() || 'jpg';
           const fileName = `admin_${id}_${Date.now()}.${fileExt}`;
           const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
           if (uploadError) throw uploadError;
           const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
           await supabase.from('messages').insert([{
              conversation_id: conversationId,
              ticket_id: id,
              sender_type: 'agent',
              staff_id: user?.id,
              message_type: file.type.startsWith('image/') ? 'image' : 'file',
              content: publicUrl,
           }]);
           fetchData();
        } catch(err: any) { alert('Upload Failed: ' + err.message); }
        finally { setSending(false); if(adminFileRef.current) adminFileRef.current.value = ''; }
     }
  };

  const handleEditorSave = async (blob: Blob) => {
    const fileName = `edited_${id}_${Date.now()}.jpg`;
    setSending(true);
    try {
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      await supabase.from('messages').insert([{
        conversation_id: conversationId,
        ticket_id: id,
        sender_type: 'agent',
        staff_id: user?.id,
        message_type: 'image',
        content: publicUrl,
      }]);
      fetchData();
      setShowEditor(false);
      setEditingImage(null);
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setSending(false); }
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } as any });
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise((resolve) => { video.onloadedmetadata = () => { video.play(); resolve(true); }; });
      await new Promise(r => setTimeout(r, 100));
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach(track => track.stop());
      setEditingImage(canvas.toDataURL('image/jpeg', 0.9));
      setShowEditor(true);
    } catch (err: any) { if (err.name !== 'NotAllowedError') alert('Failed: ' + err.message); }
  };

  const handleEndChat = async () => {
    if (!conversationId) return;
    if (!confirm('คุณยืนยันที่จะจบการสนทนานี้ใช่หรือไม่?\nหากกด "ตกลง" ลูกค้าจะไม่สามารถส่งข้อความใหม่ในเซสชั่นนี้ได้จนกว่าจะมีการเปิดใบงานใหม่ครับ')) return;
    
    setUpdating(true);
    try {
      await closeConversationAction(conversationId);
      setIsChatActive(false);
      fetchData();
      addToast({
        id: `end-chat-${id}`,
        type: 'message',
        title: 'Chat Ended! 🔒',
        body: 'การสนทนาถูกปิดเรียบร้อยแล้ว'
      });
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolve = async () => {
    if (!resSummary.trim()) { alert('กรุณากรอกสรุปการแก้ไขงานก่อนปิดตั๋วครับ'); return; }
    if (!selectedModule) { alert('กรุณาเลือกโมดูลที่เกี่ยวข้องก่อนปิดตั๋วครับ'); return; }
    
    if (isChatActive) {
      alert('ไม่สามารถปิดงานได้ เนื่องจากคุณยังไม่ได้กด "จบการสนทนา" กับลูกค้าครับ กรุณากดจบการสนทนาในช่องแชทก่อน');
      return;
    }

    setUpdating(true);
    try {
      const updatedData = await ticketService.resolve(id as string, user?.id, resSummary, selectedModule);
      
      // Send resolution message to conversation if it exists (even if closed)
      if (conversationId) {
        const surveyLink = `${window.location.origin}/survey/${id}`;
        const moduleText = selectedModule ? `\nโมดูล: ${selectedModule}` : '';
        await supabase.from('messages').insert([{
          conversation_id: conversationId, 
          ticket_id: id, 
          sender_type: 'system', 
          staff_id: user?.id,
          content: `[System: ใบงาน #${updatedData.ticket_no} ได้รับการแก้ไขเรียบร้อยแล้ว: ${resSummary}${moduleText}\nแบบประเมิน: ${surveyLink}]`
        }]);
      }

      setStatus('Resolved');
      setTicket({ ...ticket, ...updatedData });
      setShowResolveModal(false);
      fetchData();
      addToast({
        id: `resolve-${id}-${Date.now()}`,
        type: 'ticket',
        title: 'Ticket Resolved! 🎉',
        body: `ใบงาน #${updatedData.ticket_no} ถูกปิดเรียบร้อยแล้ว`,
        ticketId: id as string,
        ticketNo: updatedData.ticket_no
      });
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setUpdating(false); }
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
      fetchData();
    } catch (err: any) {
      alert('Failed: ' + err.message);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.from('tickets').update({ 
        status, 
        priority, 
        module: selectedModule, 
        updated_at: new Date().toISOString() 
      }).eq('id', id);
      if (error) throw error;
      if (status !== ticket.status) {
        await supabase.from('ticket_logs').insert([{
          ticket_id: id, action_type: 'status_change', from_status: ticket.status, to_status: status,
          note: `Agent updated status to ${status}`
        }]);
      }
      if (selectedDept && selectedDept !== ticket.department) {
         try {
           const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
           await sendLineGroupNotification(`🔔 [ส่งต่อแผนก] ใบงาน #${ticket.ticket_no} ถูกส่งต่อไปยัง [${selectedDept}] เรียบร้อยแล้วครับ`);
         } catch (e) {}
         await supabase.from('ticket_logs').insert([{ ticket_id: id, action_type: 'transfer', note: `Ticket moved to department: ${selectedDept}` }]);
      }
      setTicket({ ...ticket, status, priority, department: selectedDept });
      fetchData();
      addToast({
        id: `update-${id}-${Date.now()}`,
        type: 'ticket',
        title: 'Changes Saved! ✅',
        body: `อัปเดตข้อมูลใบงาน #${ticket.ticket_no} เรียบร้อยแล้ว`,
        ticketId: id as string,
        ticketNo: ticket.ticket_no
      });
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setUpdating(false); }
  };

  if (loading) return (
    <div className="animate-page-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
         <Skeleton width={300} height={40} />
         <div style={{ display: 'flex', gap: '12px' }}>
            <Skeleton width={120} height={40} borderRadius={12} />
            <Skeleton width={120} height={40} borderRadius={12} />
         </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
         <div className="glass" style={{ height: '70vh', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <Skeleton width={48} height={48} borderRadius="50%" />
               <Skeleton width="40%" height={24} />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', alignSelf: 'flex-end', flexDirection: 'row-reverse' }}>
               <Skeleton width={48} height={48} borderRadius="50%" />
               <Skeleton width="40%" height={80} borderRadius={16} />
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
               <Skeleton width={48} height={48} borderRadius="50%" />
               <Skeleton width="60%" height={120} borderRadius={16} />
            </div>
         </div>
         <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass" style={{ height: '300px', padding: '24px' }}>
               <Skeleton width="100%" height={24} marginBottom={24} />
               <Skeleton width="100%" height={40} marginBottom={16} />
               <Skeleton width="100%" height={40} />
            </div>
            <div className="glass" style={{ height: '400px', padding: '24px' }}>
               <Skeleton width="100%" height={24} marginBottom={24} />
               <Skeleton width="100%" height={60} marginBottom={16} />
               <Skeleton width="100%" height={60} />
            </div>
         </div>
      </div>
    </div>
  );

  if (!ticket) return (
    <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '20px' }}>
      <ShieldAlert size={64} color="var(--danger)" />
      <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Ticket Not Found</h2>
      <button onClick={() => router.push('/tickets')} className="glass-interactive" style={{ padding: '12px 24px', borderRadius: '12px' }}>Back to List</button>
    </div>
  );

  return (
    <div className="animate-page-in">
      <TicketHeader 
        ticket={ticket} status={status} user={user} updating={updating}
        isChatActive={isChatActive}
        onUpdate={handleUpdate} 
        onResolveClick={() => { setShowResolveModal(true); setResSummary(''); }} 
        onExportClick={() => setShowExportModal(true)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        <TicketChat 
          messages={messages} ticket={ticket} user={user} newMessage={newMessage} setNewMessage={setNewMessage}
          sending={sending} onSendMessage={handleSendMessage} onAttachFile={() => adminFileRef.current?.click()}
          onScreenCapture={handleScreenCapture} 
          onEditImage={(url) => { setViewingImage(url); setShowViewer(true); }}
          onDeleteMessage={handleDeleteMessage}
          onEndChat={handleEndChat}
          isChatActive={isChatActive}
          quickReplies={quickReplies}
          isReadOnly={true}
        />

        <TicketSidebar 
          ticket={ticket} 
          user={user}
          status={status}
          setStatus={setStatus}
          priority={priority}
          setPriority={setPriority}
          selectedDept={selectedDept}
          setSelectedDept={setSelectedDept}
          availableDepts={availableDepts}
          selectedModule={selectedModule}
          setSelectedModule={setSelectedModule}
          availableModules={availableModules}
          logs={logs}
        />
      </div>

       <input type="file" ref={adminFileRef} onChange={handleAdminFile} style={{ display: 'none' }} />
       
        {showResolveModal && (
           <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '20px', backdropFilter: 'blur(8px)' }}>
              <div className="glass" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: '32px', background: 'var(--bg-card)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)', border: '1px solid var(--border)' }}>
                 <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(54, 153, 255, 0.1)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><CheckCircle size={28} /></div>
                    <h3 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '6px' }}>ปิดงานใบงาน #{ticket?.ticket_no}</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและแจ้งลูกค้าครับ</p>
                 </div>

                 <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                       <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>เทมเพลตด่วน (Templates)</label>
                       <button 
                          onClick={() => setIsManagingTemplates(!isManagingTemplates)}
                          style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                       >
                          {isManagingTemplates ? 'เสร็จสิ้น' : 'จัดการเทมเพลต'}
                       </button>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                       {availableTemplates.map((t, idx) => (
                         <div key={idx} style={{ position: 'relative' }}>
                            <button 
                             type="button" 
                             onClick={() => setResSummary(t)} 
                             style={{ padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)', fontSize: '12px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                               {t}
                            </button>
                            {isManagingTemplates && (
                               <button 
                                 onClick={() => removeResTemplate(idx)}
                                 style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                               >
                                  ×
                               </button>
                            )}
                         </div>
                       ))}
                       {availableTemplates.length === 0 && !isManagingTemplates && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่ได้ตั้งค่าเทมเพลต</p>}
                       {isManagingTemplates && (
                          <button 
                            onClick={() => {
                               const val = prompt('เพิ่มข้อความเทมเพลตใหม่:');
                               if (val) addResTemplate(val);
                            }}
                            style={{ padding: '8px 14px', borderRadius: '10px', border: '1px dashed var(--primary)', background: 'none', fontSize: '12px', color: 'var(--primary)', cursor: 'pointer' }}
                          >
                             + เพิ่ม
                          </button>
                       )}
                    </div>
                  </div>

                 <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>Module ที่เกี่ยวข้อง <span style={{ color: '#ef4444' }}>*</span></label>
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
                            boxShadow: '0 8px 12px var(--primary-glow)',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 16px center',
                            backgroundSize: '16px'
                         }}
                       >
                          <option value="" style={{ background: 'white', color: 'black' }}>-- เลือกโมดูล --</option>
                          {availableModules.map(m => (
                            <option key={m} value={m} style={{ background: 'white', color: 'black' }}>{m}</option>
                          ))}
                       </select>
                    </div>
                 </div>

                 <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผลการแก้ไขงาน <span style={{ color: '#ef4444' }}>*</span></label>
                    <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="ระบุสิ่งที่แอดมินดำเนินการแก้ไข..." style={{ width: '100%', height: '100px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--text-main)', fontSize: '14px', resize: 'none', outline: 'none' }} />
                 </div>

                 <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowResolveModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}>ยกเลิก</button>
                    <button onClick={handleResolve} disabled={updating || !resSummary.trim() || !selectedModule} style={{ flex: 1.5, padding: '16px', borderRadius: '14px', border: 'none', background: 'var(--primary)', color: 'black', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', opacity: (!resSummary.trim() || !selectedModule) ? 0.6 : 1, boxShadow: '0 8px 24px var(--primary-glow)' }}>
                       {updating ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={20} /> ยืนยันปิดงาน</>}
                    </button>
                 </div>
              </div>
           </div>
        )}

       {showViewer && viewingImage && (
          <ImageViewerModal 
            imageUrl={viewingImage} 
            onClose={() => { setShowViewer(false); setViewingImage(null); }} 
            onEdit={(url) => { setEditingImage(url); setShowEditor(true); }}
          />
       )}

       {showEditor && editingImage && <ImageEditorModal imageUrl={editingImage} onClose={() => { setShowEditor(false); setEditingImage(null); }} onSave={handleEditorSave} />}
       <SummaryExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExportSummary} ticketNo={ticket?.ticket_no || ''} />
       <style dangerouslySetInnerHTML={{ __html: `@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}} />
    </div>
  );
}
