'use client';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Camera, 
  Save, 
  Loader2, 
  ChevronLeft,
  ShieldCheck,
  Building,
  Lock
} from 'lucide-react';
import Link from 'next/link';
import type { Profile, CompanySettings } from '@/types';

const AVATAR_OPTIONS = [
  // Office Men
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan1&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan2&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan3&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan4&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan5&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan6&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan7&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeMan8&backgroundColor=f1f5f9',
  // Office Women
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman1&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman2&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman3&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman4&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman5&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman6&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman7&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/notionists/svg?seed=OfficeWoman8&backgroundColor=f8fafc',
];

// Dynamic Departments are now handled from company_settings table

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: c } = await supabase.from('company_settings').select('*').limit(1).single();
        setProfile(p);
        setCompany(c);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'profile' | 'company') => {
     const file = event.target.files?.[0];
     if (!file) return;

     setUploading(true);
     try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${target}/${fileName}`;

        const { error: uploadError } = await supabase.storage
           .from('chat_media') 
           .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);

        if (target === 'profile') {
           setProfile((prev) => prev ? { ...prev, avatar_url: publicUrl } : prev);
        } else {
           setCompany((prev) => prev ? { ...prev, logo_url: publicUrl } : prev);
        }
        
        setToastMsg('ไฟล์อัปโหลดสำเร็จ! 🎉');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
     } catch (err: unknown) {
        console.error('Upload error:', err);
        alert('อัปโหลดล้มเหลว: ' + (err instanceof Error ? err.message : 'Error uploading file'));
     } finally {
        setUploading(false);
     }
  };

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        department: profile.department,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      setToastMsg('บันทึกข้อมูลส่วนตัวสำเร็จ! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    if (!company) return;
    setSaving(true);
    try {
      if (company.id) {
         await supabase.from('company_settings').update({
           company_name: company.company_name,
           logo_url: company.logo_url,
           departments: company.departments || [],
           updated_at: new Date().toISOString()
         }).eq('id', company.id);
      } else {
         await supabase.from('company_settings').insert([{
           company_name: company.company_name,
           logo_url: company.logo_url,
           departments: company.departments || []
         }]);
      }
      setToastMsg('บันทึกข้อมูลองค์กรสำเร็จ! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim() || !company) return;
    const updatedDepts = [...(company.departments || []), newDeptName.trim()];
    setCompany({ ...company, departments: updatedDepts });
    setNewDeptName('');
    
    // Save to DB
    try {
      await supabase.from('company_settings').update({ 
        departments: updatedDepts,
        updated_at: new Date().toISOString() 
      }).eq('id', company.id);
      
      setToastMsg('เพิ่มแผนกเรียบร้อย! ✨');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch { alert('Failed to add department'); }
  };

  const handleDeleteDepartment = async (name: string) => {
    if (!company) return;
    if (!confirm(`ยืนยันการลบแผนก "${name}"?`)) return;
    const updatedDepts = (company.departments || []).filter((d: string) => d !== name);
    setCompany({ ...company, departments: updatedDepts });

    try {
      await supabase.from('company_settings').update({ 
        departments: updatedDepts,
        updated_at: new Date().toISOString() 
      }).eq('id', company.id);
      
      setToastMsg('ลบแผนกเรียบร้อย! 🗑️');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch { alert('Failed to delete department'); }
  };
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน!');
      return;
    }
    if (newPassword.length < 6) {
      alert('รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      setToastMsg('เปลี่ยนรหัสผ่านสำเร็จ! 🔐');
      setShowToast(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: unknown) {
      alert('เปลี่ยนรหัสผ่านไม่สำเร็จ: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
         <Link href="/" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={24} /></Link>
         <h1 style={{ fontSize: '28px', fontWeight: '800' }}>ข้อมูลส่วนตัวและองค์กร</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
         {/* 1. Personal Profile */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--secondary)', padding: '10px', borderRadius: '12px' }}>
                  <User size={24} color="var(--primary)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ข้อมูลส่วนตัว</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Personal Profile Settings</p>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
               <div style={{ position: 'relative' }}>
                  <Image 
                    src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
                    alt="Profile avatar"
                    width={120}
                    height={120}
                    style={{ width: '120px', height: '120px', borderRadius: '30px', objectFit: 'cover', border: '4px solid var(--border)' }} 
                  />
                  <label style={{ 
                     position: 'absolute', bottom: '-10px', right: '-10px', 
                     background: 'var(--primary)', padding: '8px', borderRadius: '12px', 
                     cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,242,254,0.4)',
                     display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                     {uploading ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} color="#0a0e14" />}
                     <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'profile')} disabled={uploading} />
                  </label>
               </div>
               <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>เลือก Avatar หรืออัปโหลดรูปของคุณ</p>
               
               <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center', maxHeight: '160px', overflowY: 'auto', padding: '8px' }}>
                 {AVATAR_OPTIONS.map((url, idx) => (
                    <button 
                     key={idx}
                     onClick={() => setProfile(prev => prev ? {...prev, avatar_url: url} : prev)}
                     style={{ 
                       width: '40px', 
                       height: '40px', 
                       borderRadius: '10px', 
                       overflow: 'hidden', 
                       border: profile?.avatar_url === url ? '2px solid var(--primary)' : '1px solid var(--border)',
                       padding: 0,
                       cursor: 'pointer',
                       background: 'none'
                     }}>
                      <Image src={url} alt="Avatar option" width={40} height={40} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                 ))}
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ชื่อ-นามสกุล (FULL NAME)</label>
                  <input 
                    type="text" 
                    value={profile?.full_name || ''} 
                    onChange={e => setProfile(prev => prev ? {...prev, full_name: e.target.value} : prev)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text)', outline: 'none' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>แผนก (DEPARTMENT)</label>
                  <select 
                    value={profile?.department || ''} 
                    onChange={e => setProfile(prev => prev ? {...prev, department: e.target.value} : prev)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text)', outline: 'none', appearance: 'none' }}
                  >
                    <option value="">เลือกแผนก...</option>
                    {(company?.departments || []).map((dept: string, idx: number) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                  </select>
               </div>
               <button 
                onClick={handleSaveProfile}
                disabled={saving || uploading}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกข้อมูลส่วนตัว (SAVE PROFILE)</>}
               </button>
            </div>
         </div>

         {/* 2. Company Branding */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="#0a0e14" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ข้อมูลองค์กร</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Company Branding Settings</p>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
               <div className="glass" style={{ position: 'relative', width: '100%', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '24px', background: 'rgba(0,0,0,0.02)' }}>
                  {company?.logo_url ? (
                    <Image src={company.logo_url} alt="Company logo" width={200} height={160} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                       <Building size={48} color="var(--border)" />
                       <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>โลโก้องค์กร (No Logo)</p>
                    </div>
                  )}
                  <label style={{ 
                     position: 'absolute', bottom: '12px', right: '12px', 
                     background: 'var(--primary)', padding: '8px 12px', borderRadius: '8px', 
                     cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                     display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: '800'
                  }}>
                     {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} color="#0a0e14" />}
                     <span>{uploading ? 'UPLOADING...' : 'อัปโหลดรูป (UPLOAD)'}</span>
                     <input type="file" hidden accept="image/*" onChange={(e) => handleFileUpload(e, 'company')} disabled={uploading} />
                  </label>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ชื่อบริษัท/องค์กร (COMPANY NAME)</label>
                  <input 
                    type="text" 
                    value={company?.company_name || ''} 
                    onChange={e => setCompany(prev => prev ? {...prev, company_name: e.target.value} : prev)}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text)', outline: 'none' }}
                  />
               </div>
               <button 
                onClick={handleSaveCompany}
                disabled={saving || uploading}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกข้อมูลองค์กร (UPDATE BRANDING)</>}
               </button>
            </div>

            <div className="glass" style={{ padding: '16px', marginTop: '32px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                     โลโก้นี้จะปรากฏบน **แถบด้านข้าง (Sidebar)** และ **รายงานสรุปผล (Reports)** ของระบบโดยอัตโนมัติ
                  </p>
               </div>
            </div>
          </div>

          {/* 3. Department Management (NEW) */}
          <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="var(--primary)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>จัดการแผนก</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department Management</p>
               </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>เพิ่มแผนกใหม่ (ADD NEW DEPARTMENT)</label>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="เช่น ฝ่ายเทคนิค, ฝ่ายการเงิน..." 
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'white', outline: 'none' }}
                  />
                  <button 
                    onClick={handleAddDepartment}
                    className="glass-interactive flex-center"
                    style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)', color: 'black', border: 'none' }}>
                    +
                  </button>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto', paddingRight: '8px' }}>
               <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>รายชื่อแผนกปัจจุบัน ({company?.departments?.length || 0})</label>
               {company?.departments?.map((dept: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                     <span style={{ fontSize: '14px', fontWeight: '600' }}>{dept}</span>
                     <button 
                       onClick={() => handleDeleteDepartment(dept)}
                       style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>
                       ลบ (REMOVE)
                     </button>
                  </div>
               ))}
               {(company?.departments?.length === 0 || !company?.departments) && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '20px' }}>ยังไม่มีข้อมูลแผนก</p>
               )}
            </div>
          </div>

          {/* 4. Password Management */}
          <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <Lock size={24} color="var(--danger)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ความปลอดภัย</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Password & Security</p>
               </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>รหัสผ่านใหม่ (NEW PASSWORD)</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ยืนยันรหัสผ่านใหม่ (CONFIRM PASSWORD)</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <button 
                type="submit"
                disabled={updatingPassword}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid rgba(234, 84, 85, 0.2)', color: 'var(--danger)', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  {updatingPassword ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20} /> อัปเดตรหัสผ่าน (UPDATE PASSWORD)</>}
               </button>
            </form>
          </div>
       </div>

      {/* Success Toast */}
      {showToast && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--primary)',
          color: 'black',
          padding: '16px 24px',
          borderRadius: '12px',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 32px rgba(0, 242, 254, 0.3)',
          zIndex: 9999,
          animation: 'slideInRight 0.3s ease-out'
        }}>
          <ShieldCheck size={20} />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
