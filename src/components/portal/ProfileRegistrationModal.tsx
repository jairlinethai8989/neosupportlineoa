'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Building2, Building, Loader2, ArrowRight, Save, User, UserCheck } from 'lucide-react';
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
  const [loadingOpts, setLoadingOpts] = useState(true);
  
  const [selectedHospital, setSelectedHospital] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch Master Data
  useEffect(() => {
    if (!isOpen) return;
    
    async function loadMasterData() {
      setLoadingOpts(true);
      const [hRes, dRes] = await Promise.all([
        supabase.from('hospitals').select('*').eq('is_active', true).order('name'),
        supabase.from('departments').select('*').eq('is_active', true).order('name')
      ]);
      
      if (hRes.data) setHospitals(hRes.data);
      if (dRes.data) setDepartments(dRes.data);
      setLoadingOpts(false);

      if (existingCustomer) {
        setSelectedHospital(existingCustomer.hospital_id || '');
        setSelectedDept(existingCustomer.department_id || '');
      }
    }
    loadMasterData();
  }, [isOpen, existingCustomer]);

  if (!isOpen) return null;

  const isEditing = !!existingCustomer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.userId) {
       setError('LINE Profile not found. Please relogin.');
       return;
    }
    if (!selectedHospital || !selectedDept) {
       setError('Please select both Hospital and Department.');
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
              name: profile.displayName || 'LINE User',
              email: `${profile.userId}@line.me`, // placeholder
              phone: '-',
              hospital_id: selectedHospital,
              department_id: selectedDept
           }]);
           
         if (insErr) throw insErr;
      }
      onComplete();
    } catch (err: any) {
       setError(err.message || 'Failed to save profile. Please try again.');
    } finally {
       setSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 14, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      padding: '24px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div className="glass" style={{
        width: '100%',
        maxWidth: '400px',
        padding: '32px 24px',
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: '24px',
        transform: 'translateY(0)',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
           <div style={{ 
               width: '64px', height: '64px', 
               borderRadius: '50%', background: 'rgba(0, 242, 254, 0.1)', 
               display: 'flex', alignItems: 'center', justifyContent: 'center', 
               margin: '0 auto 16px', border: '1px solid var(--primary)' 
           }}>
              {isEditing ? <UserCheck size={32} color="var(--primary)" /> : <Building2 size={32} color="var(--primary)" />}
           </div>
           <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '8px' }}>
              {isEditing ? 'Edit Profile' : 'Welcome to Support Portal'}
           </h2>
           <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.5' }}>
              {isEditing ? 'Update your hospital and department information.' : 'Please register your hospital and department to continue using the support services.'}
           </p>
        </div>

        {error && (
           <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255, 71, 87, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>
              {error}
           </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
           {/* Hospital Select */}
           <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                 <Building size={14} /> Hospital Name
              </label>
              <select 
                 value={selectedHospital}
                 onChange={e => setSelectedHospital(e.target.value)}
                 disabled={loadingOpts || submitting}
                 className="glass-input"
                 style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', appearance: 'none', cursor: 'pointer' }}
              >
                 <option value="" disabled>Select your hospital</option>
                 {hospitals.map(h => (
                    <option key={h.id} value={h.id} style={{ color: 'black' }}>{h.name}</option>
                 ))}
              </select>
           </div>

           {/* Department Select */}
           <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                 <User size={14} /> Department
              </label>
              <select 
                 value={selectedDept}
                 onChange={e => setSelectedDept(e.target.value)}
                 disabled={loadingOpts || submitting}
                 className="glass-input"
                 style={{ width: '100%', padding: '14px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'white', appearance: 'none', cursor: 'pointer' }}
              >
                 <option value="" disabled>Select your department</option>
                 {departments.map(d => (
                    <option key={d.id} value={d.id} style={{ color: 'black' }}>{d.name}</option>
                 ))}
              </select>
           </div>

           <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              {isEditing && onClose && (
                 <button 
                   type="button"
                   onClick={onClose}
                   disabled={submitting}
                   className="glass-interactive"
                   style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'transparent', color: 'white', fontWeight: '700' }}
                 >
                    Cancel
                 </button>
              )}
              <button 
                 type="submit" 
                 disabled={submitting || loadingOpts || !selectedHospital || !selectedDept}
                 className="glass-interactive"
                 style={{ 
                    flex: 2, padding: '14px', borderRadius: '12px', 
                    border: 'none', background: 'var(--primary)', color: 'black', 
                    fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    opacity: (!selectedHospital || !selectedDept) ? 0.5 : 1
                 }}
              >
                 {submitting ? <Loader2 size={18} className="animate-spin" /> : (isEditing ? <><Save size={18}/> Save Changes</> : <>Continue <ArrowRight size={18}/></>)}
              </button>
           </div>
        </form>
      </div>
    </div>
  );
}
