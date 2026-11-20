'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/lib/supabase';
import {
   ArrowLeft,
   Loader2,
   SendHorizontal,
   AlertCircle,
   Camera,
   CheckCircle
} from 'lucide-react';
import { compressImage } from '@/lib/utils/imageCompression';
import { createPortalTicketAction } from '@/app/actions/portalActions';
const ChatAttachmentModal = React.lazy(() => import('@/components/chat/ChatAttachmentModal'));

export default function CreateTicketPage() {
   const router = useRouter();
   const { profile, getIdToken, isReady } = useLiff();

   const [subject, setSubject] = useState('');
   const [description, setDescription] = useState('');
   const [subjectTypes, setSubjectTypes] = useState<string[]>([]);
   const [file, setFile] = useState<File | null>(null);
   const [isAttachOpen, setIsAttachOpen] = useState(false);

   const [submitting, setSubmitting] = useState(false);
   const [error, setError] = useState('');
   const [customerData, setCustomerData] = useState<any>(null);
   const [checking, setChecking] = useState(true);

    useEffect(() => {
      if (!profile?.userId) return;

      async function checkCustomer() {
         const [{ data: customer }, { data: subjectsRes }] = await Promise.all([
            supabase.from('customers').select('*, organizations(name, abbreviation)').eq('line_user_id', profile?.userId).maybeSingle(),
            supabase.from('ticket_subject_types').select('name').eq('is_active', true).order('name', { ascending: true })
         ]);

         if (!customer || !customer.organization_id) {
            router.push('/portal');
         } else {
            setCustomerData(customer);
            const subjects = subjectsRes?.map((s: any) => s.name) || [];
            setSubjectTypes(subjects.length > 0 ? subjects : ['ลบ', 'แก้ไขออเดอร์', 'แจ้ง error', 'เรื่องอื่นๆ']);
         }
         setChecking(false);
      }
      checkCustomer();
   }, [profile?.userId, router]);

   if (!isReady || checking) {
      return <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd' }}><Loader2 className="animate-spin" color="var(--portal-primary)" size={32} /></div>;
   }

   if (!customerData) {
      return null;
   }

   const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;

      if (!subject.trim()) {
         setError('กรุณาเลือกหัวข้อปัญหา');
         return;
      }
      if (!description.trim()) {
         setError('กรุณาระบุรายละเอียดเพิ่มเติม');
         return;
      }

      setSubmitting(true);
      setError('');

      try {
         let attachmentUrl: string | null = null;
         if (file) {
            let fileToUpload: File | Blob = file;
            let contentType = file.type;
            let ext = file.name.split('.').pop() || 'jpg';

            if (contentType.startsWith('image/')) {
               try {
                  const compressed = await compressImage(file, { quality: 0.8 });
                  fileToUpload = compressed;
                  contentType = 'image/webp';
                  ext = 'webp';
               } catch (err) {
                  console.error('Portal create compression failed:', err);
               }
            }

            const fileName = `portal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
            const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, fileToUpload, { contentType });
            if (!uploadError) {
               const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
               attachmentUrl = publicUrl;
            }
         }

         const { ticket: createdTicket } = await createPortalTicketAction({
            lineUserId: profile?.userId || null,
            idToken: getIdToken(),
            subject: subject.trim(),
            description: description.trim(),
            attachmentUrl,
         });

         router.replace(`/portal/tickets/${createdTicket.id}`);

      } catch (err: any) {
         setError(err.message);
         setSubmitting(false);
      }
   };

   return (
      <div className="portal-container">
         <div style={{ padding: '0 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeIn 0.5s ease-out' }}>
            <button
               onClick={() => router.push('/portal')}
               style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '12px',
                  border: '1px solid var(--portal-border)',
                  background: 'white',
                  color: '#1e293b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
               }}
            >
               <ArrowLeft size={18} />
            </button>
            <div style={{ textAlign: 'center', flex: 1, marginRight: '40px' }}>
               <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginBottom: '4px' }}>แจ้งเรื่องใหม่</h1>
               <p style={{ fontSize: '11px', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>New Support Ticket</p>
            </div>
         </div>

         <div className="portal-content" style={{ padding: '0 20px' }}>
            <div className="portal-glass" style={{ padding: '24px', background: 'white' }}>
               <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {error && (
                     <div style={{ padding: '16px', borderRadius: '16px', background: '#fef2f2', color: '#ef4444', fontSize: '13px', border: '1px solid #fee2e2', display: 'flex', gap: '12px' }}>
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <div>{error}</div>
                     </div>
                  )}

                  <div>
                     <label htmlFor="ticket-subject" style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>หัวข้อที่ต้องการแจ้ง</label>
                     <select
                        id="ticket-subject"
                        name="subject"
                        value={subject}
                        onChange={e => setSubject(e.target.value)}
                        style={{ background: '#f8fafc', border: '1px solid var(--portal-border)', borderRadius: '12px', padding: '14px 16px', color: '#1e293b', fontSize: '15px', width: '100%', outline: 'none', cursor: 'pointer' }}
                     >
                        <option value="">เลือกหัวข้อ...</option>
                        {subjectTypes.map((t, idx) => (
                           <option key={idx} value={t}>{t}</option>
                        ))}
                     </select>
                  </div>

                  <div>
                     <label htmlFor="ticket-description" style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>รายละเอียดเพิ่มเติม</label>
                     <textarea
                        id="ticket-description"
                        name="description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="แจ้งรายละเอียดของปัญหา…"
                        style={{ height: '140px', resize: 'none', padding: '14px 16px', background: '#f8fafc', border: '1px solid var(--portal-border)', borderRadius: '12px', color: '#1e293b', fontSize: '15px', width: '100%', outline: 'none', lineHeight: '1.6' }}
                     />
                  </div>

                  <div>
                     <button
                        type="button"
                        onClick={() => setIsAttachOpen(true)}
                        style={{
                           width: '100%',
                           padding: '16px',
                           borderRadius: '16px',
                           border: '2px dashed #e2e8f0',
                           background: file ? '#f0fdf4' : 'transparent',
                           color: file ? '#16a34a' : '#94a3b8',
                           display: 'flex',
                           alignItems: 'center',
                           justifyContent: 'center',
                           gap: '12px',
                           cursor: 'pointer'
                        }}
                     >
                        {file ? <CheckCircle size={20} /> : <Camera size={20} />}
                        <span style={{ fontSize: '14px', fontWeight: '800' }}>
                           {file ? `แนบหลักฐานแล้ว: ${file.name.slice(0, 10)}...` : 'ถ่ายรูป หรือ แนบไฟล์ประกอบ'}
                        </span>
                     </button>
                  </div>

                  <button
                     type="submit"
                     disabled={submitting}
                     className="portal-btn-primary"
                     style={{ width: '100%', padding: '16px', borderRadius: '16px', gap: '12px', opacity: submitting ? 0.7 : 1 }}
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

         <React.Suspense fallback={null}>
            <ChatAttachmentModal
               isOpen={isAttachOpen}
               onClose={() => setIsAttachOpen(false)}
               onConfirm={(f) => {
                  setFile(f);
                  setIsAttachOpen(false);
               }}
               onImageSelect={(dataUrl) => {
                  fetch(dataUrl)
                     .then(res => res.blob())
                     .then(blob => {
                        const f = new File([blob], `cam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                        setFile(f);
                        setIsAttachOpen(false);
                     });
               }}
            />
         </React.Suspense>
      </div>
   );
}
