'use client';
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
        .eq('line_user_id', profile.userId)
        .maybeSingle();

      if (!data) {
         // Must register first
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
     return null; // redirecting
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files.length > 0) {
        setFile(e.target.files[0]);
     }
  };

  const handleSubmit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!subject.trim()) {
        setError('กรุณาระบุหัวข้อปัญหา (Topic)');
        return;
     }
     
     setSubmitting(true);
     setError('');

     try {
        // 1. Generate Ticket Number (e.g. TIC-12345)
        const ticketNo = `TIC-${Math.floor(10000 + Math.random() * 90000)}`;

        // 2. Insert Ticket
        const { data: newTicket, error: ticketError } = await supabase.from('tickets').insert([{
           ticket_no: ticketNo,
           customer_id: customerData.id,
           subject: subject,
           description: description || subject,
           status: 'Pending',
           priority: 'Medium',
           created_at: new Date().toISOString()
        }]).select().single();

        if (ticketError) throw ticketError;

        // 3. Insert initial log
        await supabase.from('ticket_logs').insert([{
           ticket_id: newTicket.id,
           action_type: 'creation',
           note: 'Ticket created via Customer Portal (LIFF)',
           to_status: 'Pending'
        }]);

        // 4. Handle Attachment if exists
        if (file) {
           const fileExt = file.name.split('.').pop() || 'jpg';
           const fileName = `${newTicket.id}_${Date.now()}.${fileExt}`;
           const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
           
           if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
              const messageType = file.type.startsWith('image/') ? 'image' : 'file';
              
              await supabase.from('messages').insert([{
                 ticket_id: newTicket.id,
                 sender_type: 'customer',
                 message_type: messageType,
                 content: publicUrl,
                 created_at: new Date().toISOString()
              }]);
           }
        }

        // Send text description as first message if no file but description exists
        if (!file && description) {
              await supabase.from('messages').insert([{
                 ticket_id: newTicket.id,
                 sender_type: 'customer',
                 message_type: 'text',
                 content: description,
                 created_at: new Date().toISOString()
              }]);
        }

        // P2: Redirect to Ticket Detail
        router.push(`/portal/tickets/${newTicket.id}`);

     } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการสร้างตั๋วงาน');
        setSubmitting(false);
     }
  };

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', padding: '16px' }}>
       {/* Navbar */}
       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <button onClick={() => router.push('/portal')} className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'white' }}>
             <ArrowLeft size={20} />
          </button>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '800' }}>แจ้งปัญหาใหม่</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Create New Support Ticket</p>
          </div>
       </div>

       {error && (
          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
             <AlertCircle size={20} />
             <span style={{ fontSize: '13px', fontWeight: '600' }}>{error}</span>
          </div>
       )}

       <form onSubmit={handleSubmit} className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div>
             <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>หัวข้อปัญหา (Topic) <span style={{ color: 'var(--danger)' }}>*</span></label>
             <input 
                type="text" 
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="เช่น ไม่สามารถเข้าระบบได้, ต้องการแก้ไขข้อมูล..."
                className="glass-input"
                disabled={submitting}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontSize: '14px' }}
             />
          </div>

          <div>
             <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>รายละเอียดเพิ่มเติม (Description)</label>
             <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="ระบุรายละเอียดอาการหรือข้อมูลเพิ่มเติมที่นี่..."
                className="glass-input"
                disabled={submitting}
                rows={4}
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', fontSize: '14px', resize: 'none' }}
             />
          </div>

          <div>
             <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', marginBottom: '8px', color: 'var(--text-main)' }}>ภาพประกอบ/ไฟล์แนบ (Attachment)</label>
             
             <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
                disabled={submitting}
                id="file-upload"
             />
             <label 
                htmlFor="file-upload"
                className="glass-interactive"
                style={{ 
                   display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                   padding: '20px', borderRadius: '12px', border: '2px dashed var(--border)', 
                   background: file ? 'rgba(0, 242, 254, 0.05)' : 'rgba(255,255,255,0.02)', 
                   color: file ? 'var(--primary)' : 'var(--text-muted)',
                   cursor: 'pointer',
                   fontWeight: '700', fontSize: '13px',
                   transition: 'all 0.2s ease'
                }}
             >
                {file ? (
                   <>
                      <ImageIcon size={20} />
                      {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                   </>
                ) : (
                   <>
                      <Paperclip size={20} />
                      คลิกเพื่อแนบไฟล์ (ขนาดไม่เกิน 10MB)
                   </>
                )}
             </label>
             {file && (
                <p 
                   onClick={(e) => { e.preventDefault(); setFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                   style={{ textAlign: 'center', color: 'var(--danger)', fontSize: '12px', marginTop: '12px', cursor: 'pointer', fontWeight: 'bold' }}>
                   ลบไฟล์แนบ
                </p>
             )}
          </div>

          <div style={{ marginTop: '12px' }}>
             <button 
                type="submit"
                disabled={submitting || !subject.trim()}
                className="glass-interactive flex-center"
                style={{
                   width: '100%', padding: '16px', borderRadius: '12px', border: 'none',
                   background: (!submitting && subject.trim()) ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                   color: (!submitting && subject.trim()) ? 'black' : 'var(--text-muted)',
                   fontWeight: '900', fontSize: '15px', gap: '8px',
                   transition: 'all 0.3s ease'
                }}
             >
                {submitting ? (
                   <><Loader2 size={20} className="animate-spin" /> กำลังส่งข้อมูล...</>
                ) : (
                   <><SendHorizontal size={20} /> ส่งตั๋วแจ้งปัญหา</>
                )}
             </button>
             <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '16px' }}>
                เมื่อกดส่งแล้ว ทีมงานจะได้รับเรื่องทันทีและจะแสดงในหน้า My Tickets
             </p>
          </div>
       </form>
    </div>
  );
}
