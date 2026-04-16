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
import ImageEditorModal from '@/components/chat/ImageEditorModal';
import ImageViewerModal from '@/components/chat/ImageViewerModal';
import { useLiff } from '@/hooks/useLiff';
import { sendPortalMessageAction } from '@/app/actions/portalActions';

export default function TicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isReady, profile, error: liffError, setMockLogin } = useLiff();
  const [ticket, setTicket] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [editingImage, setEditingImage] = useState<string>('');
  const [viewingImage, setViewingImage] = useState<string>('');
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

    // Real-time subscription for chat and ticket updates
    const channel = supabase
      .channel(`customer-ticket-realtime-${id}`)
      // 1. Listen for new messages
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'messages',
        filter: conversationId ? `conversation_id=eq.${conversationId}` : `ticket_id=eq.${id}`
      }, () => {
        fetchTicketData();
      })
      // 2. Listen for ticket status changes
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${id}`
      }, (payload: any) => {
        console.log('Ticket updated:', payload.new);
        setTicket((prev: any) => prev ? ({ ...prev, ...payload.new }) : prev);
        // Also fetch logs to update timeline
        supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false })
          .then(({ data }: any) => { if (data) setLogs(data); });
      })
      .subscribe();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [id, conversationId]);

  const handleEditExistingImage = (url: string) => {
    setEditingImage(url);
    setIsEditorOpen(true);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Optimistic Update
    const optimisticMsg = {
       content: newMessage,
       sender_type: 'customer',
       created_at: new Date().toISOString(),
       ticket_id: id
    };
    setMessages((prev: any[]) => [...prev, optimisticMsg]);
    const messageToSend = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      if (!profile?.userId) throw new Error('LINE profile not loaded');
      
      await sendPortalMessageAction(
         id as string,
         profile.userId,
         messageToSend,
         'text'
      );
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
      setMessages((prev: any[]) => prev.filter((m: any) => m !== optimisticMsg));
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

      if (!profile?.userId) throw new Error('LINE profile not loaded');
      const dbType = type === 'image' ? 'image' : 'file';
      
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      await sendPortalMessageAction(
         id as string,
         profile.userId,
         publicUrl,
         dbType
      );
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isReady || loading) return (
     <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd' }}>
        <Loader2 className="animate-spin" size={32} color="var(--portal-primary)" />
     </div>
  );

  if (liffError || !profile) {
    return (
      <div className="flex-center portal-glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid #fee2e2', background: 'white' }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>ไม่สามารถเข้าถึงได้</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE</p>
        <button 
           onClick={() => setMockLogin('U_MOCK_ADMIN', 'Guest Admin')}
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: '700', marginTop: '16px', cursor: 'pointer' }}
        >
           ทดสอบระบบ (Mock Login)
        </button>
      </div>
    );
  }

  if (!ticket) return (
     <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd', color: '#1e293b', flexDirection: 'column', gap: '16px' }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800' }}>ไม่พบข้อมูลใบงาน</h2>
        <button onClick={() => router.push('/portal')} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
           กลับสู่หน้าหลัก
        </button>
     </div>
  );

  // Status mapping for visual tracker
  const statusLevels: Record<string, number> = {
    'new': 1,
    'pending': 1,
    'assigned': 2,
    'in progress': 2,
    'escalated': 3,
    'resolved': 4,
    'closed': 4
  };
  const currentLevel = statusLevels[String(ticket.status).toLowerCase()] || 1;

  return (
    <div className="portal-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
       {/* 1. Navbar */}
       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '0 4px' }}>
          <button onClick={() => router.push('/portal')} style={{ padding: '8px', borderRadius: '12px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
             <ArrowLeft size={18} />
          </button>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>ตั๋วเลขที่ #{ticket.ticket_no}</h2>
       </div>

       {/* 2. Private Chat Workspace */}
       <section className="portal-glass" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', height: '450px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--portal-border)', paddingBottom: '12px' }}>
             <MessageCircle size={16} color="var(--portal-primary)" />
             <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>สนทนากับเจ้าหน้าที่</h3>
          </div>

          {/* Chat Messages */}
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }} className="no-scrollbar">
             {messages.filter((m: any) => m.message_type !== 'unsent').map((msg, idx) => (
                <div key={idx} style={{ 
                   alignSelf: msg.sender_type === 'customer' ? 'flex-end' : 'flex-start',
                   maxWidth: '80%',
                   padding: '12px 16px',
                   borderRadius: msg.sender_type === 'customer' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                   background: msg.sender_type === 'customer' ? '#1e293b' : '#f1f5f9',
                   color: msg.sender_type === 'customer' ? 'white' : '#334155',
                   boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                }}>
                   <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.5' }}>
                       {msg.message_type === 'image' || (msg.content?.startsWith('http') && msg.content?.match(/\.(jpeg|jpg|gif|png|webp|JPG|PNG)$/i)) ? (
                          <img 
                            src={msg.content} 
                            style={{ maxWidth: '100%', borderRadius: '12px', cursor: 'pointer' }} 
                            alt="Attachment" 
                            onClick={() => handleEditExistingImage(msg.content)}
                            title="คลิกเพื่อทำการแก้ไขภาพ (Edit/Draw)"
                          />
                       ) : msg.message_type === 'file' || (msg.content?.startsWith('http') && msg.message_type !== 'text') ? (
                          <a href={msg.content} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <Paperclip size={14} /> ดูไฟล์แนบ
                          </a>
                       ) : (
                          msg.content
                       )}
                   </div>
                   <p style={{ fontSize: '10px', color: msg.sender_type === 'customer' ? 'rgba(255,255,255,0.6)' : '#94a3b8', marginTop: '6px', fontWeight: '600', textAlign: 'right' }}>
                      {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                   </p>
                </div>
             ))}
             {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--portal-text-muted)', fontSize: '13px', marginTop: '40px' }}>ยังไม่มีข้อความ เริ่มคุยกับเราได้เลยครับ</p>}
          </div>

          {/* Chat Input */}
          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '16px' }}>
              <button 
                onClick={() => setIsAttachModalOpen(true)} 
                style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'white', color: '#64748b', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} 
                className="flex-center"
              >
                 <Paperclip size={18} />
              </button>
              <input 
                type="text" 
                placeholder="เขียนข้อความถึงเจ้าหน้าที่..." 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                style={{ flex: 1, background: 'transparent', border: 'none', borderRadius: '10px', padding: '10px', color: '#1e293b', outline: 'none', fontSize: '14px' }}
              />
              <button 
                onClick={handleSendMessage}
                disabled={sending}
                style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: '#1e293b', color: 'white', cursor: 'pointer' }}
                className="flex-center"
              >
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
              </button>
            </div>
          ) : (
            <div style={{ padding: '16px', borderRadius: '16px', background: '#f0fdf4', border: '1px solid #dcfce7', textAlign: 'center' }}>
               <p style={{ fontSize: '13px', color: '#166534', fontWeight: '700' }}>
                  ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ
               </p>
            </div>
          )}
       </section>

       {/* 3. Status Tracker */}
       <section className="portal-glass" style={{ padding: '24px', marginBottom: '24px', background: 'white', border: '1px solid var(--portal-border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
             <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>สถานะปัจจุบัน</h3>
             <span style={{ fontSize: '14px', fontWeight: '900', color: ticket.status === 'Resolved' ? '#166534' : 'var(--portal-primary)' }}>
                {ticket.status}
             </span>
          </div>

          {/* Progress Bar */}
          <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden', display: 'flex', gap: '4px', marginBottom: '20px' }}>
             {[1, 2, 3, 4].map(step => (
                <div key={step} style={{ 
                   flex: 1, 
                   background: step <= currentLevel ? (['resolved', 'closed'].includes(String(ticket.status).toLowerCase()) ? '#22c55e' : 'var(--portal-primary)') : 'transparent',
                   transition: 'background 0.4s ease'
                }} />
             ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--portal-text-muted)', textTransform: 'uppercase', fontWeight: '800' }}>
             <span>รอดำเนินการ</span>
             <span>รับงานแล้ว</span>
             <span>ส่งต่อแก้ปัญหา</span>
             <span>ปิดงานแล้ว</span>
          </div>
       </section>

       {/* 4. Ticket Info */}
       <div className="portal-glass" style={{ padding: '20px', marginBottom: '24px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
             <FileText size={16} color="var(--portal-primary)" />
             <p style={{ fontSize: '12px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>หัวข้อที่แจ้ง</p>
          </div>
          <p style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
          {ticket.description && <p style={{ fontSize: '14px', color: '#64748b', marginTop: '8px', lineHeight: '1.6' }}>{ticket.description}</p>}
       </div>

       {/* 5. Timeline */}
       <section className="portal-glass" style={{ padding: '24px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
             <Clock size={16} color="var(--portal-primary)" />
             <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>ประวัติการดำเนินการ</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderLeft: '1px solid #e2e8f0', marginLeft: '8px', paddingLeft: '20px' }}>
             {logs.map((log, index) => (
                <div key={log.id} style={{ position: 'relative', marginBottom: '20px' }}>
                   <div style={{ 
                      position: 'absolute', 
                      left: '-24.5px', 
                      top: '4px', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: index === 0 ? 'var(--portal-primary)' : '#cbd5e1',
                      border: '2px solid white'
                   }} />
                   <p style={{ fontSize: '10px', color: 'var(--portal-text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                      {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                   <p style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                      {log.action_type === 'status_change' ? `เปลี่ยนสถานะเป็น ${log.to_status}` : 'เริ่มดำเนินการ'}
                   </p>
                </div>
              ))}
              {logs.length === 0 && <p style={{ fontSize: '12px', color: 'var(--portal-text-muted)' }}>กำลังรอเจ้าหน้าที่รับเรื่อง...</p>}
           </div>
        </section>

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
          saveLabel="ส่งข้อความ (Send)"
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
