'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  User, 
  Camera, 
  Save, 
  Loader2, 
  ChevronLeft,
  ShieldCheck,
  Lock,
  Mail,
  MessageSquarePlus,
  ClipboardCheck,
  Plus,
  Trash2,
  Edit2,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';

const AVATAR_SEEDS = [
  'Ariel', 'Willow', 'Casper', 'Sasha', 'Jasper', 'Zoey', 'Felix', 'Luna',
  'Simba', 'Nala', 'Coco', 'Ruby', 'Milo', 'Cleo', 'Jack', 'Oliver'
];

const AVATAR_OPTIONS = AVATAR_SEEDS.map(seed => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`);

const DEPT_BADGES: Record<string, string> = {
  'IT Support': '💻',
  'Customer Service': '🎧',
  'Billing': '💵',
  'Accounting': '📊',
  'Management': '🛡️',
  'Sales': '🚀',
  'Marketing': '📢',
  'Operations': '⚙️',
  'Human Resources': '👥',
  'Administration': '🏢'
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [companyDepts, setCompanyDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: c } = await supabase.from('company_settings').select('departments').limit(1).single();
        setProfile(p);
        if (c?.departments) setCompanyDepts(c.departments);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
     const file = event.target.files?.[0];
     if (!file) return;

     setUploading(true);
     try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `profile/${fileName}`;

        const { error: uploadError } = await supabase.storage
           .from('chat_media') 
           .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
        setProfile({ ...profile, avatar_url: publicUrl });
        
        setToastMsg('อัปโหลดรูปโปรไฟล์สำเร็จ! 🎉');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
     } catch (err: any) {
        alert('อัปโหลดล้มเหลว: ' + (err.message || 'Error'));
     } finally {
        setUploading(false);
     }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        department: profile.department,
        quick_replies: profile.quick_replies || [],
        resolution_templates: profile.resolution_templates || [],
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      if (error) throw error;
      setToastMsg('บันทึกข้อมูลและเทมเพลตเรียบร้อย! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = async (type: 'quick' | 'res', text: string) => {
    if (!text.trim() || !profile) return;
    const key = type === 'quick' ? 'quick_replies' : 'resolution_templates';
    const current = profile[key] || [];
    if (current.includes(text)) return;
    
    const updatedList = [...current, text];
    const updatedProfile = { ...profile, [key]: updatedList };
    setProfile(updatedProfile);

    // Auto-save to Supabase immediately for better UX
    try {
      const { error } = await supabase.from('profiles').update({
        [key]: updatedList,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      if (!error) {
        setToastMsg('บันทึกเทมเพลตอัตโนมัติสำเร็จ! ✨');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  const removeTemplate = async (type: 'quick' | 'res', index: number) => {
    if (!profile) return;
    const key = type === 'quick' ? 'quick_replies' : 'resolution_templates';
    const current = profile[key] || [];
    const next = current.filter((_: any, i: number) => i !== index);
    
    const updatedProfile = { ...profile, [key]: next };
    setProfile(updatedProfile);

    // Auto-save to Supabase immediately
    try {
      const { error } = await supabase.from('profiles').update({
        [key]: next,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);

      if (!error) {
        setToastMsg('ลบเทมเพลตเรียบร้อย! 🗑️');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2000);
      }
    } catch (err) {
      console.error('Auto-delete failed:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('รหัสผ่านไม่ตรงกัน!');
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
    } catch (err: any) {
      alert('ล้มเหลว: ' + err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: '12px', 
        marginBottom: '32px',
        position: 'sticky',
        top: '-20px',
        zIndex: 50,
        background: 'var(--bg-main)',
        padding: '20px 0',
        borderBottom: '1px solid var(--border)'
      }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '8px', borderRadius: '10px', border: '1px solid var(--border)' }}><ChevronLeft size={24} /></Link>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>ข้อมูลส่วนตัวของฉัน</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>Manage your profile and preferences</p>
            </div>
         </div>
         <button 
          onClick={handleSaveProfile}
          disabled={saving || uploading}
          className="glass-interactive" 
          style={{ 
            padding: '12px 24px', 
            borderRadius: '14px', 
            background: 'var(--primary)', 
            border: 'none', 
            color: '#000', 
            fontWeight: '900', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px',
            boxShadow: '0 8px 25px rgba(0, 242, 254, 0.3)'
          }}>
            {saving ? <Loader2 className="animate-spin" size={20} /> : <><Save size={20} /> บันทึกการเปลี่ยนแปลง</>}
         </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
         {/* 1. Basic Info */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--secondary)', padding: '10px', borderRadius: '12px' }}>
                   <User size={24} color="var(--primary)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ข้อมูลผู้ใช้งาน</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Your Personal Information</p>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
                <div style={{ position: 'relative' }}>
                   <div style={{ position: 'relative' }}>
                      <img 
                        src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
                        style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover', border: '5px solid var(--border)', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', background: 'var(--bg-deep)' }} 
                      />
                      {profile?.department && (
                        <div style={{ 
                          position: 'absolute', top: '5px', right: '5px', 
                          width: '32px', height: '32px', borderRadius: '50%', 
                          background: 'rgba(10,14,20,0.85)', 
                          backdropFilter: 'blur(8px)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', border: '2px solid rgba(255,255,255,0.1)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          zIndex: 5
                        }}>
                          {DEPT_BADGES[profile.department] || '💼'}
                        </div>
                      )}
                   </div>
                   <label style={{ 
                      position: 'absolute', bottom: '0', right: '0', 
                      background: 'var(--primary)', padding: '10px', borderRadius: '50%', 
                      cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,242,254,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '4px solid var(--bg-card)', zIndex: 6
                   }}>
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} color="#000" />}
                      <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                   </label>
                </div>
               <p style={{ marginTop: '20px', fontSize: '13px', fontWeight: '700', color: 'var(--text-muted)' }}>เลือก Avatar หรืออัปโหลดรูปของคุณ</p>
               
               <div style={{ 
                 display: 'grid', 
                 gridTemplateColumns: 'repeat(8, 1fr)', 
                 gap: '8px', 
                 marginTop: '20px', 
                 padding: '12px',
                 background: 'rgba(255,255,255,0.01)',
                 borderRadius: '20px',
                 border: '1px solid var(--border)'
               }}>
                 {AVATAR_OPTIONS.map((url, idx) => (
                    <button 
                     key={idx}
                     onClick={() => setProfile({...profile, avatar_url: url})}
                     style={{ 
                       width: '36px', 
                       height: '36px', 
                       borderRadius: '10px', 
                       overflow: 'hidden', 
                       border: profile?.avatar_url === url ? '3px solid var(--primary)' : '1px solid transparent',
                       padding: 0,
                       cursor: 'pointer',
                       background: 'var(--bg-deep)',
                       transition: 'all 0.2s',
                       transform: profile?.avatar_url === url ? 'scale(1.1)' : 'scale(1)'
                     }}>
                      <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </button>
                 ))}
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ชื่อ-นามสกุล (FULL NAME)</label>
                  <input 
                    type="text" 
                    value={profile?.full_name || ''} 
                    onChange={e => setProfile({...profile, full_name: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '700' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>แผนกประจำการ (DEPARTMENT)</label>
                  <select 
                    value={profile?.department || ''} 
                    onChange={e => setProfile({...profile, department: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', outline: 'none', appearance: 'none', fontWeight: '700' }}
                  >
                    <option value="">เลือกแผนกหลัก...</option>
                    {companyDepts.map((dept: string, idx: number) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                  </select>
               </div>
            </div>
         </div>

         {/* 2. Security */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <Lock size={24} color="var(--danger)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>รหัสผ่านและระบบป้องกัน</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Security & Authentication</p>
               </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>อีเมลเข้าใช้งาน (EMAIL)</label>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <Mail size={16} />
                     <span style={{ fontWeight: '700' }}>{profile?.email || 'Authenticated User'}</span>
                  </div>
               </div>
               <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', marginTop: '10px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>รหัสผ่านใหม่ (NEW PASSWORD)</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '700' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ยืนยันรหัสผ่านใหม่ (CONFIRM)</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '700' }}
                  />
               </div>
               <button 
                type="submit"
                disabled={updatingPassword}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '15px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid rgba(234, 84, 85, 0.2)', color: 'var(--danger)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  {updatingPassword ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={20} /> ยืนยันการเปลี่ยนรหัสผ่าน</>}
               </button>
            </form>
         </div>
      </div>

      {/* 3. Personal Templates */}
      <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
         {/* 3.1 Quick Replies */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
                     <MessageSquarePlus size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ข้อความตอบด่วนส่วนตัว</h2>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Personal Quick Replies</p>
                  </div>
               </div>
               <button 
                onClick={() => {
                  const val = prompt('ใส่ข้อความตอบด่วนใหม่:');
                  if (val) addTemplate('quick', val);
                }}
                className="glass-interactive" style={{ padding: '8px 16px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#000', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> เพิ่มใหม่
               </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {(profile?.quick_replies || []).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                     <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ยังไม่มีข้อความตอบด่วนส่วนตัว</p>
                  </div>
               ) : (
                  profile.quick_replies.map((text: string, idx: number) => (
                     <div key={idx} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                        padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px'
                     }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', flex: 1 }}>{text}</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button onClick={() => removeTemplate('quick', idx)} style={{ padding: '6px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>

         {/* 3.2 Resolution Templates */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '10px', borderRadius: '12px' }}>
                     <ClipboardCheck size={24} color="#28c76f" />
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>เทมเพลตสรุปงานส่วนตัว</h2>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resolution Templates</p>
                  </div>
               </div>
               <button 
                onClick={() => {
                  const val = prompt('ใส่ข้อความสรุปงานใหม่:');
                  if (val) addTemplate('res', val);
                }}
                className="glass-interactive" style={{ padding: '8px 16px', borderRadius: '10px', background: '#28c76f', border: 'none', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={14} /> เพิ่มใหม่
               </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
               {(profile?.resolution_templates || []).length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                     <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ยังไม่มีเทมเพลตสรุปงานส่วนตัว</p>
                  </div>
               ) : (
                  profile.resolution_templates.map((text: string, idx: number) => (
                     <div key={idx} style={{ 
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
                        padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px'
                     }}>
                        <p style={{ fontSize: '14px', color: 'var(--text-main)', flex: 1 }}>{text}</p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                           <button onClick={() => removeTemplate('res', idx)} style={{ padding: '6px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                           </button>
                        </div>
                     </div>
                  ))
               )}
            </div>
         </div>
      </div>

       {showToast && (
        <div style={{
          position: 'fixed', bottom: '32px', right: '32px', background: 'var(--primary)', color: 'black', padding: '16px 28px', borderRadius: '14px', fontWeight: '900', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 10px 40px rgba(0, 242, 254, 0.3)', zIndex: 9999, animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <ShieldCheck size={20} />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
