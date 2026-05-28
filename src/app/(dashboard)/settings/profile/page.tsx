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
  Trash2,
  CheckCircle,
  PenTool,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import { auditService } from '@/lib/services/auditService';
import { SignaturePad } from '@/components/profile/SignaturePad';
import { ImageCropper } from '@/components/profile/ImageCropper';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

const AVATAR_SEEDS = [
  'Ariel', 'Willow', 'Casper', 'Sasha', 'Jasper', 'Zoey', 'Felix', 'Luna',
  'Simba', 'Nala', 'Coco', 'Ruby', 'Milo', 'Cleo', 'Jack', 'Oliver',
  'Midnight', 'Shadow', 'Ginger', 'Snowball', 'Pepper', 'Sunny', 'Cookie', 'Bear',
  'Charlie', 'Daisy', 'Max', 'Bella', 'Rocky', 'Lola'
];

const PROFILE_COLORS = [
  '#00f2fe', // primary
  '#28c76f', // green
  '#ea5455', // red
  '#ff9f43', // orange
  '#7367f0', // purple
  '#3699ff', // blue
  '#e83e8c', // pink
  '#20c997', // teal
  '#6610f2', // indigo
  '#fd7e14', // rust
  '#ffc107', // yellow
  '#17a2b8', // cyan
  '#6f42c1', // violet
  '#d63384', // magenta
  '#0dcaf0', // light blue
  '#198754', // dark green
  '#dc3545', // dark red
  '#ffc0cb', // light pink
  '#8b4513', // saddle brown
  '#483d8b', // dark slate blue
  '#008080', // pure teal
  '#556b2f', // dark olive green
  '#4682b4', // steel blue
  '#c71585'  // medium violet red
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
  const { t } = useStaffLocale();
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
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

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

     // Read file as data URL to pass to cropper
     const reader = new FileReader();
     reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || null));
     reader.readAsDataURL(file);
     
     // Reset input so the same file can be selected again if canceled
     event.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
     setCropImageSrc(null);
     setUploading(true);
     try {
        const fileExt = croppedFile.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `profile/${fileName}`;

        const { error: uploadError } = await supabase.storage
           .from('chat_media') 
           .upload(filePath, croppedFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
        setProfile({ ...profile, avatar_url: publicUrl });
        
        setToastMsg(t('common.messages.success'));
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
     } catch (err: any) {
        alert(t('common.messages.error') + ': ' + (err.message || 'Error'));
     } finally {
        setUploading(false);
     }
  };

  const handleSignatureSave = async (dataUrl: string) => {
    setSaving(true);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `signature_${profile.id}.png`, { type: 'image/png' });
      
      const filePath = `signatures/${profile.id}_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from('chat_media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      
      const { error } = await supabase.from('profiles').update({
        signature_url: publicUrl,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, signature_url: publicUrl });
      setToastMsg(t('common.messages.saveSuccess'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = async (file: File) => {
    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `signatures/${profile.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('chat_media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      
      const { error } = await supabase.from('profiles').update({
        signature_url: publicUrl,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, signature_url: publicUrl });
      setToastMsg(t('common.messages.saveSuccess'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        department: profile.department,
        theme_color: profile.theme_color,
        signature_url: profile.signature_url,
        quick_replies: profile.quick_replies || [],
        resolution_templates: profile.resolution_templates || [],
        auto_logout_minutes: profile.auto_logout_minutes ?? 0,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      if (error) throw error;
      await auditService.log({
        performer_id: profile.id,
        action_type: 'PROFILE_UPDATE',
        entity_type: 'PROFILE',
        entity_id: profile.id,
        new_data: { 
          full_name: profile.full_name, 
          department: profile.department,
          avatar_url: profile.avatar_url,
          theme_color: profile.theme_color,
          signature_url: profile.signature_url,
          auto_logout_minutes: profile.auto_logout_minutes ?? 0
        },
        note: `Updated own profile information`
      });
      setToastMsg(t('common.messages.saveSuccess'));
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert(t('common.messages.saveFailed'));
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

    try {
      const { error } = await supabase.from('profiles').update({
        [key]: updatedList,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);
      
      if (!error) {
        await auditService.log({
          performer_id: profile.id,
          action_type: 'TEMPLATE_ADD',
          entity_type: 'PROFILE_TEMPLATE',
          new_data: { type, text },
          note: `Added new ${type === 'quick' ? 'Quick Reply' : 'Resolution Template'}`
        });
        setToastMsg(t('common.messages.saveSuccess'));
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

    try {
      const { error } = await supabase.from('profiles').update({
        [key]: next,
        updated_at: new Date().toISOString()
      }).eq('id', profile.id);

      if (!error) {
        await auditService.log({
          performer_id: profile.id,
          action_type: 'TEMPLATE_DELETE',
          entity_type: 'PROFILE_TEMPLATE',
          new_data: { type, index },
          note: `Removed ${type === 'quick' ? 'Quick Reply' : 'Resolution Template'}`
        });
        setToastMsg(t('common.messages.deleteSuccess'));
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
      alert(t('settingsProfile.messages.passMismatch'));
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setToastMsg(t('common.messages.success'));
      setShowToast(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowToast(false), 3000);
    } catch (err: any) {
      alert(t('common.messages.error') + ': ' + err.message);
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
              <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{t('settingsProfile.title')}</h1>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '2px' }}>{t('settingsProfile.subtitle')}</p>
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
          {t('settingsProfile.profileTab')}
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
          {t('settingsProfile.securityTab')}
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', 
          gap: '24px', 
          animation: 'slideUp 0.4s ease-out',
          alignItems: 'start'
        }}>
          
          {/* 1. Identity Column */}
          <div className="glass" style={{ padding: '24px', height: 'fit-content' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
               <div style={{ background: 'var(--secondary)', padding: '8px', borderRadius: '10px' }}>
                   <User size={20} color="var(--primary)" />
               </div>
               <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{t('settingsProfile.profileSection')}</h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ position: 'relative', marginBottom: '20px' }}>
                 <img 
                   src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
                   style={{ width: '110px', height: '110px', borderRadius: '50%', objectFit: 'cover', border: '4px solid var(--border)', background: 'var(--bg-deep)' }} 
                 />
                 <label style={{ position: 'absolute', bottom: '0', right: '0', background: 'var(--primary)', padding: '8px', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,242,254,0.4)', border: '3px solid var(--bg-card)' }}>
                    {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} color="#000" />}
                    <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                 </label>
              </div>

              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(6, 1fr)', 
                gap: '6px', 
                padding: '12px', 
                borderRadius: '16px', 
                border: '1px solid var(--border)', 
                background: 'rgba(255,255,255,0.01)',
                maxHeight: '100px',
                overflowY: 'auto'
              }}>
                {AVATAR_OPTIONS.map((url, idx) => (
                   <button key={idx} onClick={() => setProfile({...profile, avatar_url: url})} style={{ width: '28px', height: '28px', borderRadius: '6px', overflow: 'hidden', border: profile?.avatar_url === url ? '2px solid var(--primary)' : '1px solid transparent', padding: 0, cursor: 'pointer' }}>
                     <img src={url} style={{ width: '100%', height: '100%' }} />
                   </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsProfile.fullName')}</label>
                  <input type="text" value={profile?.full_name || ''} onChange={e => setProfile({...profile, full_name: e.target.value})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-main)', outline: 'none', fontWeight: '700', fontSize: '14px' }} />
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsProfile.department')}</label>
                  <select value={profile?.department || ''} onChange={e => setProfile({...profile, department: e.target.value})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-main)', outline: 'none', fontWeight: '700', fontSize: '14px' }}>
                    <option value="">{t('settingsProfile.selectDepartment')}</option>
                    {companyDepts.map((d: string) => (<option key={d} value={d}>{d}</option>))}
                  </select>
               </div>
               <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsProfile.autoLogout')}</label>
                  <select value={profile?.auto_logout_minutes ?? 0} onChange={e => setProfile({...profile, auto_logout_minutes: parseInt(e.target.value) || 0})} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', color: 'var(--text-main)', outline: 'none', fontWeight: '700', fontSize: '14px' }}>
                    <option value={0}>{t('settingsProfile.autoLogoutNever')}</option>
                    <option value={5}>{t('settingsProfile.autoLogout5Min')}</option>
                    <option value={15}>{t('settingsProfile.autoLogout15Min')}</option>
                    <option value={30}>{t('settingsProfile.autoLogout30Min')}</option>
                    <option value={60}>{t('settingsProfile.autoLogout1Hour')}</option>
                    <option value={120}>{t('settingsProfile.autoLogout2Hours')}</option>
                  </select>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.4' }}>
                    {t('settingsProfile.autoLogoutHint')}
                  </span>
               </div>

               <div>
                   <label style={{ display: 'block', fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>สีประจำตัว (Theme Color)</label>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '12px 8px', padding: '12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', justifyItems: 'center', alignItems: 'center' }}>
                     {PROFILE_COLORS.map(color => (
                       <button
                         key={color}
                         onClick={() => setProfile({...profile, theme_color: color})}
                         style={{
                           width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
                           background: color, border: profile?.theme_color === color ? '3px solid white' : '2px solid transparent',
                           boxShadow: profile?.theme_color === color ? `0 0 0 2px ${color}` : 'none',
                           transition: 'transform 0.15s ease'
                         }}
                       />
                     ))}
                   </div>
               </div>
               
               <button 
                onClick={handleSaveProfile}
                disabled={saving || uploading}
                className="glass-interactive" 
                style={{ width: '100%', padding: '14px', borderRadius: '14px', background: 'var(--primary)', border: 'none', color: '#000', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px', fontSize: '14px' }}>
                  {saving ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} /> {t('settingsProfile.saveProfile')}</>}
               </button>
            </div>
          </div>

          {/* 2. Digital Signature Column */}
          <div className="glass" style={{ padding: '24px', height: 'fit-content' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '8px', borderRadius: '10px' }}>
                   <PenTool size={20} color="var(--primary)" />
                </div>
                <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{t('settingsProfile.signatureSection')}</h2>
             </div>
             <SignaturePad 
                initialValue={profile?.signature_url} 
                onSave={handleSignatureSave} 
                onUpload={handleSignatureUpload} 
             />
          </div>

          {/* 3. Workflow Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Compact Quick Replies */}
            <div className="glass" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '8px', borderRadius: '10px' }}>
                       <MessageSquarePlus size={20} color="var(--primary)" />
                    </div>
                    <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{t('settingsProfile.quickReplies')}</h2>
                 </div>
                 <button onClick={() => { const val = prompt(t('settingsProfile.addQuickReplyPrompt')); if (val) addTemplate('quick', val); }} className="glass-interactive" style={{ padding: '6px 14px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#000', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Plus size={14} /> {t('settingsProfile.add')}
                 </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                 {(profile?.quick_replies || []).map((text: string, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                       <p style={{ fontSize: '13px', flex: 1, fontWeight: '500', margin: 0 }}>{text}</p>
                       <button onClick={() => removeTemplate('quick', idx)} style={{ padding: '4px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                    </div>
                 ))}
                 {(profile?.quick_replies || []).length === 0 && <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settingsProfile.noData')}</div>}
              </div>
            </div>

            {/* Compact Resolution Templates */}
            <div className="glass" style={{ padding: '24px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '8px', borderRadius: '10px' }}>
                        <ClipboardCheck size={20} color="#28c76f" />
                     </div>
                     <h2 style={{ fontSize: '16px', fontWeight: '700' }}>{t('settingsProfile.resolutionTemplates')}</h2>
                  </div>
                  <button onClick={() => { const val = prompt(t('settingsProfile.addResolutionTemplatePrompt')); if (val) addTemplate('res', val); }} className="glass-interactive" style={{ padding: '6px 14px', borderRadius: '10px', background: '#28c76f', border: 'none', color: '#fff', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
                     <Plus size={14} /> {t('settingsProfile.add')}
                  </button>
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                  {(profile?.resolution_templates || []).map((text: string, idx: number) => (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <p style={{ fontSize: '13px', flex: 1, fontWeight: '500', margin: 0 }}>{text}</p>
                        <button onClick={() => removeTemplate('res', idx)} style={{ padding: '4px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer' }}><Trash2 size={16} /></button>
                     </div>
                  ))}
                  {(profile?.resolution_templates || []).length === 0 && <div style={{ padding: '20px', textAlign: 'center', border: '1px dashed var(--border)', borderRadius: '12px', color: 'var(--text-muted)', fontSize: '12px' }}>{t('settingsProfile.noData')}</div>}
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
                 <h2 style={{ fontSize: '20px', fontWeight: '700' }}>{t('settingsProfile.securitySection')}</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('settingsProfile.securitySubtitle')}</p>
               </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>{t('settingsProfile.email')}</label>
               <div style={{ padding: '18px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                 <Mail size={20} color="var(--text-muted)" />
                 <span style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '16px' }}>{profile?.email}</span>
               </div>
            </div>

            <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '20px', borderTop: '1px solid var(--border)', paddingTop: '32px' }}>
               <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '4px' }}>{t('settingsProfile.changePassword')}</h3>
               <input type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('settingsProfile.newPasswordPlaceholder')} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', fontWeight: '700' }} />
               <input type="password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder={t('settingsProfile.confirmPasswordPlaceholder')} style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px', fontWeight: '700' }} />
               <button type="submit" disabled={updatingPassword} className="glass-interactive" style={{ width: '100%', padding: '18px', borderRadius: '16px', background: 'rgba(234, 84, 85, 0.1)', border: '1px solid rgba(234, 84, 85, 0.2)', color: 'var(--danger)', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '8px' }}>
                 {updatingPassword ? <Loader2 className="animate-spin" /> : <><ShieldCheck size={22} /> {t('settingsProfile.updatePassword')}</>}
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

      {cropImageSrc && (
        <ImageCropper 
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
