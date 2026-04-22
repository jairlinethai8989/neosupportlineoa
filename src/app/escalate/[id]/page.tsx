'use client';
import React, { useState, useEffect } from 'react';
import { verifyEscalationPin, claimEscalatedTicket, updateEscalatedTicketStatus } from '@/app/actions/escalationActions';
import { Lock, Unlock, AlertCircle, CheckCircle, FileText, Send, Loader2, Camera, Trash2, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export default function EscalationPortalPage() {
  const params = useParams();
  const ticketId = params.id as string;
  
  // App States
  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [ticketData, setTicketData] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form State
  const [newStatus, setNewStatus] = useState('Resolved');
  const [notes, setNotes] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  // 1. PIN UNLOCK
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const data = await verifyEscalationPin(ticketId, pin);
      setTicketData(data);
      setNewStatus(data.status || 'Resolved');
      setIsUnlocked(true);
    } catch (err: any) {
      setError(err.message || 'รหัสผ่านไม่ถูกต้อง หรือคำขอนี้หมดอายุแล้ว');
    } finally {
      setLoading(false);
    }
  };

  // 2. CLAIM JOB
  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiverName.trim()) {
      setError('กรุณาระบุชื่อผู้รับเรื่อง');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await claimEscalatedTicket(ticketId, pin, receiverName);
      setIsClaimed(true);
      setSuccess('รับเรื่องสำเร็จ! กรุณาตรวจสอบรายละเอียดและดำเนินการ');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการรับเรื่อง');
    } finally {
      setLoading(false);
    }
  };

  // 3. FILE UPLOAD
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop() || 'jpg';
        const fileName = `${ticketId}_ext_${Date.now()}_${i}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('chat_media')
          .getPublicUrl(fileName);

        newUrls.push(publicUrl);
      }
      setAttachments(prev => [...prev, ...newUrls]);
    } catch (err: any) {
      setError('อัปโหลดไฟล์ล้มเหลว: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = (url: string) => {
    setAttachments(prev => prev.filter(u => u !== url));
  };

  // 4. SUBMIT WORK
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStatus) return;
    
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      await updateEscalatedTicketStatus(ticketId, pin, newStatus, notes, receiverName, attachments);
      setSuccess('บันทึกข้อมูลและส่งกลับหาแอดมินสำเร็จ!');
      setNotes(''); 
      setAttachments([]);
      setError('');
    } catch (err: any) {
      console.error('Update failed:', err);
      const msg = err.message || 'เกิดข้อผิดพลาดในการอัปเดต';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERING ---

  // A. LOCKED STATE (PIN ONLY)
  if (!isUnlocked) {
    return (
      <div className="glass" style={{ marginTop: '10vh', padding: '32px', borderRadius: '24px', textAlign: 'center', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(8, 145, 178, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', color: 'var(--primary)' }}>
          <Lock size={32} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>เข้าสู่ระบบ (แผนกรับช่วงต่อ)</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>กรุณากรอกรหัส PIN 4 หลัก เพื่อตรวจสอบรายละเอียดใบงาน</p>
        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><AlertCircle size={16} /> {error}</div>}
        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} placeholder="รหัส PIN 4 หลัก" style={{ padding: '16px', borderRadius: '12px', border: '2px solid #e2e8f0', textAlign: 'center', fontSize: '24px', letterSpacing: '8px', fontWeight: 800, outline: 'none' }} disabled={loading} />
          <button disabled={loading || pin.length < 4} type="submit" style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> ปลดล็อคใบงาน</>}
          </button>
        </form>
      </div>
    );
  }

  // B. UNLOCKED BUT NOT CLAIMED (ENTER NAME TO CLAIM)
  if (!isClaimed) {
     return (
        <div className="glass" style={{ padding: '32px', borderRadius: '24px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)' }}>
           <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>📥 รับเรื่องประสานงาน</h2>
           <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>
              ระบุชื่อเพื่อ "ยืนยันการรับเรื่อง" และเข้าดูรายละเอียดงาน<br/>
              <b>#{ticketData?.ticket_no}</b>
           </p>

           <form onSubmit={handleClaim} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                 <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>ชื่อผู้รับเรื่อง (Your Name)</label>
                 <input 
                    type="text" 
                    value={receiverName} 
                    onChange={(e) => setReceiverName(e.target.value)} 
                    placeholder="ระบุชื่อจริงหรือชื่อเล่นของคุณ..." 
                    style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '15px', fontWeight: 700, outline: 'none' }} 
                 />
              </div>

              {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', fontSize: '13px' }}>{error}</div>}

              <button 
                 disabled={loading || !receiverName.trim()} 
                 type="submit" 
                 style={{ 
                    background: '#0891b2', 
                    color: 'white', 
                    border: 'none', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    fontWeight: 800, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: '8px',
                    boxShadow: '0 4px 12px rgba(8, 145, 178, 0.2)'
                 }}
              >
                 {loading ? <Loader2 className="animate-spin" size={18} /> : <><ClipboardCheck size={18} /> กดเพื่อรับเรื่อง (Claim Job)</>}
              </button>
           </form>
        </div>
     )
  }

  // C. FULL PORTAL (CLAIMED)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Ticket Info Card */}
      <div className="glass" style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Ticket NO.</p>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>#{ticketData?.ticket_no}</h2>
          </div>
          <span style={{ background: 'var(--primary-transparent)', color: 'var(--primary)', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 800 }}>
             Escalated
          </span>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Subject / หัวข้อ</p>
          <p style={{ fontSize: '15px', fontWeight: 700, lineHeight: 1.5 }}>{ticketData?.subject}</p>
        </div>

        <div style={{ padding: '16px', background: '#f0f9ff', borderRadius: '12px', border: '1px solid #bae6fd' }}>
          <p style={{ fontSize: '11px', color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>📝 คำสั่งงานจากแอดมิน</p>
          <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#0c4a6e' }}>
             {ticketData?.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
          </p>
        </div>
      </div>

      {/* Action Card */}
      <div className="glass" style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--primary)" /> รายงานการประสานงาน
        </h3>
        
        {success && <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} /> {success}</div>}
        {error && <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '12px', marginBottom: '20px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /> <span>{String(error)}</span></div>}

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>สถานะผลงาน (Final Status)</label>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', fontWeight: 700, outline: 'none' }}>
                <option value="Resolved">ซ่อมเสร็จสิ้น (Resolved)</option>
                <option value="In Progress">ยังติดปัญหา (In Progress)</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>ชื่อผู้แจ้งงานกลับ</label>
              <input type="text" value={receiverName} disabled style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f1f5f9', fontSize: '14px', fontWeight: 700, outline: 'none', color: '#94a3b8' }} />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>บันทึกผลการดำเนินงาน (Work Log)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="พิมพ์รายละเอียดสิ่งที่แก้ไข หรือสาเหตุ...” style={{ width: '100%', height: '80px', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', resize: 'none', outline: 'none' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#64748b', marginBottom: '8px' }}>แนบรูปภาพหรือไฟล์หลักฐาน</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {attachments.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '12px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                  <img src={url} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => removeAttachment(url)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(239, 68, 68, 0.8)', border: 'none', borderRadius: '4px', padding: '2px', cursor: 'pointer', color: 'white' }}><Trash2 size={12} /></button>
                </div>
              ))}
              <label style={{ width: '80px', height: '80px', borderRadius: '12px', border: '2px dashed #cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: uploading ? 'not-allowed' : 'pointer', background: '#f8fafc', gap: '4px' }}>
                {uploading ? <Loader2 className="animate-spin" size={20} color="#94a3b8" /> : <><Camera size={20} color="#94a3b8" /><span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>แนบรูป</span></>}
                <input type="file" multiple accept="image/*" hidden onChange={handleFileUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{ background: '#10b981', color: 'white', border: 'none', padding: '16px', borderRadius: '12px', fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.25)', transition: 'all 0.3s' }}>
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Send size={18} /> ส่งรายงานกลับแผนกต้นเรื่อง</>}
          </button>
        </form>
      </div>

    </div>
  );
}
