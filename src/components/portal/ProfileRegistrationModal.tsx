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
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-6 animate-fade-in">
      <div className="glass w-full max-w-md p-8 relative flex flex-col gap-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="text-center">
           <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20 shadow-inner">
              {isEditing ? <UserCheck className="w-10 h-10 text-primary" /> : <Building2 className="w-10 h-10 text-primary" />}
           </div>
           <h2 className="text-2xl font-black mb-3 text-main">
              {isEditing ? 'การตั้งค่าโปรไฟล์' : 'บันทึกข้อมูลเริ่มต้น'}
           </h2>
           <p className="text-muted text-sm px-4 leading-relaxed">
              {isEditing 
                ? 'อัปเดตข้อมูลเพื่อให้เจ้าหน้าที่ระบุตัวตนของคุณได้ง่ายขึ้น' 
                : 'ยินดีต้อนรับสู่ระบบ Neo Support คลิกปุ่มด้านล่างเพื่อเริ่มสร้างใบงานแจ้งซ่อม/แจ้งปัญหากับเรา'}
           </p>
        </div>

        {error && (
           <div className="p-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-xs text-center">
              {error}
           </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4">
           {/* Primary Call to Action */}
           <div className="flex flex-col gap-4">
              <button 
                 type="submit" 
                 disabled={submitting || loadingOpts}
                 className="w-full py-4.5 rounded-2xl bg-primary text-black font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/25 hover:shadow-primary/40 active:scale-[0.97] transition-all"
              >
                 {submitting ? (
                   <Loader2 className="w-6 h-6 animate-spin" />
                 ) : (
                   isEditing ? (
                     <><Save className="w-5 h-5"/> บันทึกการเปลี่ยนแปลง</>
                   ) : (
                     <>เริ่มต้นใช้งานระบบ <ArrowRight className="w-5 h-5"/></>
                   )
                 )}
              </button>
              
              {isEditing && onClose && (
                 <button 
                   type="button"
                   onClick={onClose}
                   disabled={submitting}
                   className="w-full py-4 rounded-xl text-muted font-bold text-sm tracking-wide hover:text-main transition-colors"
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
