'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  Ticket, 
  Search, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  Building,
  ArrowLeft,
  Paperclip,
  Image as ImageIcon,
  X,
  File,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { getStaffMessage, translateTicketPriority } from '@/lib/i18n/staff';
import { calculateSlaDeadline } from '@/lib/utils/slaUtils';
import { compressImage } from '@/lib/utils/imageCompression';

export default function CreateInternalTicketPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Form State
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('Medium');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [subjectTypes, setSubjectTypes] = useState<string[]>([]);
  
  // UI State
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [staffProfile, setStaffProfile] = useState<any>(null);

  useEffect(() => {
    async function init() {
      // 1. Get Current Staff Profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setStaffProfile(p);
      }

      // 2. Fetch Hospitals and Company Settings
      const [{ data: hData }, { data: settings }] = await Promise.all([
        supabase.from('hospitals').select('*').eq('is_active', true).order('name', { ascending: true }),
        supabase.from('company_settings').select('subject_types').maybeSingle()
      ]);
      
      setHospitals(hData || []);
      setSubjectTypes(settings?.subject_types || ['ลบ', 'แก้ไขออเดอร์', 'แจ้ง error', 'เรื่องอื่นๆ']);
      setLoadingHospitals(false);
    }
    init();
  }, []);

  const { locale, t } = useStaffLocale();

  const PRIORITY_COLORS: Record<string, string> = {
    Low: '#00cfe8',
    Medium: '#ff9f43',
    High: '#ea5455',
    Critical: '#8b5cf6',
  };

  const filteredHospitals = hospitals.filter(h => 
    h.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    h.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newAttachments = Array.from(files).map(file => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      }));
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHospitalId) {
      setError('กรุณาเลือกโรงพยาบาล (Please select a hospital)');
      return;
    }
    if (!subject.trim()) {
      setError('กรุณาระบุหัวข้อเรื่อง (Please enter a subject)');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. Upload Attachments if any
      const uploadedUrls: string[] = [];
      for (const att of attachments) {
        let fileToUpload = att.file;
        let contentType = att.file.type;
        let ext = att.file.name.split('.').pop();

        // Compress if image
        if (contentType.startsWith('image/')) {
          try {
            const compressed = await compressImage(att.file, { quality: 1.0 });
            fileToUpload = compressed;
            contentType = 'image/webp';
            ext = 'webp';
          } catch (err) {
            console.error('Ticket attachment compression failed:', err);
          }
        }

        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(fileName, fileToUpload, { contentType });
        
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
          uploadedUrls.push(publicUrl);
        }
      }

      // 2. Find or Create Customer record for this staff member
      let staffCustomerId = null;
      if (staffProfile?.id) {
        const staffCustomerKey = `staff_${staffProfile.id}`;
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('line_user_id', staffCustomerKey)
          .maybeSingle();

        if (existingCustomer) {
          staffCustomerId = existingCustomer.id;
        } else {
          const { data: newCustomer } = await supabase
            .from('customers')
            .insert([{
              line_user_id: staffCustomerKey,
              display_name: `${staffProfile.full_name || 'Staff'} (Internal)`,
              full_name: staffProfile.full_name || 'Internal Staff',
              hospital_id: selectedHospitalId, // Assign to the selected hospital
            }])
            .select('id')
            .single();
          
          if (newCustomer) {
            staffCustomerId = newCustomer.id;
          }
        }
      }

      // 3. Generate a temporary Ticket No (if DB trigger is not yet active)
      // TIC-YYYYMMDD-RAND
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const tempNo = `TIC-${datePart}-${Math.floor(1000 + Math.random() * 9000)}`;

      // 4. Calculate SLA Deadline
      let slaDueAt = null;
      try {
        const { data: slaRule } = await supabase
          .from('sla_rules')
          .select('response_time_minutes, resolution_time_minutes')
          .eq('priority', priority)
          .maybeSingle();
        
        if (slaRule) {
          // Use resolution_time_minutes as the primary deadline for the dashboard
          const duration = slaRule.resolution_time_minutes || slaRule.response_time_minutes || 60;
          slaDueAt = calculateSlaDeadline(new Date(), duration).toISOString();
        }
      } catch (e) {
        console.warn('SLA Calculation skipped:', e);
      }

      // 5. Create Internal Ticket
      const ticketPayload = {
        ticket_no: tempNo, 
        customer_id: staffCustomerId, 
        hospital_id: selectedHospitalId, 
        subject: `[Private] ${subject}`,
        description: description || subject,
        status: 'New',
        priority: priority,
        assigned_agent_id: staffProfile?.id,
        source: 'Internal',
        sla_due_at: slaDueAt
      };

      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert([ticketPayload])
        .select()
        .single();

      if (ticketError) throw new Error(`สร้างใบงานไม่สำเร็จ: ${ticketError.message}`);

      // 4. Record attachments as a system message/log if needed
      if (uploadedUrls.length > 0) {
        // Option A: Add to first log
        await supabase.from('ticket_logs').insert([{
           ticket_id: newTicket.id,
           action_type: 'create',
           performer_id: staffProfile?.id,
           note: `Internal Ticket created with ${uploadedUrls.length} attachments.\nURLs: ${uploadedUrls.join('\n')}`
        }]);

        // Option B: Add as system messages so they show in chat
        for (const url of uploadedUrls) {
          await supabase.from('messages').insert([{
            ticket_id: newTicket.id,
            sender_type: 'system',
            content: url,
            message_type: 'image'
          }]);
        }
      } else {
        await supabase.from('ticket_logs').insert([{
          ticket_id: newTicket.id,
          action_type: 'create',
          performer_id: staffProfile?.id,
          note: `Internal Ticket created by ${staffProfile?.full_name}`
        }]);
      }

      router.push(`/tickets/${newTicket.id}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const [isHospitalOpen, setIsHospitalOpen] = useState(false);
  const [isSubjectOpen, setIsSubjectOpen] = useState(false);
  const hospitalRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (hospitalRef.current && !hospitalRef.current.contains(event.target as Node)) {
        setIsHospitalOpen(false);
      }
      if (subjectRef.current && !subjectRef.current.contains(event.target as Node)) {
        setIsSubjectOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedHospital = hospitals.find(h => h.id === selectedHospitalId);

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '100%', margin: '0', padding: '24px 32px 100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/tickets" className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)', color: 'var(--text-main)' }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', color: 'var(--text-main)', letterSpacing: '-1px' }}>สร้างใบงานใหม่ (สำหรับโรงพยาบาล)</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>การสร้างใบงานระบุเจาะจงกลุ่มเป้าหมาย (Hospital Private Ticket)</p>
        </div>
      </div>

      <div className="glass" style={{ padding: '32px', borderRadius: '24px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {error && (
            <div className="flex" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(234, 84, 85, 0.1)', color: '#ea5455', border: '1px solid rgba(234, 84, 85, 0.2)', gap: '12px', alignItems: 'center' }}>
              <AlertCircle size={20} />
              <span style={{ fontSize: '14px', fontWeight: '700' }}>{error}</span>
            </div>
          )}

          {/* 1. Hospital Selection Listbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }} ref={hospitalRef}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>เลือกโรงพยาบาล (SELECT HOSPITAL)</label>
            <div 
              onClick={() => setIsHospitalOpen(!isHospitalOpen)}
              className="glass-interactive"
              style={{ 
                padding: '16px', 
                borderRadius: '16px', 
                background: 'var(--bg-card)', 
                border: '1.5px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Building size={18} style={{ color: selectedHospital ? 'var(--primary)' : 'var(--text-muted)' }} />
                <span style={{ fontSize: '15px', color: selectedHospital ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: selectedHospital ? '700' : '400' }}>
                  {selectedHospital ? selectedHospital.name : 'ค้นหาหรือเลือกโรงพยาบาล...'}
                </span>
              </div>
              <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: isHospitalOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {isHospitalOpen && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                marginTop: '8px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: '16px', 
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                animation: 'slideDown 0.2s ease-out'
              }}>
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                   <Search style={{ position: 'absolute', left: '24px', top: '24px', color: 'var(--text-muted)' }} size={16} />
                   <input 
                      type="text" 
                      placeholder="พิมพ์เพื่อค้นหา..." 
                      autoFocus
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      style={{ 
                        width: '100%', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '12px', 
                        padding: '10px 10px 10px 36px', 
                        color: 'var(--text-main)', 
                        outline: 'none',
                        fontSize: '14px'
                      }}
                   />
                </div>
                <div className="custom-scrollbar" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {filteredHospitals.length > 0 ? filteredHospitals.map(h => (
                    <div 
                      key={h.id}
                      onClick={() => { setSelectedHospitalId(h.id); setIsHospitalOpen(false); }}
                      style={{ 
                        padding: '12px 20px', 
                        cursor: 'pointer', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: selectedHospitalId === h.id ? 'rgba(0, 242, 254, 0.08)' : 'transparent',
                        transition: 'all 0.2s',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = selectedHospitalId === h.id ? 'rgba(0, 242, 254, 0.08)' : 'transparent'}
                    >
                      <span style={{ fontSize: '14px', fontWeight: selectedHospitalId === h.id ? '700' : '400', color: selectedHospitalId === h.id ? 'var(--primary)' : 'var(--text-main)' }}>{h.name}</span>
                      {h.abbreviation && <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{h.abbreviation}</span>}
                    </div>
                  )) : (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>ไม่พบรายชื่อโรงพยาบาล</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. Subject Selection Listbox */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }} ref={subjectRef}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>หัวข้อที่ต้องการแจ้ง (SUBJECT)</label>
            <div 
              onClick={() => setIsSubjectOpen(!isSubjectOpen)}
              className="glass-interactive"
              style={{ 
                padding: '16px', 
                borderRadius: '16px', 
                background: 'var(--bg-card)', 
                border: '1.5px solid var(--border)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <span style={{ fontSize: '15px', color: subject ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: subject ? '700' : '400' }}>
                {subject ? subject : 'เลือกหัวข้อเรื่องที่ต้องการแจ้ง...'}
              </span>
              <ChevronDown size={18} style={{ color: 'var(--text-muted)', transform: isSubjectOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {isSubjectOpen && (
              <div style={{ 
                position: 'absolute', 
                top: '100%', 
                left: 0, 
                right: 0, 
                zIndex: 100, 
                marginTop: '8px', 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: '16px', 
                boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                overflow: 'hidden',
                animation: 'slideDown 0.2s ease-out'
              }}>
                <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {subjectTypes.map((st, idx) => (
                    <div 
                      key={idx}
                      onClick={() => { setSubject(st); setIsSubjectOpen(false); }}
                      style={{ 
                        padding: '14px 20px', 
                        cursor: 'pointer', 
                        fontSize: '14px',
                        background: subject === st ? 'rgba(0, 242, 254, 0.08)' : 'transparent',
                        color: subject === st ? 'var(--primary)' : 'var(--text-main)',
                        transition: 'all 0.2s',
                        borderBottom: '1px solid rgba(255,255,255,0.03)'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = subject === st ? 'rgba(0, 242, 254, 0.08)' : 'transparent'}
                    >
                      {st}
                    </div>
                  ))}
                  <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                    <input 
                      type="text" 
                      placeholder="ระบุหัวข้ออื่นๆ..." 
                      value={subjectTypes.includes(subject) ? '' : subject}
                      onChange={e => setSubject(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setIsSubjectOpen(false)}
                      style={{ 
                        width: '100%', 
                        background: 'transparent', 
                        border: '1px dashed var(--border)', 
                        borderRadius: '8px', 
                        padding: '8px 12px', 
                        color: 'var(--text-main)', 
                        fontSize: '13px',
                        outline: 'none'
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>รายละเอียดเพิ่มเติม (DESCRIPTION)</label>
            <textarea 
              placeholder="แจ้งรายละเอียดของปัญหา…" 
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="focus-ring"
              style={{ 
                height: '100px', 
                padding: '16px', 
                borderRadius: '16px', 
                background: 'var(--bg-card)', 
                border: '1.5px solid var(--border)', 
                color: 'var(--text-main)', 
                fontSize: '15px', 
                outline: 'none', 
                resize: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.2s'
              }}
            />
          </div>

          {/* 4. Attachments */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>แนบภาพหรือไฟล์ (ATTACHMENTS)</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
               {attachments.map(att => (
                 <div key={att.id} style={{ position: 'relative', width: '70px', height: '70px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)' }}>
                    {att.preview ? (
                      <img src={att.preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="preview" />
                    ) : (
                      <div className="flex-center" style={{ height: '100%', color: 'var(--text-muted)' }}><File size={20} /></div>
                    )}
                    <button 
                      type="button" 
                      onClick={() => removeAttachment(att.id)}
                      style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} />
                    </button>
                 </div>
               ))}
               <button 
                 type="button"
                 onClick={() => fileInputRef.current?.click()}
                 className="glass-interactive"
                 style={{ width: '70px', height: '70px', borderRadius: '12px', border: '2px dashed var(--border)', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', cursor: 'pointer' }}
               >
                 <Paperclip size={18} />
                 <span style={{ fontSize: '9px' }}>เพิ่มไฟล์</span>
               </button>
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileChange} 
                 multiple 
                 style={{ display: 'none' }} 
                 accept="image/*, application/pdf, .doc, .docx, .xls, .xlsx"
               />
            </div>
          </div>

          {/* 5. Priority */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{getStaffMessage(locale, 'dashboard.priorityBreakdown')} (PRIORITY)</label>
            <div style={{ display: 'flex', gap: '12px' }}>
              {['Low', 'Medium', 'High', 'Critical'].map(p => (
                <button 
                  key={p} 
                  type="button" 
                  onClick={() => setPriority(p)}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    borderRadius: '12px', 
                    border: priority === p ? `1px solid ${PRIORITY_COLORS[p]}` : '1px solid var(--border)', 
                    background: priority === p ? PRIORITY_COLORS[p] : 'transparent', 
                    color: priority === p ? (p === 'Critical' || p === 'High' ? 'white' : 'black') : 'var(--text-muted)', 
                    fontWeight: priority === p ? '900' : '600', 
                    fontSize: '13px',
                    transition: 'all 0.2s',
                    boxShadow: priority === p ? `0 4px 12px ${PRIORITY_COLORS[p]}40` : 'none'
                  }}
                >
                  {translateTicketPriority(p, locale)}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button 
            type="submit" 
            disabled={submitting}
            className="glass-interactive"
            style={{ 
              marginTop: '12px', 
              padding: '20px', 
              borderRadius: '20px', 
              background: 'var(--primary)', 
              color: 'black', 
              fontWeight: '900', 
              fontSize: '17px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '12px',
              border: 'none',
              opacity: submitting ? 0.7 : 1,
              cursor: submitting ? 'not-allowed' : 'pointer'
            }}
          >
            {submitting ? <Loader2 className="animate-spin" size={24} /> : (
              <>
                <ShieldCheck size={24} /> {getStaffMessage(locale, 'inbox.confirmPendingButton').replace('Pending', locale === 'th' ? 'สร้างใบงาน' : 'Create Ticket')}
              </>
            )}
          </button>
        </form>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .focus-ring:focus {
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 4px var(--primary-transparent) !important;
          background: rgba(255,255,255,0.02) !important;
        }
      `}} />
    </div>
  );
}
