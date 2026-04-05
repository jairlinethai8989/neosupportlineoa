'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Loader2, 
  Paperclip, 
  SendHorizontal, 
  Image as ImageIcon,
  AlertCircle 
} from 'lucide-react';

export default function CreateTicketPage() {
  const router = useRouter();
  const { profile, isReady } = useLiff();
  
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!profile?.userId) return;

    async function checkCustomer() {
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('line_user_id', profile?.userId)
        .maybeSingle();

      if (!data) {
         router.push('/portal');
      } else {
         setCustomerData(data);
      }
      setChecking(false);
    }
    checkCustomer();
  }, [profile, router]);

  if (!isReady || checking) {
     return <div className="flex-center" style={{ height: '100vh', background: '#0a0e14' }}><Loader2 className="animate-spin" color="var(--primary)" size={32} /></div>;
  }

  if (!customerData) {
     return null; 
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!subject.trim()) {
         setError('กรุณาระบุหัวข้อปัญหา');
         return;
      }
      
      setSubmitting(true);
      setError('');

      try {
         // 1. Generate Ticket Number
         const ticketNo = `TIC-${Math.floor(10000 + Math.random() * 90000)}`;

         // 2. Insert Ticket
         const { data: newTicket, error: ticketError } = await supabase.from('tickets').insert([{
            ticket_no: ticketNo,
            customer_id: customerData.id,
            subject: subject,
            description: description || subject,
            status: 'New',
            priority: 'Medium',
            created_at: new Date().toISOString()
         }]).select().single();

         if (ticketError) throw new Error(`Ticket Creation Failed: ${ticketError.message}`);

         // 3. Upsert Conversation for Inbox (Robust way)
         const { data: existingConv } = await supabase
            .from('conversations')
            .select('id')
            .eq('customer_id', customerData.id)
            .maybeSingle();

         let conversationId;
         if (existingConv) {
            conversationId = existingConv.id;
            const { error: updateError } = await supabase.from('conversations').update({
                status: 'active',
                current_ticket_id: newTicket.id,
                last_message_at: new Date().toISOString()
            }).eq('id', conversationId);
            
            if (updateError) console.error('Conv Update Error:', updateError);
         } else {
            const { data: newConv, error: createError } = await supabase.from('conversations').insert([{
                customer_id: customerData.id,
                status: 'active',
                current_ticket_id: newTicket.id,
                last_message_at: new Date().toISOString()
            }]).select().single();
            
            if (createError) {
               console.error('Conv Create Error:', createError);
               // If creation failed, we proceed but UI might be empty. 
               // We don't block the whole flow because the ticket IS created.
            } else {
               conversationId = newConv.id;
            }
         }

         // 4. Initial Message (If conversationId exists)
         if (conversationId) {
            if (file) {
               const fileExt = file.name.split('.').pop() || 'jpg';
               const fileName = `${newTicket.id}_${Date.now()}.${fileExt}`;
               const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
               if (!uploadError) {
                  const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
                  await supabase.from('messages').insert([{
                     ticket_id: newTicket.id,
                     conversation_id: conversationId,
                     sender_type: 'customer',
                     message_type: 'image',
                     content: publicUrl
                  }]);
               }
            } else if (description) {
               await supabase.from('messages').insert([{
                  ticket_id: newTicket.id,
                  conversation_id: conversationId,
                  sender_type: 'customer',
                  message_type: 'text',
                  content: description
               }]);
            }
         }

         // 5. Notify Group
         try {
            const { sendLineGroupNotification } = await import('@/lib/utils/lineNotifications');
            await sendLineGroupNotification(`🆕 ตั๋วใหม่จาก Portal: ${subject}\nลูกค้า: ${customerData.display_name}`);
         } catch { }

         router.push('/portal');

      } catch (err: any) {
         setError(err.message);
         setSubmitting(false);
      }
  };

  return (
    <div className="portal-container" style={{ 
      minHeight: '100vh', 
      background: 'radial-gradient(circle at top right, #1a2332, #0a0e14)',
      paddingBottom: '40px' 
    }}>
      {/* Premium Header */}
      <div className="portal-header" style={{ 
        padding: '24px 20px', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: 'rgba(10, 14, 20, 0.6)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
         <button 
           onClick={() => router.back()} 
           className="glass-interactive flex-center" 
           style={{ width: '40px', height: '40px', borderRadius: '12px', color: 'var(--text-main)', border: '1px solid rgba(255,255,255,0.1)' }}
         >
           <ArrowLeft size={18} />
         </button>
         
         <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '0.02em' }}>แจ้งเรื่องใหม่</h1>
            <p style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>New Support Ticket</p>
         </div>

         <div style={{ width: '40px' }} />
      </div>

      <div className="portal-content" style={{ padding: '24px 20px' }}>
         <div className="glass" style={{ 
            padding: '28px 24px', 
            borderRadius: '28px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.03)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            animation: 'fadeInUp 0.6s ease-out'
         }}>
            <form onSubmit={handleSubmit}>
               {error && (
                  <div style={{ 
                    marginBottom: '24px', 
                    padding: '16px', 
                    borderRadius: '16px', 
                    background: 'rgba(234, 84, 85, 0.1)', 
                    color: '#ea5455', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    border: '1px solid rgba(234, 84, 85, 0.2)',
                    display: 'flex',
                    gap: '12px'
                  }}>
                     <AlertCircle size={18} style={{ flexShrink: 0 }} /> 
                     <div>
                        <strong>Ticket Creation Error:</strong><br/>
                        {error.includes('customer_id') 
                          ? 'ฐานข้อมูลตาราง Tickets ยังไม่มีฟิลด์ลูกค้า (customer_id) หรือต้องรีเฟรช Schema Cache' 
                          : error}
                     </div>
                  </div>
               )}

               <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="ticket-subject" style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>หัวข้อที่ต้องการแจ้ง</label>
                  <input 
                    id="ticket-subject"
                    name="subject"
                    type="text" 
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="เช่น เข้าใช้งานไม่ได้, ปัญหาอุปกรณ์…"
                    className="portal-input"
                    style={{ 
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '14px',
                      padding: '16px 18px',
                      color: 'var(--text-main)',
                      fontSize: '15px',
                      width: '100%',
                      outline: 'none',
                      transition: 'all 0.3s'
                    }}
                    autoComplete="off"
                  />
               </div>

               <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="ticket-description" style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: 'var(--primary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.05em' }}>รายละเอียดเพิ่มเติม</label>
                  <textarea 
                    id="ticket-description"
                    name="description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="เล่ารายละเอียดของปัญหาให้เราฟัง…"
                    style={{ 
                      height: '140px', 
                      resize: 'none', 
                      padding: '16px 18px',
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '14px',
                      color: 'var(--text-main)',
                      fontSize: '15px',
                      width: '100%',
                      outline: 'none',
                      lineHeight: '1.6'
                    }}
                  />
               </div>

               <div style={{ marginBottom: '32px' }}>
                  <input 
                    type="file" 
                    id="ticket-file"
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  {!file ? (
                    <button 
                      type="button" 
                      onClick={() => fileInputRef.current?.click()} 
                      className="glass-interactive flex-center" 
                      style={{ 
                        width: '100%', 
                        gap: '12px', 
                        border: '2px dashed rgba(255,255,255,0.1)', 
                        borderRadius: '16px', 
                        padding: '20px', 
                        color: 'rgba(255,255,255,0.5)',
                        transition: 'all 0.3s'
                      }}
                    >
                       <ImageIcon size={20} />
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>เพิ่มรูปภาพหรือไฟล์ประกอบ</span>
                    </button>
                  ) : (
                    <div className="flex-between glass" style={{ 
                      padding: '14px 18px', 
                      borderRadius: '16px', 
                      border: '1px solid var(--primary)',
                      background: 'rgba(0, 242, 254, 0.05)' 
                    }}>
                       <div className="flex-center" style={{ gap: '12px', overflow: 'hidden' }}>
                          <Paperclip size={18} color="var(--primary)" />
                          <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                       </div>
                       <button type="button" onClick={() => setFile(null)} style={{ color: '#ea5455', border: 'none', background: 'none', fontSize: '12px', fontWeight: '900', marginLeft: '12px', flexShrink: 0 }}>ลบออก</button>
                    </div>
                  )}
               </div>

               <button 
                 type="submit" 
                 disabled={submitting} 
                 className="portal-btn-primary" 
                 style={{ 
                   width: '100%', 
                   padding: '18px',
                   borderRadius: '18px',
                   gap: '12px',
                   boxShadow: '0 10px 30px rgba(0, 242, 254, 0.2)',
                   background: 'linear-gradient(135deg, var(--primary), #4facfe)',
                   opacity: submitting ? 0.7 : 1
                 }}
               >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <>
                       <SendHorizontal size={20} />
                       <span style={{ fontSize: '17px', fontWeight: '900', letterSpacing: '0.02em' }}>ส่งใบแจ้งงาน</span>
                    </>
                  )}
               </button>
            </form>
         </div>

         <div style={{ marginTop: '24px', textAlign: 'center', opacity: 0.6 }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>&copy; 2026 NEO Support. Powered by Omni AI.</p>
         </div>
      </div>
    </div>
  );
}
