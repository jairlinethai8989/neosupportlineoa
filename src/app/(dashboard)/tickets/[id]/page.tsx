'use client';
import React, { useState, useEffect, useRef } from 'react';
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
  const conversationIdRef = useRef<string | null>(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const { addToast } = useNotificationContext();

  // Edit State
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [isManagingTemplates, setIsManagingTemplates] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  
  // UI / Modal State
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

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
        const lRes = await supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false });
        if (lRes.data) setLogs(lRes.data);

        const { data: conv } = await supabase.from('conversations').select('id, status').eq('customer_id', ticketData.customer_id).eq('status', 'active').maybeSingle();
        if (conv) {
          setConversationId(conv.id);
          conversationIdRef.current = conv.id;
          setIsChatActive(true);
        } else {
          setIsChatActive(false);
        }

        const cid = conversationIdRef.current;
        const { data: msgData } = await (cid
          ? supabase.from('messages').select('*').or(`ticket_id.eq.${id},conversation_id.eq.${cid}`)
          : supabase.from('messages').select('*').eq('ticket_id', id)
        ).order('created_at', { ascending: true });
        if (msgData) setMessages(msgData);
      }

      const { data: companyData } = await supabase.from('company_settings').select('id, departments, modules').limit(1).single();
      const defaultModules = ["ห้องทำงานแพทย์", "ห้องพยาบาล", "ห้องยาผู้ป่วยใน", "ห้องเวชระเบียน", "ห้องผ่าตัด", "ห้องวิสัญญี", "ห้อง Consult", "All"];
      if (companyData) {
         if (companyData.departments) setAvailableDepts(companyData.departments);
         if (companyData.modules && companyData.modules.length > 0) setAvailableModules(companyData.modules);
         else setAvailableModules(defaultModules);
      } else { setAvailableModules(defaultModules); }

      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
          const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
          if (profile) {
            setUser({ ...authUser, ...profile });
            if (profile.quick_replies) setPersonalQuickReplies(profile.quick_replies);
            if (profile.resolution_templates) setPersonalResTemplates(profile.resolution_templates);
          } else { setUser(authUser); }
      }
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  };

  const addResTemplate = async (text: string) => {
     if (!text.trim() || !user) return;
     const updated = [...personalResTemplates, text.trim()];
     setPersonalResTemplates(updated);
     await supabase.from('profiles').update({ resolution_templates: updated, updated_at: new Date().toISOString() }).eq('id', user.id);
  };

  const removeResTemplate = async (index: number) => {
     if (!user) return;
     const updated = personalResTemplates.filter((_, i) => i !== index);
     setPersonalResTemplates(updated);
     await supabase.from('profiles').update({ resolution_templates: updated, updated_at: new Date().toISOString() }).eq('id', user.id);
  };

  useEffect(() => {
    fetchData();
    const chan = supabase.channel(`staff-ticket-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p: any) => {
        const msg = p.new; const cid = conversationIdRef.current;
        if (msg.ticket_id === id || (cid && msg.conversation_id === cid)) {
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p: any) => {
        setMessages(prev => prev.map(m => m.id === p.new.id ? p.new : m));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${id}` }, (p: any) => {
        setTicket((prev: any) => prev ? ({ ...prev, ...p.new }) : prev);
        setStatus(p.new.status);
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); conversationIdRef.current = null; };
  }, [id]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    const content = newMessage;
    const optimisticMsg = { id: `temp-${Date.now()}`, content, sender_type: 'agent', staff_id: user?.id, ticket_id: id, conversation_id: conversationId, message_type: 'text', created_at: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage(''); setSending(true);
    try {
      const { error } = await supabase.from('messages').insert([{ conversation_id: conversationId, ticket_id: id, sender_type: 'agent', staff_id: user?.id, message_type: 'text', content }]);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
      setNewMessage(content); alert('Error: ' + err.message);
    } finally { setSending(false); }
  };

  const handleAdminFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]; setSending(true);
      try {
        const fileName = `admin_${id}_${Date.now()}.${file.name.split('.').pop()}`;
        const { error: upErr } = await supabase.storage.from('chat_media').upload(fileName, file);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
        await supabase.from('messages').insert([{ conversation_id: conversationId, ticket_id: id, sender_type: 'agent', staff_id: user?.id, message_type: file.type.startsWith('image/') ? 'image' : 'file', content: publicUrl }]);
        fetchData();
      } catch (err: any) { alert('Upload Failed: ' + err.message); }
      finally { setSending(false); if (adminFileRef.current) adminFileRef.current.value = ''; }
    }
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true } as any);
      const video = document.createElement('video'); video.srcObject = stream;
      await new Promise(r => video.onloadedmetadata = () => { video.play(); r(true); });
      const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0); stream.getTracks().forEach(t => t.stop());
      setEditingImage(canvas.toDataURL('image/jpeg', 0.9)); setShowEditor(true);
    } catch (err: any) { if (err.name !== 'NotAllowedError') alert('Failed: ' + err.message); }
  };

  const handleEditorSave = async (blob: Blob) => {
    setSending(true);
    try {
      const fileName = `edited_${id}_${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('chat_media').upload(fileName, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      await supabase.from('messages').insert([{ conversation_id: conversationId, ticket_id: id, sender_type: 'agent', staff_id: user?.id, message_type: 'image', content: publicUrl }]);
      fetchData(); setShowEditor(false); setEditingImage(null);
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setSending(false); }
  };

  const handleDeleteMessage = async (mid: string) => {
    if (!confirm('ยกเลิกส่ง?')) return;
    try { await deleteMessageAction(mid); fetchData(); } catch (err: any) { alert('Failed: ' + err.message); }
  };

  const handleEndChat = async () => {
    if (!conversationId || !confirm('ยืนยันจบการสนทนา?')) return;
    setUpdating(true);
    try { await closeConversationAction(conversationId); setIsChatActive(false); fetchData(); }
    catch (err: any) { alert('Failed: ' + err.message); } finally { setUpdating(false); }
  };

  const handleResolve = async () => {
    if (!resSummary.trim() || !selectedModule) return;
    if (isChatActive) { alert('จบการสนทนาก่อนครับ'); return; }
    setUpdating(true);
    try {
      const up = await ticketService.resolve(id as string, user?.id, resSummary, selectedModule);
      if (conversationId) {
        const link = `${window.location.origin}/survey/${id}`;
        await supabase.from('messages').insert([{ conversation_id: conversationId, ticket_id: id, sender_type: 'system', staff_id: user?.id, content: `[SYSTEM] แก้ไขเรียบร้อย: ${resSummary}\nโมดูล: ${selectedModule}\nประเมิน: ${link}` }]);
      }
      setShowResolveModal(false); fetchData();
    } catch (err: any) { alert('Failed: ' + err.message); } finally { setUpdating(false); }
  };

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" /></div>;
  if (!ticket) return <div className="flex-center" style={{ height: '70vh' }}><h2>Ticket Not Found</h2></div>;

  return (
    <div className="animate-page-in">
      <TicketHeader ticket={ticket} status={status} user={user} updating={updating} isChatActive={isChatActive} onUpdate={() => fetchData()} onResolveClick={() => { setShowResolveModal(true); setResSummary(''); }} onExportClick={() => setShowExportModal(true)} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        <TicketChat messages={messages} ticket={ticket} user={user} newMessage={newMessage} setNewMessage={setNewMessage} sending={sending} onSendMessage={handleSendMessage} onAttachFile={() => adminFileRef.current?.click()} onScreenCapture={handleScreenCapture} onEditImage={(u) => { setViewingImage(u); setShowViewer(true); }} onDeleteMessage={handleDeleteMessage} onEndChat={handleEndChat} isChatActive={isChatActive} quickReplies={personalQuickReplies} isReadOnly={true} />
        <TicketSidebar ticket={ticket} user={user} status={status} setStatus={setStatus} priority={priority} setPriority={setPriority} selectedDept={selectedDept} setSelectedDept={setSelectedDept} availableDepts={availableDepts} selectedModule={selectedModule} setSelectedModule={setSelectedModule} availableModules={availableModules} logs={logs} onUpdate={() => fetchData()} />
      </div>

      {showResolveModal && (
         <div style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(15, 23, 42, 0.4)', padding: '20px', backdropFilter: 'blur(8px)' }}>
            <div className="glass" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: '32px', background: 'var(--bg-card)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
               <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(54, 153, 255, 0.1)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}><CheckCircle size={28} /></div>
                  <h3 style={{ fontSize: '22px', fontWeight: '900', marginBottom: '6px' }}>ปิดงานใบงาน #{ticket?.ticket_no}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>กรุณาสรุปผลการแก้ไขปัญหาเพื่อแจ้งลูกค้าครับ</p>
               </div>
               <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                     <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase' }}>เทมเพลตส่วนตัว</label>
                     <button onClick={() => setIsManagingTemplates(!isManagingTemplates)} style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>{isManagingTemplates ? 'เสร็จสิ้น' : 'จัดการ'}</button>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {personalResTemplates.map((t, idx) => (
                         <div key={idx} style={{ position: 'relative' }}>
                            <button onClick={() => setResSummary(t)} style={{ padding: '8px 16px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'rgba(0, 242, 254, 0.08)', fontSize: '13px', color: 'var(--primary)', cursor: 'pointer' }}>{t}</button>
                            {isManagingTemplates && <button onClick={() => removeResTemplate(idx)} style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', cursor: 'pointer' }}>×</button>}
                         </div>
                      ))}
                      {isManagingTemplates && <button onClick={() => { const v=prompt('เพิ่ม:'); if(v) addResTemplate(v); }} style={{ padding: '8px 14px', borderRadius: '10px', border: '1px dashed var(--primary)', color: 'var(--primary)', cursor: 'pointer' }}>+ เพิ่มส่วนตัว</button>}
                      {(personalResTemplates.length === 0 && !isManagingTemplates) && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>ยังไม่มีเทมเพลต</p>}
                  </div>
               </div>
               <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>Module <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'var(--primary)', color: 'black', fontWeight: '800', border: 'none' }}>
                     <option value="">-- เลือกโมดูล --</option>
                     {availableModules.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
               </div>
               <div style={{ marginBottom: '24px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '8px' }}>สรุปผล <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="รายละเอียด..." style={{ width: '100%', height: '100px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--text-main)', fontSize: '14px', resize: 'none' }} />
               </div>
               <div style={{ display: 'flex', gap: '16px' }}>
                  <button onClick={() => setShowResolveModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '15px', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)', fontWeight: '800', cursor: 'pointer' }}>ยกเลิก</button>
                  <button onClick={handleResolve} disabled={updating || !resSummary.trim() || !selectedModule} style={{ flex: 1.5, padding: '16px', borderRadius: '15px', border: 'none', background: (updating || !resSummary.trim() || !selectedModule) ? 'var(--bg-card)' : 'var(--success)', color: (updating || !resSummary.trim() || !selectedModule) ? 'var(--text-muted)' : '#000', fontWeight: '900', cursor: 'pointer' }}>
                     {updating ? <Loader2 size={18} className="animate-spin" /> : 'ยืนยันปิดงาน'}
                  </button>
               </div>
            </div>
         </div>
      )}
      <input type="file" ref={adminFileRef} onChange={handleAdminFile} style={{ display: 'none' }} />
      {showViewer && viewingImage && <ImageViewerModal imageUrl={viewingImage} onClose={() => { setShowViewer(false); setViewingImage(null); }} onEdit={(u) => { setEditingImage(u); setShowEditor(true); }} />}
      {showEditor && editingImage && <ImageEditorModal imageUrl={editingImage} onClose={() => { setShowEditor(false); setEditingImage(null); }} onSave={handleEditorSave} />}
      <SummaryExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={(f) => {}} ticketNo={ticket?.ticket_no || ''} />
      <style dangerouslySetInnerHTML={{ __html: `@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}} />
    </div>
  );
}
