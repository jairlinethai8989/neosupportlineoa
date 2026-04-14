'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ShieldAlert, 
  Loader2, 
  CheckCircle 
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/utils/exportUtils';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import SummaryExportModal from '@/components/modals/SummaryExportModal';
import { ticketService } from '@/lib/services/ticketService';
import { TicketHeader } from '@/components/tickets/TicketHeader';
import { TicketChat } from '@/components/tickets/TicketChat';
import { TicketSidebar } from '@/components/tickets/TicketSidebar';
import Skeleton from '@/components/ui/Skeleton';

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

  // Edit State
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  
  // UI / Modal State
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
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
           .select('id')
           .eq('customer_id', ticketData.customer_id)
           .eq('status', 'active')
           .maybeSingle();
        if (conv) setConversationId(conv.id);
      }

      // Fetch dynamic departments from company_settings mapping
      const { data: companyData } = await supabase.from('company_settings').select('departments').limit(1).single();
      if (companyData && companyData.departments) {
         setAvailableDepts(companyData.departments);
      }

      // Fetch current user
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

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`ticket-messages-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `ticket_id=eq.${id}`
      }, () => fetchData())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

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
      fetchData();
    } catch (err: any) { alert('Error: ' + err.message); }
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

  const handleResolve = async () => {
    if (!resSummary.trim()) { alert('กรุณากรอกสรุปการแก้ไขงานก่อนปิดตั๋วครับ'); return; }
    setUpdating(true);
    try {
      const updatedData = await ticketService.resolve(id as string, user?.id, resSummary);
      if (conversationId) {
        const surveyLink = `${window.location.origin}/survey/${id}`;
        await supabase.from('messages').insert([{
          conversation_id: conversationId, ticket_id: id, sender_type: 'agent', staff_id: user?.id,
          content: `[System: ใบงาน #${updatedData.ticket_no} ได้รับการแก้ไขเรียบร้อยแล้ว: ${resSummary}\nแบบประเมิน: ${surveyLink}]`
        }]);
      }
      setStatus('Resolved');
      setTicket({ ...ticket, ...updatedData });
      setShowResolveModal(false);
      fetchData();
      setToastMsg('Ticket resolved successfully! 🎉'); setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) { alert('Failed: ' + err.message); }
    finally { setUpdating(false); }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const { error } = await supabase.from('tickets').update({ status, priority, updated_at: new Date().toISOString() }).eq('id', id);
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
      setToastMsg('Changes saved successfully! ✅'); setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
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
        onUpdate={handleUpdate} onResolveClick={() => setShowResolveModal(true)} onExportClick={() => setShowExportModal(true)}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        <TicketChat 
          messages={messages} ticket={ticket} user={user} newMessage={newMessage} setNewMessage={setNewMessage}
          sending={sending} onSendMessage={handleSendMessage} onAttachFile={() => adminFileRef.current?.click()}
          onScreenCapture={handleScreenCapture} onEditImage={(url) => { setEditingImage(url); setShowEditor(true); }}
          quickReplies={quickReplies}
        />

        <TicketSidebar 
          ticket={ticket} user={user} status={status} setStatus={setStatus} priority={priority} setPriority={setPriority}
          selectedDept={selectedDept} setSelectedDept={setSelectedDept} availableDepts={availableDepts} logs={logs}
        />
      </div>

       <input type="file" ref={adminFileRef} onChange={handleAdminFile} style={{ display: 'none' }} />
       
       {showToast && (
         <div style={{ position: 'fixed', top: '24px', right: '24px', background: 'var(--success)', color: 'black', padding: '16px 24px', borderRadius: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 32px rgba(0, 255, 127, 0.3)', zIndex: 9999, animation: 'slideInRight 0.3s ease-out' }}>
           <CheckCircle size={20} /> {toastMsg}
         </div>
       )}

       {showResolveModal && (
         <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(5, 8, 12, 0.85)', backdropFilter: 'blur(24px) saturate(180%)', padding: '20px' }}>
            <div className="glass animate-page-in" style={{ width: '100%', maxWidth: '480px', padding: '40px', borderRadius: '32px', border: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: '0 40px 100px rgba(0,0,0,0.6)' }}>
               <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '20px', background: 'rgba(0, 255, 127, 0.1)', color: 'var(--success)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}><CheckCircle size={32} /></div>
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>ปิดงานการสนทนา</h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและส่งการยืนยันให้ลูกค้าทราบครับ</p>
               </div>
               <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน</label>
                  <textarea value={resSummary} onChange={(e) => setResSummary(e.target.value)} placeholder="ระบุสิ่งที่แอดมินดำเนินการแก้ไข..." style={{ width: '100%', height: '120px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', padding: '16px', color: '#fff', fontSize: '14px', resize: 'none', outline: 'none' }} />
               </div>
               <div style={{ display: 'flex', gap: '16px' }}>
                  <button onClick={() => setShowResolveModal(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontWeight: '800', cursor: 'pointer' }}>ยกเลิก</button>
                  <button onClick={handleResolve} disabled={updating || !resSummary.trim()} style={{ flex: 1.5, padding: '16px', borderRadius: '14px', border: 'none', background: updating || !resSummary.trim() ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, var(--success) 0%, oklch(75% 0.18 150) 100%)', color: updating || !resSummary.trim() ? 'rgba(255,255,255,0.2)' : '#000', fontWeight: '900', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: updating || !resSummary.trim() ? 'none' : '0 10px 25px rgba(0, 255, 127, 0.25)' }}>
                     {updating ? <Loader2 size={24} className="animate-spin" /> : <><CheckCircle size={20} /> ยืนยันปิดงาน</>}
                  </button>
               </div>
            </div>
         </div>
       )}

       {showEditor && editingImage && <ImageEditorModal imageUrl={editingImage} onClose={() => { setShowEditor(false); setEditingImage(null); }} onSave={handleEditorSave} />}
       <SummaryExportModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} onExport={handleExportSummary} ticketNo={ticket?.ticket_no || ''} />
       <style dangerouslySetInnerHTML={{ __html: `@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}} />
    </div>
  );
}
