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
     return <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd' }}><Loader2 className="animate-spin" color="var(--portal-primary)" size={32} /></div>;
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

         // 2. Insert Ticket (Simplified to respect DB triggers)
         const ticketPayload: any = {
            ticket_no: ticketNo,
            customer_id: customerData.id,
            hospital_id: customerData.hospital_id,
            subject: subject,
            description: description || subject,
            status: 'New', // Standardized Case for counters
            priority: 'Medium',
            created_at: new Date().toISOString()
         };

         console.log('Sending payload:', ticketPayload);
         const { data: newTicket, error: ticketError } = await supabase.from('tickets').insert([ticketPayload]).select();

         if (ticketError) {
            console.error('Insert Error Detail:', ticketError);
            throw new Error(`Ticket Creation Failed: ${ticketError.message}`);
         }
         
         const createdTicket = newTicket?.[0];
         if (!createdTicket) throw new Error('Ticket was not created (No returned data)');

         // 3. Create Fresh Conversation for THIS Ticket (Don't combine with old ones)
         // First, close any "active" ones for this customer to avoid multiple active chats for the same person
         await supabase.from('conversations')
           .update({ status: 'closed' })
           .eq('customer_id', customerData.id)
           .eq('status', 'active');

         // Create new one specifically for this ticket
         const { data: newConv, error: createError } = await supabase.from('conversations').insert([{
             customer_id: customerData.id,
             status: 'active',
             current_ticket_id: createdTicket.id,
             last_message_at: new Date().toISOString()
         }]).select().single();
         
         let conversationId;
         if (createError) {
            console.error('Conv Create Error:', createError);
            // Fallback: If we can't create, we can't link messages correctly, but ticket is already saved.
         } else {
            conversationId = newConv?.id;
         }

         // 4. Initial Message (If conversationId exists)
         if (conversationId) {
            if (file) {
               const fileExt = file.name.split('.').pop() || 'jpg';
               const fileName = `${createdTicket.id}_${Date.now()}.${fileExt}`;
               const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
               if (!uploadError) {
                  const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
                  await supabase.from('messages').insert([{
                     ticket_id: createdTicket.id,
                     conversation_id: conversationId,
                     sender_type: 'customer',
                   customer_id: customerData.id, // NEW STRONG RELATION
                     customer_id: customerData.id, // NEW STRONG RELATION
                     message_type: 'image',
                     content: publicUrl
                  }]);
               }
            } else if (description) {
               await supabase.from('messages').insert([{
                  ticket_id: createdTicket.id,
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

         router.push(`/portal/tickets/${createdTicket.id}`);

      } catch (err: any) {
         setError(err.message);
         setSubmitting(false);
      }
  };

  return (
    <div className="portal-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* minimal header handled by layout, but we need the sub-header for this page */}
      <div style={{ padding: '0 20px 24px', textAlign: 'center' }}>
         <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', marginBottom: '4px' }}>แจ้งเรื่องใหม่</h1>
         <p style={{ fontSize: '12px', color: 'var(--portal-text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Support Ticket</p>
      </div>

      <div className="portal-content" style={{ padding: '0 20px' }}>
         <div className="portal-glass" style={{ 
            padding: '24px', 
            background: 'white',
            boxShadow: '0 10px 30px rgba(0,0,0,0.02)',
            border: '1px solid var(--portal-border)'
         }}>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               {error && (
                  <div style={{ 
                    padding: '16px', 
                    borderRadius: '16px', 
                    background: '#fef2f2', 
                    color: '#ef4444', 
                    fontSize: '13px', 
                    lineHeight: '1.6', 
                    border: '1px solid #fee2e2',
                    display: 'flex',
                    gap: '12px'
                  }}>
                     <AlertCircle size={18} style={{ flexShrink: 0 }} /> 
                     <div>{error}</div>
                  </div>
               )}

               <div>
                  <label htmlFor="ticket-subject" style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em' }}>หัวข้อที่ต้องการแจ้ง</label>
                  <input 
                    id="ticket-subject"
                    name="subject"
                    type="text" 
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="เช่น เข้าใช้งานไม่ได้, ปัญหาอุปกรณ์…"
                    style={{ 
                      background: '#f8fafc', 
                      border: '1px solid var(--portal-border)',
                      borderRadius: '12px',
                      padding: '14px 16px',
                      color: '#1e293b',
                      fontSize: '15px',
                      width: '100%',
                      outline: 'none',
                      transition: 'all 0.2s'
                    }}
                    autoComplete="off"
                  />
               </div>

               <div>
                  <label htmlFor="ticket-description" style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.08em' }}>รายละเอียดเพิ่มเติม</label>
                  <textarea 
                    id="ticket-description"
                    name="description"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="เล่ารายละเอียดของปัญหาให้เราฟัง…"
                    style={{ 
                      height: '140px', 
                      resize: 'none', 
                      padding: '14px 16px',
                      background: '#f8fafc', 
                      border: '1px solid var(--portal-border)',
                      borderRadius: '12px',
                      color: '#1e293b',
                      fontSize: '15px',
                      width: '100%',
                      outline: 'none',
                      lineHeight: '1.6'
                    }}
                  />
               </div>

               <div>
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
                      className="flex-center" 
                      style={{ 
                        width: '100%', 
                        gap: '12px', 
                        border: '2px dashed #e2e8f0', 
                        borderRadius: '16px', 
                        padding: '16px', 
                        color: '#94a3b8',
                        background: 'transparent',
                        transition: 'all 0.3s'
                      }}
                    >
                       <ImageIcon size={20} />
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>เพิ่มรูปภาพหรือไฟล์ประกอบ</span>
                    </button>
                  ) : (
                    <div className="flex-between portal-glass" style={{ 
                      padding: '12px 16px', 
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd' 
                    }}>
                       <div className="flex-center" style={{ gap: '10px', overflow: 'hidden' }}>
                          <Paperclip size={18} color="#0284c7" />
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#0369a1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                       </div>
                       <button type="button" onClick={() => setFile(null)} style={{ color: '#ef4444', border: 'none', background: 'none', fontSize: '12px', fontWeight: '900', marginLeft: '12px', cursor: 'pointer' }}>ลบออก</button>
                    </div>
                  )}
               </div>

               <button 
                 type="submit" 
                 disabled={submitting} 
                 className="portal-btn-primary" 
                 style={{ 
                   width: '100%', 
                   padding: '16px',
                   borderRadius: '16px',
                   gap: '12px',
                   opacity: submitting ? 0.7 : 1
                 }}
               >
                  {submitting ? (
                    <Loader2 className="animate-spin" size={22} />
                  ) : (
                    <>
                       <SendHorizontal size={20} />
                       <span style={{ fontSize: '17px', fontWeight: '800' }}>ส่งใบแจ้งงาน</span>
                    </>
                  )}
               </button>
            </form>
         </div>
      </div>
    </div>
  );
}
