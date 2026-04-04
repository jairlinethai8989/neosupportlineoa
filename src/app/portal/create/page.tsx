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
    <div className="portal-container">
      <div className="portal-header">
         <button onClick={() => router.back()} className="back-btn"><ArrowLeft size={20} /></button>
         <h1 className="portal-title">แจ้งเรื่องใหม่</h1>
         <div style={{ width: '20px' }} />
      </div>

      <div className="portal-content">
         <div className="glass portal-card" style={{ padding: '24px' }}>
            <form onSubmit={handleSubmit}>
               {error && (
                  <div className="error-alert" style={{ marginBottom: '20px', display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', padding: '12px', borderRadius: '12px', fontSize: '14px' }}>
                     <AlertCircle size={18} /> {error}
                  </div>
               )}

               <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="ticket-subject" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>หัวข้อที่ต้องการแจ้ง</label>
                  <input 
                    id="ticket-subject"
                    name="subject"
                    type="text" 
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="เช่น เข้าใช้งานไม่ได้, ปัญหาการเงิน…"
                    className="portal-input"
                    autoComplete="off"
                  />
               </div>

               <div className="input-group" style={{ marginBottom: '20px' }}>
                  <label htmlFor="ticket-description" style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>รายละเอียดเพิ่มเติม</label>
                  <textarea 
                    id="ticket-description"
                    name="description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="เล่ารายละเอียดของปัญหาให้เราฟัง…"
                    className="portal-input"
                    style={{ height: '120px', resize: 'none', padding: '12px' }}
                  />
               </div>

               <div className="attachment-zone" style={{ marginBottom: '32px' }}>
                  <input 
                    type="file" 
                    id="ticket-file"
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    style={{ display: 'none' }}
                    accept="image/*,.pdf,.doc,.docx"
                  />
                  {!file ? (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="glass-interactive flex-center" style={{ width: '100%', gap: '12px', border: '2px dashed var(--border)', borderRadius: '16px', padding: '16px', color: 'var(--text-muted)' }}>
                       <ImageIcon size={20} aria-hidden="true" />
                       <span style={{ fontSize: '14px', fontWeight: '600' }}>แนบรูปภาพหรือไฟล์</span>
                    </button>
                  ) : (
                    <div className="flex-between glass" style={{ padding: '12px 16px', borderRadius: '16px', border: '1px solid var(--primary)' }}>
                       <div className="flex-center" style={{ gap: '12px' }}>
                          <Paperclip size={18} color="var(--primary)" aria-hidden="true" />
                          <span style={{ fontSize: '14px', fontWeight: '600' }}>{file.name}</span>
                       </div>
                       <button type="button" onClick={() => setFile(null)} style={{ color: '#ea5455', border: 'none', background: 'none', fontSize: '13px', fontWeight: '600' }}>ลบออก</button>
                    </div>
                  )}
               </div>

               <button type="submit" disabled={submitting} className="portal-btn-primary" style={{ width: '100%', gap: '12px' }}>
                  {submitting ? (
                    <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                  ) : (
                    <>
                       <SendHorizontal size={20} aria-hidden="true" />
                       <span style={{ fontSize: '16px', fontWeight: '800' }}>ส่งแจ้งเรื่อง</span>
                    </>
                  )}
               </button>
            </form>
         </div>
      </div>
    </div>
  );
}
