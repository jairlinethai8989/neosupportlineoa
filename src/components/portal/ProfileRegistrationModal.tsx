'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Building, Loader2, ArrowRight, Save, UserCheck } from 'lucide-react';
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
      try {
        const [hRes, dRes, pRes] = await Promise.all([
          supabase.from('hospitals').select('*').eq('is_active', true).order('name'),
          supabase.from('departments').select('*').eq('is_active', true).order('name'),
          supabase.from('positions').select('*').eq('is_active', true).order('name')
        ]);
        
        if (hRes.data) setHospitals(hRes.data);
        if (dRes.data) setDepartments(dRes.data);
        if (pRes.data) setPositions(pRes.data);
        
        if (existingCustomer) {
          setSelectedHospital(existingCustomer.hospital_id || '');
          setSelectedDept(existingCustomer.department_id || '');
          setSelectedPosition(existingCustomer.position_id || '');
        }
      } catch (err: any) {
        console.error('Failed to load master data:', err);
      } finally {
        setLoadingOpts(false);
      }
    }
    loadMasterData();
  }, [isOpen, existingCustomer]);

  if (!isOpen) return null;

  const isEditing = !!existingCustomer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.userId) {
       setError('ไม่พบข้อมูลโปรไฟล์ LINE กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
       return;
    }
    // Auto-select first available if empty (Minimal Requirement)
    let finalHospital = selectedHospital;
    let finalDept = selectedDept;
    let finalPos = selectedPosition;

    if (!finalHospital && hospitals.length > 0) finalHospital = hospitals[0].id;
    if (!finalDept && departments.length > 0) finalDept = departments[0].id;
    if (!finalPos && positions.length > 0) finalPos = positions[0].id;

    if (!finalHospital || !finalDept || !finalPos) {
       setError('ระบบกำลังโหลดข้อมูลพื้นฐาน กรุณารอสักครู่แล้วลองใหม่อีกครั้ง');
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
               hospital_id: finalHospital, 
               department_id: finalDept,
               position_id: finalPos,
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
              display_name: profile.displayName || 'LINE User',
              email: `${profile.userId}@line.me`, // placeholder
              phone: '-',
              hospital_id: finalHospital,
              department_id: finalDept,
              position_id: finalPos
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(16px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '24px' }}>
      <div className="glass" style={{ width: '100%', maxWidth: '420px', padding: '32px', borderRadius: '32px', display: 'flex', flexDirection: 'column', gap: '32px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
           <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(0, 242, 254, 0.1)', border: '1px solid var(--border-active)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
              {isEditing ? <UserCheck size={32} color="var(--primary)" /> : <Building2 size={32} color="var(--primary)" />}
           </div>
           <h2 style={{ fontSize: '24px', fontWeight: '900', color: 'var(--text-main)', marginBottom: '12px' }}>
              {isEditing ? 'การตั้งค่าโปรไฟล์' : 'บันทึกข้อมูลเริ่มต้น'}
           </h2>
           <p style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', padding: '0 10px' }}>
              {isEditing 
                ? 'อัปเดตข้อมูลเพื่อให้เจ้าหน้าที่ระบุตัวตนของคุณได้ง่ายขึ้น' 
                : 'ยินดีต้อนรับสู่ระบบ Neo Support คลิกปุ่มด้านล่างเพื่อเริ่มสร้างใบงานแจ้งซ่อม/แจ้งปัญหากับเรา'}
           </p>
        </div>

        {error && (
           <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>
              {error}
           </div>
        )}

        <form onSubmit={handleSubmit}>
           <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button 
                 type="submit" 
                 disabled={submitting || loadingOpts}
                 className="flex-center"
                 style={{ 
                    width: '100%',
                    padding: '18px',
                    borderRadius: '20px',
                    background: 'var(--primary)',
                    color: '#000',
                    border: 'none',
                    fontSize: '16px',
                    fontWeight: '900',
                    gap: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)',
                    opacity: (submitting || loadingOpts) ? 0.6 : 1
                 }}
              >
                 {submitting ? (
                   <Loader2 size={20} className="animate-spin" />
                 ) : (
                   isEditing ? (
                     <><Save size={20}/> บันทึกการเปลี่ยนแปลง</>
                   ) : (
                     <>เริ่มต้นใช้งานระบบ <ArrowRight size={20}/></>
                   )
                 )}
              </button>
              
              {isEditing && onClose && (
                 <button 
                   type="button"
                   onClick={onClose}
                   disabled={submitting}
                   style={{ 
                      width: '100%',
                      padding: '14px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '14px',
                      fontWeight: '700',
                      cursor: 'pointer'
                   }}
                 >
                    ย้อนกลับ
                 </button>
              )}
           </div>
        </form>
      </div>
    </div>
  );
}
