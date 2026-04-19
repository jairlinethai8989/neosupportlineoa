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
  'Simba', 'Nala', 'Coco', 'Ruby', 'Milo', 'Cleo', 'Jack', 'Oliver',
  'Midnight', 'Shadow', 'Ginger', 'Snowball', 'Pepper', 'Sunny', 'Cookie', 'Bear'
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
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: depts } = await supabase.from('departments').select('name').eq('is_active', true).eq('dept_type', 'organization').order('name');
        setProfile(p);
        if (depts) setCompanyDepts(depts.map(d => d.name));
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
    <div style={{ animation: 'fadeIn 0.5s ease-out', width: '100%', paddingBottom: '60px' }}>
      {/* 1. Header Area */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Link href="/" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '10px', borderRadius: '12px', border: '1px solid var(--border)' }}><ChevronLeft size={24} /></Link>
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>ตั้งค่าบัญชีและการใช้งาน</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>Manage identity and workflow tools</p>
            </div>
         </div>
      </div>

      {/* 2. Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '32px', padding: '6px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', width: 'fit-content', border: '1px solid var(--border)' }}>
        <button 
          onClick={() => setActiveTab('profile')}
          style={{ 
            padding: '12px 28px', borderRadius: '12px', border: 'none', 
            background: activeTab === 'profile' ? 'var(--primary)' : 'transparent',
            color: activeTab === 'profile' ? '#000' : 'var(--text-muted)',
            fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s',
            boxShadow: activeTab === 'profile' ? '0 4px 15px rgba(0, 242, 254, 0.2)' : 'none'
          }}
        >
          จัดการเวิร์กสเปซและโปรไฟล์
        </button>
        <button 
          onClick={() => setActiveTab('security')}
          style={{ 
            padding: '12px 28px', borderRadius: '12px', border: 'none', 
            background: activeTab === 'security' ? '#7367f0' : 'transparent',
            color: activeTab === 'security' ? '#fff' : 'var(--text-muted)',
            fontWeight: '800', cursor: 'pointer', transition: 'all 0.3s',
            boxShadow: activeTab === 'security' ? '0 4px 15px rgba(115, 103, 240, 0.3)' : 'none'
          }}
        >
          รหัสผ่านและความปลอดภัย
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(350px, 450px) 1fr', gap: '32px', animation: 'slideUp 0.4s ease-out' }}>
          
          {/* Identity & Global Save (Law of Proximity) */}
          <div className="glass" style={{ padding: '32px', height: 'fit-content', position: 'sticky', top: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--secondary)', padding: '10px', borderRadius: '12px' }}>
                   <User size={24} color="var(--primary)" />
               </div>
               <h2 style={{ fontSize: '20px', fontWeight: '700' }}>ข้อมูลโปรไฟล์</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ position: 'relative', marginBottom: '24px' }}>
                 <img 
                   src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
                   style={{ width: '130px', height: '130px', borderRadius: '50%', objectFit: 'cover', border: '5px solid var(--border)', background: 'var(--bg-deep)' }} 
                 />
                 <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', padding: '10px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,242,254,0.4)', border: '4px solid var(--bg-card)' }}>
                    {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} color="#000" />}
                    <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                 </label>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(8, 1fr)', 
                gap: '8px', 
                justifyContent: 'center', 
                padding: '16px', 
                borderRadius: '20px', 
                border: '1px solid var(--border)', 
                background: 'rgba(255,255,255,0.01)',
                maxHeight: '140px',
                overflowY: 'auto'
              }}>
                {AVATAR_OPTIONS.map((url, idx) => (
                   <button key={idx} onClick={() => setProfile({...profile, avatar_url: url})} style={{ width: '32px', height: '32px', borderRadius: '8px', overflow: 'hidden', border: profile?.avatar_url === url ? '2px solid var(--primary)' : '1px solid transparent', padding: 0, cursor: 'pointer', flexShrink: 0 }}>
                     <img src={url} style={{ width: '100%', height: '100%' }} />
                   </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>ชื่อ-นามสกุล (Full Name)</label>
                  <input type="text" value={profile?.full_name || ''} onChange={e => setProfile({...profile, full_name: e.target.value})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '700' }} />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>แผนกประจำการ (Department)</label>
                  <select value={profile?.department || ''} onChange={e => setProfile({...profile, department: e.target.value})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '700' }}>
                    <option value="">เลือกแผนกหลัก...</option>
                    {companyDepts.map((d: string) => (<option key={d} value={d}>{d}</option>))}
                  </select>
               </div>
               
               <button 
                onClick={handleSaveProfile}
                disabled={saving || uploading}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '16px', boxShadow: '0 8px 30px rgba(0, 242, 254, 0.3)' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกข้อมูลโปรไฟล์</>}
               </button>
            </div>
          </div>

          {/* Workflow Tools (Chuncking) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {/* Quick Replies */}
            <div className="glass" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
                       <MessageSquarePlus size={24} color="var(--primary)" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '20px', fontWeight: '700' }}>ข้อความตอบด่วน</h2>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Workflow Automation</p>
                    </div>
                 </div>
                 <button onClick={() => { const val = prompt('ใส่ข้อความตอบด่วนใหม่:'); if (val) addTemplate('quick', val); }} className="glass-interactive" style={{ padding: '10px 20px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: '#000', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={16} /> เพิ่มใหม่
                 </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                 {(profile?.quick_replies || []).map((text: string, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                       <p style={{ fontSize: '14px', flex: 1, fontWeight: '500' }}>{text}</p>
                       <button onClick={() => removeTemplate('quick', idx)} style={{ padding: '8px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                    </div>
                 ))}
                 {(profile?.quick_replies || []).length === 0 && <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)' }}>ยังไม่มีเทมเพลตส่วนตัว</div>}
              </div>
            </div>

            {/* Resolution Templates */}
            <div className="glass" style={{ padding: '32px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                     <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '10px', borderRadius: '12px' }}>
                        <ClipboardCheck size={24} color="#28c76f" />
                     </div>
                     <div>
                        <h2 style={{ fontSize: '20px', fontWeight: '700' }}>เทมเพลตสรุปงาน</h2>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Efficiency Tools</p>
                     </div>
                  </div>
                  <button onClick={() => { const val = prompt('ใส่ข้อความสรุปงานใหม่:'); if (val) addTemplate('res', val); }} className="glass-interactive" style={{ padding: '10px 20px', borderRadius: '12px', background: '#28c76f', border: 'none', color: '#fff', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <Plus size={16} /> เพิ่มใหม่
                  </button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(profile?.resolution_templates || []).map((text: string, idx: number) => (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '16px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px' }}>
                        <p style={{ fontSize: '14px', flex: 1, fontWeight: '500' }}>{text}</p>
                        <button onClick={() => removeTemplate('res', idx)} style={{ padding: '8px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={18} /></button>
                     </div>
                  ))}
                  {(profile?.resolution_templates || []).length === 0 && <div style={{ padding: '40px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '16px', color: 'var(--text-muted)' }}>ยังไม่มีเทมเพลตส่วนตัว</div>}
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'flex-start', animation: 'fadeIn 0.3s' }}>
          {/* Security & Password */}
          <div className="glass" style={{ padding: '40px', width: '100%', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'rgba(234, 84, 85, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <Lock size={24} color="var(--danger)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700' }}>บัญชีและความปลอดภัย</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Secured Authentication</p>
               </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>อีเมลเข้าใช้งาน</label>
               <div style={{ padding: '18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <Mail size={20} color="var(--text-muted)" />
                 <span style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '16px' }}>{profile?.email}</span>
               </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
               <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>เปลี่ยนรหัสผ่านใหม่</h3>
               <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="รหัสผ่านใหม่" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', fontWeight: '700' }} />
               <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="ยืนยันรหัสผ่านใหม่" style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', fontWeight: '700' }} />
               <button type="submit" disabled={updatingPassword} className="glass-interactive" style={{ width: '100%', padding: '18px', borderRadius: '16px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid rgba(234, 84, 85, 0.2)', color: 'var(--danger)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
                 {updatingPassword ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={22} /> อัปเดตรหัสผ่านใหม่</>}
               </button>
            </form>
          </div>
        </div>
      )}

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
