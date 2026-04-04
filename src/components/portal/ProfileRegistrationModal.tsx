'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Building, Loader2, ArrowRight, Save, User, UserCheck, Briefcase } from 'lucide-react';
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
    if (!selectedHospital || !selectedDept || !selectedPosition) {
       setError('กรุณาระบุข้อมูลส่วนตัวให้ครบถ้วน');
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
              display_name: profile.displayName || 'LINE User',
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

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-6 animate-fade-in">
      <div className="glass w-full max-w-md p-8 relative flex flex-col gap-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="text-center">
           <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 border border-primary/30">
              {isEditing ? <UserCheck className="w-8 h-8 text-primary" /> : <Building2 className="w-8 h-8 text-primary" />}
           </div>
           <h2 className="text-2xl font-extrabold mb-2 text-main">
              {isEditing ? 'แก้ไขข้อมูลส่วนตัว' : 'ยินดีต้อนรับสู่ระบบช่วยเหลือ'}
           </h2>
           <p className="text-muted text-sm leading-relaxed">
              {isEditing 
                ? 'กรุณาอัปเดตข้อมูลโรงพยาบาล แผนก และตำแหน่งของคุณ' 
                : 'กรุณาระบุข้อมูลโรงพยาบาล แผนก และตำแหน่ง เพื่อเริ่มต้นใช้งานระบบ'}
           </p>
        </div>

        {error && (
           <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-danger text-xs text-center animate-shake">
              {error}
           </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
           {/* Hospital Select */}
           <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                 <Building className="w-3.5 h-3.5" /> โรงพยาบาล / หน่วยงาน
              </label>
              <div className="relative group">
                <select 
                   value={selectedHospital}
                   onChange={e => setSelectedHospital(e.target.value)}
                   disabled={loadingOpts || submitting}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-main appearance-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none"
                >
                   <option value="" disabled className="bg-[#1a1d23]">เลือกโรงพยาบาลของคุณ</option>
                   {hospitals.map(h => (
                      <option key={h.id} value={h.id} className="bg-[#1a1d23]">{h.name}</option>
                   ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
           </div>

           {/* Department Select */}
           <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                 <User className="w-3.5 h-3.5" /> แผนก / ฝ่าย
              </label>
              <div className="relative group">
                <select 
                   value={selectedDept}
                   onChange={e => setSelectedDept(e.target.value)}
                   disabled={loadingOpts || submitting}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-main appearance-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none"
                >
                   <option value="" disabled className="bg-[#1a1d23]">เลือกแผนกของคุณ</option>
                   {departments.map(d => (
                      <option key={d.id} value={d.id} className="bg-[#1a1d23]">{d.name}</option>
                   ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                   <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
           </div>

           {/* Position Select */}
           <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-[11px] font-bold text-muted uppercase tracking-wider">
                 <Briefcase className="w-3.5 h-3.5" /> ตำแหน่งงาน
              </label>
              <div className="relative group">
                <select 
                   value={selectedPosition}
                   onChange={e => setSelectedPosition(e.target.value)}
                   disabled={loadingOpts || submitting}
                   className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-main appearance-none cursor-pointer focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all outline-none"
                >
                   <option value="" disabled className="bg-[#1a1d23]">เลือกตำแหน่งของคุณ</option>
                   {positions.map(p => (
                      <option key={p.id} value={p.id} className="bg-[#1a1d23]">{p.name}</option>
                   ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                   <ArrowRight className="w-4 h-4 rotate-90" />
                </div>
              </div>
           </div>

           <div className="flex gap-4 mt-4">
              {isEditing && onClose && (
                 <button 
                   type="button"
                   onClick={onClose}
                   disabled={submitting}
                   className="flex-1 glass-interactive py-3.5 rounded-xl text-main font-bold text-sm tracking-wide transition-all"
                 >
                    ยกเลิก
                 </button>
              )}
              <button 
                 type="submit" 
                 disabled={submitting || loadingOpts || !selectedHospital || !selectedDept || !selectedPosition}
                 className="flex-[2] py-4 rounded-xl bg-primary text-black font-black flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100 transition-all"
              >
                 {submitting ? (
                   <Loader2 className="w-5 h-5 animate-spin" />
                 ) : (
                   isEditing ? (
                     <><Save className="w-5 h-5"/> บันทึกข้อมูล</>
                   ) : (
                     <>เริ่มต้นใช้งาน <ArrowRight className="w-5 h-5 text-black/70"/></>
                   )
                 )}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}

