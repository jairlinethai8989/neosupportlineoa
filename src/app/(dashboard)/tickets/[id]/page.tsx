'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare,
  ShieldAlert,
  Loader2,
  Save,
  Trash2,
  MoreVertical,
  SendHorizontal,
  Paperclip,
  FileDown,
  Monitor
} from 'lucide-react';
import { exportToPDF, exportToExcel } from '@/lib/utils/exportUtils';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import SummaryExportModal from '@/components/modals/SummaryExportModal';

export default function StaffTicketDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [ticket, setTicket] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  // State for editing
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [debugError, setDebugError] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<string[]>([]);

  const [chatLoading, setChatLoading] = useState(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const adminFileRef = React.useRef<HTMLInputElement>(null);
  
  // Resolution Modal States
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  
  // Image Editor States
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const quickReplies = [
    "สวัสดีครับ แอดมินรับเรื่องแล้ว กำลังเร่งตรวจสอบให้นะครับ ⏳",
    "รบกวนแจ้ง Error Code หรือจับภาพหน้าจอที่พบปัญหาให้ทีมงานหน่อยครับ 📸",
    "ดำเนินการแก้ไขและอัปเดตระบบเรียบร้อยแล้ว ลองใช้งานใหม่อีกครั้งนะครับ ✅",
    "ขอบคุณที่ใช้บริการครับ ทางเราขออนุญาตปิดตั๋วงานนี้นะครับ 🙏"
  ];

  useEffect(() => {
    if (!id) return;

    async function fetchData() {
      if (!id) return;
      setDebugError(null);
      setLoading(true);

      try {
        // Fetch base ticket first to ensure existence
        const { data: tBase, error: e1 } = await supabase
          .from('tickets')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (e1) throw e1;
        if (!tBase) {
           console.warn('Ticket base not found for id:', id);
           setLoading(false);
           return;
        }

        // Now fetch with relations
        const { data: ticketData, error: e2 } = await supabase
          .from('tickets')
          .select(`
            *,
            customers (*),
            assigned_agent:profiles!assigned_agent_id(*)
          `)
          .eq('id', id)
          .maybeSingle();

        if (e2) {
           console.error('Fetch relations error:', e2);
           setTicket(tBase); // Fallback to base
        } else {
           setTicket(ticketData);
        }

        if (ticketData || tBase) {
          const t = ticketData || tBase;
          setStatus(t.status);
          setPriority(t.priority);
          setSelectedDept(t.department || '');

          // Fetch dynamic departments
          const { data: company } = await supabase.from('company_settings').select('departments').limit(1).single();
          if (company?.departments) setAvailableDepts(company.departments);

          // Fetch Logs & Messages
          const [lRes, mRes] = await Promise.all([
             supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false }),
             supabase.from('messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true })
          ]);
          
          if (lRes.data) setLogs(lRes.data);
          if (mRes.data) setMessages(mRes.data);
        }
        // Fetch current user
        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);
      } catch (err: any) {
        console.error('Final fetch error:', err);
        setDebugError(err.message);
      } finally {
        setLoading(false);
        setChatLoading(false);
      }
    }

    fetchData();

    // Subscribe to new messages for THIS ticket
    const channel = supabase
      .channel(`ticket-messages-${id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `ticket_id=eq.${id}`
      }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleExportSummary = (format: 'pdf' | 'xlsx') => {
    if (!ticket) return;
    console.log(`Generating Summary Export (${format})...`, ticket.ticket_no);
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
      
      if (format === 'xlsx') {
        exportToExcel(summaryData, `Summary_Ticket_${ticket.ticket_no}`);
      } else {
        exportToPDF(summaryData, `Summary_Ticket_${ticket.ticket_no}`, `NeoSupport Summary: Ticket #${ticket.ticket_no}`);
      }
      console.log('Summary Export Generated');
    } catch (err) {
      console.error('Export Error:', err);
      alert('Export failed. Please check console for details.');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    // Create optimistic message
    const optimisticMsg = {
       content: newMessage,
       sender_type: 'agent',
       created_at: new Date().toISOString(),
       ticket_id: id
    };
    
    setMessages(prev => [...prev, optimisticMsg]);
    const messageToSend = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      // INTERNAL ONLY: Save to Supabase messages table
      const { error } = await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'agent',
        staff_id: user?.id, // NEW STRONG RELATION
        message_type: 'text',
        content: messageToSend
      }]);

      if (error) throw error;
    } catch (err: any) {
      alert('Error: ' + err.message);
      // Rollback on error if needed
      setMessages(prev => prev.filter(m => m !== optimisticMsg));
    } finally {
      setSending(false);
    }
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
           const messageType = file.type.startsWith('image/') ? 'image' : 'file';
           
           await supabase.from('messages').insert([{
              ticket_id: id,
              sender_type: 'agent',
        staff_id: user?.id, // NEW STRONG RELATION
              message_type: messageType,
              content: publicUrl,
           }]);
        } catch(err: any) {
           alert('Upload Failed: ' + err.message);
        } finally {
           setSending(false);
           if(adminFileRef.current) adminFileRef.current.value = '';
        }
     }
  };

  const handleEditorSave = async (blob: Blob) => {
    const fileName = `edited_${id}_${Date.now()}.jpg`;
    setSending(true);
    try {
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, blob, {
        contentType: 'image/jpeg'
      });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      
      const { error } = await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'agent',
        staff_id: user?.id, // NEW STRONG RELATION
        message_type: 'image',
        content: publicUrl,
      }]);

      if (error) throw error;
      setShowEditor(false);
      setEditingImage(null);
    } catch (err: any) {
      alert('Failed to send edited image: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: 'always' } as any
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve(true);
        };
      });

      // Give it a tiny bit of time to render
      await new Promise(r => setTimeout(r, 100));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0);
      
      stream.getTracks().forEach(track => track.stop());
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setEditingImage(dataUrl);
      setShowEditor(true);
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') {
        alert('Screen Capture Failed: ' + err.message);
      }
    }
  };

  const handleResolve = async () => {
    if (!resSummary.trim()) {
       alert('กรุณากรอกสรุปการแก้ไขงานก่อนปิดตั๋วครับ');
       return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
           status: 'Resolved', 
           resolved_at: new Date().toISOString(),
           resolution_summary: resSummary,
           updated_at: new Date().toISOString() 
        })
        .eq('id', id);

      if (error) throw error;

      // Close the active conversation if any
      if (ticket?.customer_id) {
         await supabase.from('conversations')
          .update({ status: 'closed', current_ticket_id: null })
          .eq('customer_id', ticket.customer_id)
          .eq('status', 'active');
      }

      // 1. Add Log
      await supabase.from('ticket_logs').insert([{
        ticket_id: id,
        action_type: 'resolve',
        from_status: ticket.status,
        to_status: 'Resolved',
        note: resSummary
      }]);

      // 2. Trigger CSAT survey
      await supabase.from('csat_surveys').insert([{
         ticket_id: id,
         sent_at: new Date().toISOString()
      }]);

      // 3. Send automated closing message to private chat
      await supabase.from('messages').insert([{
        ticket_id: id,
        sender_type: 'agent',
        content: `[System: ใบงาน #${ticket.ticket_no} ได้รับการแก้ไขเรียบร้อยแล้ว: ${resSummary}\nขอบคุณที่ใช้บริการครับ 🙏]`
      }]);

      setStatus('Resolved');
      setTicket({ ...ticket, status: 'Resolved' });
      setShowResolveModal(false);
      
      // Refresh logs & messages
      const { data: newLogs } = await supabase.from('ticket_logs').select('*').eq('ticket_id', id).order('created_at', { ascending: false });
      if (newLogs) setLogs(newLogs);
      
      const { data: newMsgs } = await supabase.from('messages').select('*').eq('ticket_id', id).order('created_at', { ascending: true });
      if (newMsgs) setMessages(newMsgs);

      // Trigger SUCCESS FEEDBACK
      setToastMsg('Ticket resolved successfully! 🎉');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (err: any) {
      alert('Failed to resolve: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      // Robust update helper to handle missing columns gracefully
      const payload: any = { 
        status, 
        priority,
        updated_at: new Date().toISOString()
      };

      // Only attempt to add department if it exists or if we want to be safe
      // Note: If the column is missing, Supabase will return a 400 error.
      // We'll try to update with everything first.
      payload.department = selectedDept;

      const { error } = await supabase
        .from('tickets')
        .update(payload)
        .eq('id', id);

      if (error) {
        // If it's a "column does not exist" error, retry without department
        if (error.message.includes('column "department" of relation "tickets" does not exist')) {
          console.warn('Department column missing from tickets table. Retrying update without it.');
          const { error: retryError } = await supabase
            .from('tickets')
            .update({ status, priority, updated_at: new Date().toISOString() })
            .eq('id', id);
          if (retryError) throw retryError;
        } else {
          throw error;
        }
      }

      // Add a log entry for the change
      if (status !== ticket.status) {
        await supabase.from('ticket_logs').insert([{
          ticket_id: id,
          action_type: 'status_change',
          from_status: ticket.status,
          to_status: status,
          note: `Agent updated status to ${status}`
        }]);
      }
      
      // Notify if department changed
      if (selectedDept && selectedDept !== ticket.department) {
         try {
           const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
           await sendLineGroupNotification(`🔔 [ส่งต่อแผนก] ใบงาน #${ticket.ticket_no} ถูกส่งต่อไปยัง [${selectedDept}] เรียบร้อยแล้วครับ`);
         } catch (e) {}
         
         await supabase.from('ticket_logs').insert([{
           ticket_id: id,
           action_type: 'transfer',
           note: `Ticket moved to department: ${selectedDept}`
         }]);
      }

      setTicket({ ...ticket, status, priority, department: selectedDept });
      
      // Refresh logs
      const { data: newLogs } = await supabase
        .from('ticket_logs')
        .select('*')
        .eq('ticket_id', id)
        .order('created_at', { ascending: false });
      if (newLogs) setLogs(newLogs);
      
      // Trigger SUCCESS FEEDBACK
      setToastMsg('Changes saved successfully! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);

    } catch (err: any) {
      alert('Failed to update ticket: ' + err.message);
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="flex-center" style={{ height: '70vh' }}>
      <Loader2 className="animate-spin" size={32} color="var(--primary)" />
    </div>
  );

  if (!ticket) return (
    <div className="flex-center" style={{ height: '70vh', flexDirection: 'column', gap: '20px' }}>
      <ShieldAlert size={64} color="var(--danger)" />
      <h2 style={{ fontSize: '24px', fontWeight: '800' }}>Ticket Not Found</h2>
      <button onClick={() => router.push('/tickets')} className="glass-interactive" style={{ padding: '12px 24px', borderRadius: '12px' }}>
        Back to List
      </button>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Navbar Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => router.push('/tickets')} className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none' }}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: '800' }}>#{ticket.ticket_no}</h1>
              <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', background: 'rgba(255, 171, 0, 0.1)', color: 'var(--warning)', letterSpacing: '1px' }}>
                 {ticket.status.toUpperCase()}
              </span>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Ticket Details & Management</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowExportModal(true)}
              className="glass-interactive flex-center" 
              style={{ padding: '0 20px', height: '44px', borderRadius: '12px', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-main)', fontWeight: '800', gap: '8px' }}>
              <FileDown size={18} /> สรุปใบงาน (Summary)
            </button>
          </div>
          {status !== 'Resolved' && status !== 'Closed' && status !== 'New' && (
            <button 
              onClick={() => setShowResolveModal(true)}
              className="glass-interactive flex-center" 
              style={{ padding: '0 20px', height: '44px', borderRadius: '12px', border: '1px solid var(--success)', background: 'rgba(0, 255, 127, 0.1)', color: 'var(--success)', fontWeight: '800', gap: '8px' }}>
              <CheckCircle size={18} /> End Conversation
            </button>
          )}
          <button 
            onClick={handleUpdate}
            disabled={updating}
            className="glass-interactive flex-center" 
            style={{ padding: '0 20px', height: '44px', borderRadius: '12px', border: '1px solid var(--primary)', background: 'var(--primary)', color: 'black', fontWeight: '800', gap: '8px' }}>
            {updating ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Save Changes
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px', alignItems: 'start' }}>
        {/* Main Area: Chat Workspace (Left) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div className="glass" style={{ padding: '32px', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: '600px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block' }}>Chat Workspace</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 12px', background: 'rgba(0,255,127,0.1)', borderRadius: '20px' }}>
                   <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }} />
                   <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: '800' }}>LIVE SESSION</span>
                </div>
              </div>
              
              {/* Message History */}
              <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px', paddingRight: '12px' }}>
                 {messages.map((msg, idx) => (
                    <div key={idx} style={{ 
                       alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                       maxWidth: '75%',
                       display: 'flex',
                       flexDirection: 'column',
                       alignItems: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start'
                    }}>
                       <div style={{ 
                          padding: '12px 18px',
                          borderRadius: '18px',
                          borderTopRightRadius: msg.sender_type === 'agent' ? '4px' : '18px',
                          borderTopLeftRadius: msg.sender_type === 'customer' ? '4px' : '18px',
                          background: msg.sender_type === 'agent' ? 'var(--primary)' : 'var(--secondary)',
                          color: msg.sender_type === 'agent' ? 'black' : 'var(--text)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                       }}>
                          {msg.message_type === 'image' || msg.content.includes('supabase.co/storage') ? (
                             <img 
                                src={msg.content} 
                                alt="attachment" 
                                onClick={() => {
                                   if (ticket?.status === 'Resolved' || ticket?.status === 'Closed') {
                                      window.open(msg.content, '_blank');
                                   } else {
                                      setEditingImage(msg.content);
                                      setShowEditor(true);
                                   }
                                }}
                                title="คลิกเพื่อแก้ไขและวาดรูป"
                                style={{ maxWidth: '280px', borderRadius: '8px', cursor: 'pointer', objectFit: 'cover' }} 
                             />
                          ) : (
                             <p style={{ fontSize: '14px', fontWeight: msg.sender_type === 'agent' ? '700' : '500', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{msg.content}</p>
                          )}
                       </div>
                       <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontWeight: '600' }}>
                          {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          {msg.sender_type === 'agent' && ' • Sent by you'}
                       </p>
                    </div>
                 ))}
                 {messages.length === 0 && (
                    <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.3 }}>
                       <MessageSquare size={48} style={{ marginBottom: '16px' }} />
                       <p style={{ fontSize: '16px', fontWeight: '800' }}>No messages yet</p>
                       <p style={{ fontSize: '12px' }}>Start supporting your customer</p>
                    </div>
                 )}
              </div>

              {/* Input Area */}
              <div style={{ marginTop: 'auto' }}>
                 {/* Quick Replies */}
                 {ticket.status !== 'New' && ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                  <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '12px', paddingBottom: '4px' }}>
                      {quickReplies.map((qr, idx) => (
                        <button 
                          key={idx}
                          onClick={() => setNewMessage((prev) => prev ? prev + ' ' + qr : qr)}
                          className="glass-interactive"
                          style={{ whiteSpace: 'nowrap', padding: '6px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '20px', fontSize: '11px', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}>
                          {qr.substring(0, 30)}...
                        </button>
                      ))}
                  </div>
                 )}
                 
                 {ticket.status === 'New' ? (
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 171, 0, 0.05)', border: '1px dotted var(--warning)', textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: '800' }}>
                         ⚠️ กรุณากด "รับงาน (Claim)" เพื่อเริ่มต้นการพูดคุยกับลูกค้า
                      </p>
                    </div>
                  ) : ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                    <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(0, 255, 127, 0.05)', border: '1px dotted var(--success)', textAlign: 'center' }}>
                       <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '800' }}>
                          ✅ ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ
                       </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '12px', background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '16px', border: '1px solid var(--border)', alignItems: 'center' }}>
                       <input type="file" ref={adminFileRef} onChange={handleAdminFile} style={{ display: 'none' }} />
                       <button 
                          onClick={() => adminFileRef.current?.click()}
                          disabled={sending}
                          className="glass-interactive flex-center" 
                          title="แนบไฟล์รูปภาพ"
                          style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
                          <Paperclip size={18} />
                       </button>
                       <button 
                          onClick={handleScreenCapture}
                          disabled={sending}
                          className="glass-interactive flex-center" 
                          title="จับภาพหน้าจอ (Capture Screen)"
                          style={{ width: '36px', height: '36px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
                          <Monitor size={18} />
                       </button>
                       <input 
                          type="text" 
                          placeholder="Type your response or select a template..." 
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                          style={{ flex: 1, background: 'transparent', border: 'none', padding: '12px', color: 'var(--text)', fontSize: '14px', fontWeight: '500', outline: 'none' }}
                       />
                       <button 
                        onClick={handleSendMessage}
                        disabled={sending || !newMessage.trim()}
                        className="glass-interactive flex-center" 
                        style={{ width: '48px', height: '48px', borderRadius: '12px', border: 'none', background: (!newMessage.trim() && !sending) ? 'rgba(255,255,255,0.05)' : 'var(--primary)', color: (!newMessage.trim() && !sending) ? 'var(--text-muted)' : 'black', transition: 'all 0.3s' }}>
                          {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={20} />}
                       </button>
                    </div>
                  )}
              </div>
           </div>
        </div>

        {/* Sidebar Space (Right) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
           {/* 1. Customer Context */}
           <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                 <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'var(--secondary)', overflow: 'hidden' }}>
                    {ticket.customers?.avatar_url ? (
                       <img src={ticket.customers.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : <User size={24} />}
                 </div>
                 <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)' }}>{ticket.customers?.display_name || 'Customer'}</h4>
                    <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(0,242,254,0.1)', color: 'var(--primary)', borderRadius: '4px', fontWeight: '800' }}>CUSTOMER</span>
                 </div>
              </div>
              <button className="glass-interactive" style={{ width: '100%', padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', border: '1px solid var(--border)' }}>View Full Profile</button>
           </div>

           {/* 2. Issue Overview (Smaller) */}
           <div className="glass" style={{ padding: '20px' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Issue Details</label>
              <h5 style={{ fontSize: '14px', fontWeight: '800', marginBottom: '16px', lineHeight: '1.4' }}>{ticket.subject}</h5>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 <div>
                    <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Status</label>
                    <select 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value)}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700' }}
                    >
                      <option value="New">Pending</option>
                      <option value="Assigned">Assigned</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Escalated">Escalated</option>
                      <option value="Resolved">Resolved</option>
                    </select>
                 </div>
                  <div>
                     <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Priority</label>
                     <select 
                       value={priority} 
                       onChange={(e) => setPriority(e.target.value)}
                       style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'var(--secondary)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '700' }}
                     >
                       <option value="Low">Low</option>
                       <option value="Medium">Medium</option>
                       <option value="High">High</option>
                     </select>
                  </div>
                  <div>
                     <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Assign to Dept</label>
                     <select 
                       value={selectedDept} 
                       onChange={(e) => setSelectedDept(e.target.value)}
                       style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', background: 'rgba(0,242,254,0.05)', border: '1px solid rgba(0,242,254,0.2)', color: 'var(--primary)', fontWeight: '800' }}
                     >
                       <option value="">-- ไม่ระบุแผนก --</option>
                       {availableDepts.map((d, i) => (
                          <option key={i} value={d}>{d}</option>
                       ))}
                     </select>
                  </div>
              </div>
           </div>

           {/* 3. Timeline (Compressed) */}
           <div className="glass" style={{ padding: '20px' }}>
              <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', display: 'block' }}>Recent activity</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '1px solid var(--border)', marginLeft: '6px', paddingLeft: '16px' }}>
                 {logs.slice(0, 3).map((log, idx) => (
                    <div key={idx} style={{ position: 'relative' }}>
                       <div style={{ position: 'absolute', left: '-19.5px', top: '4px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                       <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleDateString()}</p>
                       <p style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)' }}>
                          {log.action_type === 'status_change' ? `Modified to ${log.to_status}` : log.action_type}
                       </p>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

       {/* Success Toast */}
       {showToast && (
         <div style={{
           position: 'fixed',
           top: '24px',
           right: '24px',
           background: 'var(--success)',
           color: 'black',
           padding: '16px 24px',
           borderRadius: '12px',
           fontWeight: '800',
           display: 'flex',
           alignItems: 'center',
           gap: '12px',
           boxShadow: '0 8px 32px rgba(0, 255, 127, 0.3)',
           zIndex: 9999,
           animation: 'slideInRight 0.3s ease-out'
         }}>
           <CheckCircle size={20} />
           {toastMsg}
         </div>
       )}

       {/* Resolution Modal */}
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
               animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
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
                  <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#fff', marginBottom: '8px' }}>ปิดงานการสนทนา</h3>
                  <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.6' }}>กรุณาสรุปผลการแก้ไขปัญหา เพื่อบันทึกเป็นประวัติและส่งการยืนยันให้ลูกค้าทราบครับ</p>
               </div>

               <div style={{ marginBottom: '32px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '12px', letterSpacing: '1px' }}>สรุปผลการแก้ไขงาน (Resolution Summary)</label>
                  <textarea 
                    value={resSummary}
                    onChange={(e) => setResSummary(e.target.value)}
                    placeholder="ระบุสิ่งที่แอดมินดำเนินการแก้ไข เช่น 'แก้ไขรหัสผ่านให้แล้ว', 'แจ้งยอดโอนสำเร็จ'..."
                    style={{
                       width: '100%',
                       height: '120px',
                       background: 'rgba(255,255,255,0.03)',
                       border: '1px solid rgba(255,255,255,0.1)',
                       borderRadius: '16px',
                       padding: '16px',
                       color: '#fff',
                       fontSize: '14px',
                       resize: 'none',
                       outline: 'none',
                       transition: 'all 0.3s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
                    onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
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
                    onClick={handleResolve}
                    disabled={updating || !resSummary.trim()}
                    style={{ 
                      flex: 1.5, 
                      padding: '16px', 
                      borderRadius: '14px', 
                      border: 'none', 
                      background: updating || !resSummary.trim() ? 'rgba(255,255,255,0.05)' : 'var(--success)', 
                      color: updating || !resSummary.trim() ? 'rgba(255,255,255,0.2)' : 'black', 
                      fontWeight: '900', 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      transition: 'all 0.3s'
                    }}
                  >
                     {updating ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> ยืนยันปิดงาน</>}
                  </button>
               </div>
            </div>
         </div>
       )}

        {/* Image Editor Modal */}
        {showEditor && editingImage && (
           <ImageEditorModal 
             imageUrl={editingImage}
             onClose={() => { setShowEditor(false); setEditingImage(null); }}
             onSave={handleEditorSave}
           />
        )}

       <style dangerouslySetInnerHTML={{ __html: `
         @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
         }
       `}} />
      <SummaryExportModal 
        isOpen={showExportModal} 
        onClose={() => setShowExportModal(false)} 
        onExport={handleExportSummary} 
        ticketNo={ticket?.ticket_no || ''} 
      />
    </div>
  );
}
