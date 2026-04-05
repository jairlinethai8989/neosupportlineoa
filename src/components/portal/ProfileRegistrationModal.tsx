'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Loader2, 
  ArrowRight, 
  Save, 
  User, 
  UserCheck, 
  Briefcase, 
  ChevronDown,
  Info
} from 'lucide-react';
import { LiffProfile } from '@/hooks/useLiff';

interface ProfileRegistrationModalProps {
  isOpen: boolean;
  profile: LiffProfile | null;
  existingCustomer?: any; // If null, user needs registration. If exists, user is editing.
  onComplete: () => void;
  onClose?: () => void; // Optional: Only for closing when editing
}

export default function ProfileRegistrationModal({ isOpen, profile, existingCustomer, onComplete, onClose }: ProfileRegistrationModalProps) {
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [positions, setPositions] = useState<any[]>([]);
  const [loadingOpts, setLoadingOpts] = useState(true);
  
  const [displayName, setDisplayName] = useState('');
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch Master Data
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadMasterData() {
      setLoadingOpts(true);
      setError('');
      try {
        console.log('Loading master data...');
        const [hRes, dRes, pRes] = await Promise.all([
          supabase.from('hospitals').select('*').order('name'),
          supabase.from('departments').select('*').order('name'),
          supabase.from('positions').select('*').order('name')
        ]);
        
        if (hRes.error) console.error('H-Err:', hRes.error);
        if (dRes.error) console.error('D-Err:', dRes.error);
        if (pRes.error) console.error('P-Err:', pRes.error);

        if (hRes.data) setHospitals(hRes.data);
        if (dRes.data) setDepartments(dRes.data);
        if (pRes.data) setPositions(pRes.data);
        
        if (hRes.data?.length === 0) {
           console.warn('Hospitals table is empty for public/anon user.');
        }

        if (existingCustomer) {
          setDisplayName(existingCustomer.display_name || '');
          setSelectedHospital(existingCustomer.hospital_id || '');
          setSelectedDept(existingCustomer.department_id || '');
          setSelectedPosition(existingCustomer.position_id || '');
        } else if (profile?.displayName) {
          setDisplayName(profile.displayName);
        }
      } catch (err: any) {
        console.error('Failed to load master data:', err);
      } finally {
        setLoadingOpts(false);
      }
    }
    loadMasterData();
  }, [isOpen, existingCustomer, profile]);

  if (!isOpen) return null;

  const isEditing = !!existingCustomer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.userId) {
       setError('ไม่พบข้อมูลโปรไฟล์ LINE กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
       return;
    }

    if (!displayName.trim() || !selectedHospital || !selectedDept || !selectedPosition) {
       setError('กรุณาระบุข้อมูลส่วนตัวให้ครบถ้วนก่อนเริ่มต้นใช้งาน');
       return;
    }

    setSubmitting(true);
    setError('');

    try {
      if (isEditing) {
         // Update existing profile
         const { error: updErr } = await supabase
           .from('customers')
           .update({ 
               display_name: displayName,
               hospital_id: selectedHospital, 
               department_id: selectedDept,
               position_id: selectedPosition,
               updated_at: new Date().toISOString()
           })
           .eq('id', existingCustomer.id);
           
         if (updErr) throw updErr;
      } else {
         // Create new registration
         const { error: insErr } = await supabase
           .from('customers')
           .insert([{
              line_user_id: profile.userId,
              display_name: displayName,
              email: `${profile.userId}@line.me`, // placeholder
              phone: '-',
              hospital_id: selectedHospital,
              department_id: selectedDept,
              position_id: selectedPosition
           }]);
           
         if (insErr) throw insErr;
      }
      onComplete();
    } catch (err: any) {
       setError(err.message || 'ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
       setSubmitting(false);
    }
  };

  const labelStyle = { fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase' as any, letterSpacing: '0.05em' };
  const inputStyle = { 
    width: '100%', 
    padding: '14px 16px', 
    background: 'rgba(255,255,255,0.05)', 
    border: '1px solid var(--border)', 
    borderRadius: '14px', 
    color: 'var(--text-main)', 
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s ease',
    WebkitAppearance: 'none' as any
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '440px', padding: '32px', borderRadius: '32px', display: 'flex', flexDirection: 'column', gap: '24px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 30px 60px rgba(0,0,0,0.6)' }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
           <div style={{ width: '70px', height: '70px', borderRadius: '24px', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid var(--border-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', transform: 'rotate(10deg)' }}>
              {isEditing ? <UserCheck size={32} color="var(--primary)" /> : <User size={32} color="var(--primary)" />}
           </div>
           <h2 style={{ fontSize: '22px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '8px' }}>
              {isEditing ? 'แก้ไขข้อมูลส่วนตัว' : 'ลงทะเบียนผู้ใช้งานใหม่'}
           </h2>
           <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              กรุณาระบุข้อมูลของคุณเพื่อเริ่มต้นแจ้งปัญหาการใช้งาน
           </p>
        </div>

        {error && (
           <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', textAlign: 'center', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <Info size={14} /> {error}
           </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
           
           {/* Full Name */}
           <div>
              <label style={labelStyle}>ชื่อ-นามสกุล</label>
              <input 
                type="text"
                placeholder="ระบุชื่อจริง-นามสกุล..."
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                style={inputStyle}
                required
              />
           </div>

           {/* Hospital Select */}
           <div style={{ position: 'relative' }}>
              <label style={labelStyle}>โรงพยาบาล / หน่วยงาน</label>
              <select 
                 value={selectedHospital}
                 onChange={e => setSelectedHospital(e.target.value)}
                 disabled={loadingOpts || submitting}
                 style={inputStyle}
                 required
              >
                  <option value="" disabled style={{ background: '#1a1d23' }}>เลือกโรงพยาบาล...</option>
                  {hospitals.map(h => (
                    <option key={h.id} value={h.id} style={{ background: '#1a1d23' }}>{h.name}</option>
                  ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '38px', opacity: 0.5, pointerEvents: 'none' }} />
           </div>

           {/* Department Select */}
           <div style={{ position: 'relative' }}>
              <label style={labelStyle}>แผนก / ฝ่าย</label>
              <select 
                 value={selectedDept}
                 onChange={e => setSelectedDept(e.target.value)}
                 disabled={loadingOpts || submitting}
                 style={inputStyle}
                 required
              >
                  <option value="" disabled style={{ background: '#1a1d23' }}>เลือกแผนก...</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id} style={{ background: '#1a1d23' }}>{d.name}</option>
                  ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '38px', opacity: 0.5, pointerEvents: 'none' }} />
           </div>

           {/* Position Select */}
           <div style={{ position: 'relative' }}>
              <label style={labelStyle}>ตำแหน่งงาน</label>
              <select 
                 value={selectedPosition}
                 onChange={e => setSelectedPosition(e.target.value)}
                 disabled={loadingOpts || submitting}
                 style={inputStyle}
                 required
              >
                  <option value="" disabled style={{ background: '#1a1d23' }}>เลือกตำแหน่ง...</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#1a1d23' }}>{p.name}</option>
                  ))}
              </select>
              <ChevronDown size={16} style={{ position: 'absolute', right: '16px', top: '38px', opacity: 0.5, pointerEvents: 'none' }} />
           </div>

           <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
              <button 
                 type="submit" 
                 disabled={submitting || loadingOpts}
                 style={{ 
                    width: '100%',
                    padding: '16px',
                    borderRadius: '16px',
                    background: 'var(--primary)',
                    color: '#000',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: '900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                    cursor: (submitting || loadingOpts) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 10px 30px rgba(0, 242, 254, 0.3)',
                    opacity: (submitting || loadingOpts) ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                 }}
              >
                 {submitting ? (
                   <Loader2 size={20} className="animate-spin" />
                 ) : (
                   isEditing ? <>ตกลง</> : <>เริ่มต้นใช้งานระบบ <ArrowRight size={20}/></>
                 )}
              </button>
              
              {isEditing && onClose && (
                 <button 
                   type="button"
                   onClick={onClose}
                   disabled={submitting}
                   style={{ background: 'none', border: 'none', color: 'var(--text-dim)', fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: '10px' }}
                 >
                    ยกเลิก
                 </button>
              )}
           </div>
        </form>
      </div>
    </div>
  );
}
