'use client';

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
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Spooky',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Precious',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Simba',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Cookie',
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

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await supabase.from('profiles').update({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        department: profile.department,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      alert('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
    } catch (err) {
      alert('Update failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      await supabase.from('company_settings').upsert({
        id: company?.id,
        company_name: company.company_name,
        logo_url: company.logo_url,
        updated_at: new Date().toISOString()
      });
      alert('บันทึกข้อมูลองค์กรเรียบร้อยแล้ว');
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
                  <User size={24} color="white" />
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
                  <div style={{ position: 'absolute', bottom: '-10px', right: '-10px', background: 'var(--primary)', padding: '8px', borderRadius: '12px', cursor: 'pointer', boxShadow: '0 4px 15px rgba(0,242,254,0.4)' }}>
                     <Camera size={20} color="#0a0e14" />
                  </div>
               </div>
               <p style={{ marginTop: '16px', fontSize: '14px', color: 'var(--text-muted)' }}>เลือก Avatar หรืออัปโหลดรูปของคุณ</p>
               
               <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
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
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>แผนก (DEPARTMENT)</label>
                  <select 
                    value={profile?.department || ''} 
                    onChange={e => setProfile({...profile, department: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none', appearance: 'none' }}
                  >
                    <option value="">เลือกแผนก...</option>
                    {DEPARTMENTS.map((dept, idx) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                  </select>
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Avatar URL</label>
                  <input 
                    type="text" 
                    placeholder="Enter image URL..."
                    value={profile?.avatar_url || ''} 
                    onChange={e => setProfile({...profile, avatar_url: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <button 
                onClick={handleSaveProfile}
                disabled={saving}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> บันทึกข้อมูลส่วนตัว</>}
               </button>
            </div>
         </div>

         {/* 2. Company Branding */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="#0a0e14" />
               </div>
               <h2 style={{ fontSize: '20px', fontWeight: '700' }}>Company Branding</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
               <div className="glass" style={{ width: '100%', height: '120px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '12px' }}>
                  {company?.logo_url ? (
                    <img src={company.logo_url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                       <Building size={48} color="var(--border)" />
                       <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>No Logo Uploaded</p>
                    </div>
                  )}
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Company Name</label>
                  <input 
                    type="text" 
                    value={company?.company_name || ''} 
                    onChange={e => setCompany({...company, company_name: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Company Logo URL</label>
                  <input 
                    type="text" 
                    placeholder="Enter logo image URL..."
                    value={company?.logo_url || ''} 
                    onChange={e => setCompany({...company, logo_url: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'white', outline: 'none' }}
                  />
               </div>
               <button 
                onClick={handleSaveCompany}
                disabled={saving}
                className="glass-interactive" 
                style={{ width: '100%', padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Update Branding</>}
               </button>
            </div>

            <div className="glass" style={{ padding: '16px', marginTop: '32px', border: '1px solid rgba(0, 242, 254, 0.2)' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                     Logo will be displayed on the <strong>Sidebar</strong> and <strong>Customer Reports</strong> automatically.
                  </p>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
