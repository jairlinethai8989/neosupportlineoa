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
  Building
} from 'lucide-react';
import Link from 'next/link';

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/notionists/svg?seed=Programmer1&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Coder2&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Dev3&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Techie4&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Hacker5&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Engineer6&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Ninja7&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Geek8&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Nerd9&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/notionists/svg?seed=Builder10&backgroundColor=f1f5f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGirl1&clothing=blazerAndShirt&accessories=prescription02&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGuy2&clothing=hoodie&accessories=round&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGirl3&clothing=overall&hair=longButNotTooLong&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGuy4&clothing=blazerAndSweater&facialHair=beardLight&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGirl5&clothing=shirtScoopNeck&accessories=kurt&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGuy6&clothing=shirtVNeck&facialHair=moustacheMagnum&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGirl7&clothing=shirtCrewNeck&hair=dreads&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGuy8&clothing=collarSweater&accessories=sunglasses&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGirl9&clothing=blazerAndShirt&hair=shortCurly&backgroundColor=f8fafc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=DevGuy10&clothing=hoodie&accessories=prescription01&backgroundColor=f8fafc',
];

const DEPARTMENTS = [
  'ฝ่ายสนับสนุนลูกค้า (Customer Support)',
  'ฝ่ายเทคนิค (Technical Support)',
  'ฝ่ายขายและการเงิน (Sales & Billing)',
  'ฝ่ายบริหาร (Management)'
];

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

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

        const { error: uploadError, data } = await supabase.storage
           .from('public') // Assuming 'public' bucket exists
           .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('public').getPublicUrl(filePath);

        if (target === 'profile') {
           setProfile({ ...profile, avatar_url: publicUrl });
        } else {
           setCompany({ ...company, logo_url: publicUrl });
        }
        
        setToastMsg('ไฟล์อัปโหลดสำเร็จ! 🎉');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
     } catch (err: any) {
        alert('File upload failed: ' + err.message);
     } finally {
        setUploading(false);
     }
  };

  const handleSaveProfile = async () => {
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
    } catch (err) {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      if (company?.id) {
         await supabase.from('company_settings').update({
           company_name: company.company_name,
           logo_url: company.logo_url,
           updated_at: new Date().toISOString()
         }).eq('id', company.id);
      } else {
         await supabase.from('company_settings').insert([{
           company_name: company.company_name,
           logo_url: company.logo_url
         }]);
      }
      setToastMsg('บันทึกข้อมูลองค์กรสำเร็จ! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert('Update failed');
    } finally {
      setSaving(false);
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
                  <img 
                    src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
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
                     onClick={() => setProfile({...profile, avatar_url: url})}
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
                      <img src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                    onChange={e => setProfile({...profile, full_name: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text)', outline: 'none' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>แผนก (DEPARTMENT)</label>
                  <select 
                    value={profile?.department || ''} 
                    onChange={e => setProfile({...profile, department: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text)', outline: 'none', appearance: 'none' }}
                  >
                    <option value="">เลือกแผนก...</option>
                    {DEPARTMENTS.map((dept, idx) => (
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
                    <img src={company.logo_url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
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
                    onChange={e => setCompany({...company, company_name: e.target.value})}
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
