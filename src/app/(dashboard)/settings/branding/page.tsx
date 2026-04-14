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
  Trash2
} from 'lucide-react';
import Link from 'next/link';
import Skeleton from '@/components/ui/Skeleton';

export default function BrandingSettingsPage() {
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newDeptName, setNewDeptName] = useState('');

  useEffect(() => {
    async function fetchData() {
      const { data: c } = await supabase.from('company_settings').select('*').limit(1).single();
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
        
        setToastMsg('อัปโหลดโลโก้สำเร็จ! 🎉');
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);
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
           departments: company.departments || [],
           updated_at: new Date().toISOString()
         }).eq('id', company.id);
         if (error) throw error;
      } else {
         const { error } = await supabase.from('company_settings').insert([{
           company_name: company.company_name,
           logo_url: company.logo_url,
           departments: company.departments || []
         }]);
         if (error) throw error;
      }
      // Log the update
      const { auditService } = await import('@/lib/services/auditService');
      await auditService.log({
        performer_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'BRANDING_UPDATE',
        entity_type: 'COMPANY',
        entity_id: company.id,
        new_data: { 
          company_name: company.company_name, 
          logo_url: company.logo_url 
        },
        note: `Updated corporate branding and logo`
      });

      setToastMsg('บันทึกข้อมูลองค์กรเรียบร้อย! ✅');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      alert('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    const updatedDepts = [...(company?.departments || []), newDeptName.trim()];
    setCompany({ ...company, departments: updatedDepts });
    setNewDeptName('');
    
    try {
      await supabase.from('company_settings').update({ 
        departments: updatedDepts,
        updated_at: new Date().toISOString() 
      }).eq('id', company.id);
      
      // Log the addition
      const { auditService } = await import('@/lib/services/auditService');
      await auditService.log({
        performer_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'DEPT_CREATE',
        entity_type: 'DEPARTMENT',
        new_data: { department: newDeptName.trim() },
        note: `Added new department: ${newDeptName.trim()}`
      });

      setToastMsg('เพิ่มแผนกเรียบร้อย! ✨');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) { alert('Failed to add department'); }
  };

  const handleDeleteDepartment = async (name: string) => {
    if (!confirm(`ยืนยันการลบแผนก "${name}"?`)) return;
    const updatedDepts = (company?.departments || []).filter((d: string) => d !== name);
    setCompany({ ...company, departments: updatedDepts });

    try {
      await supabase.from('company_settings').update({ 
        departments: updatedDepts,
        updated_at: new Date().toISOString() 
      }).eq('id', company.id);
      
      setToastMsg('ลบแผนกเรียบร้อย! 🗑️');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) { alert('Failed to delete department'); }
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
         <Link href="/" style={{ color: 'var(--text-muted)', display: 'flex' }} className="glass-interactive flex-center" style={{ width: '40px', height: '40px', borderRadius: '50%', color: 'var(--text-muted)' }}><ChevronLeft size={20} /></Link>
         <h1 style={{ fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>ตราสินค้าองค์กร</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>
         {/* 1. Company Branding */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="#0a0e14" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ข้อมูลองค์กร</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Corporate Identity Settings</p>
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
                       <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>โลโก้องค์กร (No Logo)</p>
                    </div>
                  )}
                  <label 
                     className="glass-interactive flex-center"
                     style={{ 
                      position: 'absolute', bottom: '12px', right: '12px', 
                      background: 'var(--primary)', padding: '0 20px', height: '40px', borderRadius: '10px', 
                      cursor: 'pointer', boxShadow: '0 8px 20px rgba(0, 242, 254, 0.3)',
                      gap: '8px', fontSize: '13px', fontWeight: '850', border: 'none', color: 'black'
                   }}>
                     {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={18} />}
                     <span>{uploading ? 'UPLOADING...' : 'CHANGE LOGO'}</span>
                     <input type="file" hidden accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                  </label>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
               <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>ชื่อบริษัท/องค์กร (COMPANY NAME)</label>
                  <input 
                    type="text" 
                    placeholder="Enter company name..."
                    value={company?.company_name || ''} 
                    onChange={e => setCompany({...company, company_name: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '600' }}
                  />
               </div>
               <button 
                onClick={handleSaveCompany}
                disabled={saving || uploading}
                className="glass-interactive" 
                style={{ width: '100%', height: '56px', borderRadius: '14px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '12px', boxShadow: '0 8px 30px rgba(0, 242, 254, 0.2)' }}>
                  {saving ? <Loader2 className="animate-spin" /> : <><Save size={20} /> ยืนยันข้อมูลองค์กร (SAVE BRANDING)</>}
               </button>
            </div>

            <div style={{ padding: '16px', marginTop: '24px', background: 'rgba(54, 153, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(54, 153, 255, 0.1)' }}>
               <div style={{ display: 'flex', gap: '12px' }}>
                  <ShieldCheck size={18} color="var(--primary)" />
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                     ข้อมูลเหล่านี้จะถูกนำไปใช้ในหน้า **Dashboard**, **Sidebar** และ **เอกสารรายงาน** ทั่วทั้งระบบแบบเรียลไทม์
                  </p>
               </div>
            </div>
         </div>

         {/* 2. Department Management */}
         <div className="glass" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: 'rgba(54, 153, 255, 0.1)', padding: '10px', borderRadius: '12px' }}>
                  <Building size={24} color="var(--primary)" />
               </div>
               <div>
                 <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>จัดการแผนก</h2>
                 <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Department Structures</p>
               </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
               <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>เพิ่มประเภทแผนก (ADD DEPARTMENT)</label>
               <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="ระบุชื่อแผนกที่ต้องการ..." 
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddDepartment()}
                    style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px', color: 'var(--text-main)', outline: 'none', fontWeight: '600' }}
                  />
                  <button 
                    onClick={handleAddDepartment}
                    className="glass-interactive flex-center"
                    style={{ width: '52px', height: '52px', borderRadius: '10px', background: 'var(--primary)', color: 'black', border: 'none' }}>
                    <Plus size={24} />
                  </button>
               </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '430px', overflowY: 'auto', paddingRight: '8px' }} className="no-scrollbar">
               <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>หมวดหมู่แผนกที่เปิดใช้งาน ({company?.departments?.length || 0})</label>
               {company?.departments?.map((dept: string, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                     <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-main)' }}>{dept}</span>
                     <button 
                       onClick={() => handleDeleteDepartment(dept)}
                       style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                       <Trash2 size={16} />
                       <span style={{ fontSize: '11px', fontWeight: '800' }}>ลบ</span>
                     </button>
                  </div>
               ))}
               {(!company?.departments || company.departments.length === 0) && (
                  <div style={{ textAlign: 'center', padding: '40px', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px dashed var(--border)' }}>
                     <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>ยังไม่มีการกำหนดแผนกในระบบ</p>
                  </div>
               )}
            </div>
         </div>
      </div>

      {/* Success Toast */}
      {showToast && (
        <div style={{
          position: 'fixed', bottom: '32px', right: '32px', background: 'var(--primary)', color: 'black', 
          padding: '16px 28px', borderRadius: '16px', fontWeight: '900', display: 'flex', alignItems: 'center', 
          gap: '12px', boxShadow: '0 20px 50px rgba(0, 242, 254, 0.4)', zIndex: 9999, 
          animation: 'slideInRight var(--dur-main) var(--ease-out-back)'
        }}>
          <div style={{ position: 'absolute', bottom: 0, left: 0, height: '4px', background: 'rgba(0,0,0,0.2)', width: '100%', overflow: 'hidden' }}>
             <div style={{ height: '100%', background: 'black', width: '100%', animation: 'progressDrain 3s linear forwards' }} />
          </div>
          <ShieldCheck size={20} />
          {toastMsg}
        </div>
      )}
    </div>
  );
}
