'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Save, 
  Loader2, 
  ChevronLeft,
  ShieldCheck,
  Building,
  Camera,
  Trash2,
  Plus
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

export default function BrandingSettingsPage() {
  const { t } = useStaffLocale();
  const { userProfile } = useAppContext();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useNotificationContext();

  const canEdit = React.useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_branding === 'edit';
  }, [userProfile]);

  useEffect(() => {
    async function fetchData() {
      const { data: c } = await supabase.from('company_settings').select('*').limit(1).single();
      if (c && !c.modules) {
        c.modules = [
          "ห้องทำงานแพทย์", "ห้องพยาบาล", "ห้องยาผู้ป่วยใน", "ห้องเวชระเบียน", "ห้องผ่าตัด", "ห้องวิสัญญี", "ห้อง Consult", "All"
        ];
      }
      setCompany(c);
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
        const filePath = `company/${fileName}`;

        const { error: uploadError } = await supabase.storage
           .from('chat_media') 
           .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(filePath);
        setCompany({ ...company, logo_url: publicUrl });
        addToast({
           id: 'logo-upload',
           type: 'ticket',
           title: 'Success! 🖼️',
           body: 'อัปโหลดโลโก้สำเร็จเรียบร้อยแล้ว'
        });
     } catch (err: any) {
        alert('อัปโหลดล้มเหลว: ' + (err.message || 'Error uploading file'));
     } finally {
        setUploading(false);
     }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      if (company?.id) {
         const { error } = await supabase.from('company_settings').update({
            company_name: company.company_name,
            logo_url: company.logo_url,
            updated_at: new Date().toISOString()
          }).eq('id', company.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('company_settings').insert([{
            company_name: company.company_name,
            logo_url: company.logo_url
          }]);
         if (error) throw error;
      }
      // Log the update (Secondary operation, don't let it block success)
      try {
        const { auditService } = await import('@/lib/services/auditService');
        const { data: { user } } = await supabase.auth.getUser();
        await auditService.log({
          performer_id: user?.id,
          action_type: 'BRANDING_UPDATE',
          entity_type: 'COMPANY',
          entity_id: company?.id,
          new_data: { 
            company_name: company?.company_name, 
            logo_url: company?.logo_url 
          },
          note: `Updated corporate branding and logo`
        });
      } catch (logErr) {
        console.error('Logging failed:', logErr);
      }

      addToast({
        id: 'branding-save',
        type: 'ticket',
        title: 'Success! ✅',
        body: 'บันทึกข้อมูลองค์กรเรียบร้อยแล้ว'
      });
    } catch (err: any) {
      console.error('Save failed details:', err);
      // Detailed error for better debugging
      const errorMsg = err.message || err.details || 'Unknown database error';
      alert(`บันทึกไม่สำเร็จ: ${errorMsg}\n\n(หากคุณเห็นข้อความนี้ทันทีหลังจากทำ Migration กรุณากด Refresh หน้าเว็บหนึ่งครั้งครับ)`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-page-in">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
          <Skeleton width={32} height={32} borderRadius="50%" />
          <Skeleton width={400} height={32} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
          {[1, 2].map(i => (
            <div key={i} className="glass" style={{ padding: '32px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
                <Skeleton width={44} height={44} borderRadius={12} />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={24} marginBottom={8} />
                  <Skeleton width="40%" height={12} />
                </div>
              </div>
              <Skeleton width="100%" height={180} borderRadius={16} marginBottom={32} />
              <Skeleton width="100%" height={16} marginBottom={12} />
              <Skeleton width="100%" height={48} borderRadius={10} marginBottom={24} />
              <Skeleton width="100%" height={56} borderRadius={12} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-page-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
         <Link href="/" className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-muted)', display: 'flex', textDecoration: 'none' }}><ChevronLeft size={20} /></Link>
         <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>{t('settingsBranding.title')}</h1>
      </div>

     <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 600px)', gap: '32px', justifyContent: 'center' }}>
         {/* 1. Company Branding */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="#0a0e14" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>{t('settingsBranding.sectionTitle')}</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('settingsBranding.sectionSubtitle')}</p>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '32px' }}>
               <div className="glass" style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '180px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  overflow: 'hidden', 
                  padding: '24px', 
                  background: 'rgba(0,0,0,0.1)', 
                  backgroundImage: 'radial-gradient(var(--border) 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                  borderRadius: '16px',
                  border: '1px solid var(--border)'
               }}>
                  {company?.logo_url ? (
                    <img src={company.logo_url} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center' }}>
                       <Building size={48} color="var(--border)" />
                       <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>{t('settingsBranding.noLogo')}</p>
                    </div>
                  )}
                  <label 
                     className="glass-interactive flex-center"
                     style={{ 
                      position: 'absolute', bottom: '12px', right: '12px', 
                      background: 'var(--primary)', padding: '0 20px', height: '40px', borderRadius: '10px', 
                      cursor: !canEdit ? 'not-allowed' : 'pointer', boxShadow: '0 8px 20px rgba(0, 242, 254, 0.3)',
                      gap: '8px', fontSize: '13px', fontWeight: '850', border: 'none', color: 'black',
                      opacity: !canEdit ? 0.5 : 1
                   }}>
                     {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
                     <span>{uploading ? t('settingsBranding.uploading') : t('settingsBranding.changeLogo')}</span>
                     <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading || !canEdit} />
                  </label>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{t('settingsBranding.companyName')}</label>
                  <input 
                    type="text" 
                    placeholder={t('settingsBranding.companyNamePlaceholder')}
                    value={company?.company_name || ''} 
                    onChange={e => setCompany({...(company || {}), company_name: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '600' }}
                  />
               </div>
               <button 
                onClick={handleSaveCompany}
                disabled={saving || uploading || !canEdit}
                className="glass-interactive" 
                style={{ width: '100%', height: '56px', borderRadius: '14px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px', boxShadow: '0 8px 30px rgba(0, 242, 254, 0.2)', opacity: !canEdit ? 0.5 : 1, cursor: !canEdit ? 'not-allowed' : 'pointer' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> {t('settingsBranding.saveBranding')}</>}
               </button>
            </div>

            <div style={{ padding: '16px', marginTop: '24px', background: 'rgba(54, 153, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(54, 153, 255, 0.1)' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-main)', fontWeight: '700' }}>{t('settingsBranding.infoTitle')}</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                       {t('settingsBranding.infoBody')}
                    </p>
                    <Link href="/settings/master" style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: '800', marginTop: '8px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                       {t('settingsBranding.manageMasterData')} →
                    </Link>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
