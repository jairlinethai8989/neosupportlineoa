'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Building2, 
  Users, 
  Briefcase, 
  Plus, 
  Edit3, 
  Check, 
  X,
  Loader2,
  Search,
  Layout,
  FileText,
  Tag,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { FileSpreadsheet } from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

type Tab = 'hospitals' | 'departments' | 'hospital_depts' | 'positions' | 'modules' | 'issue_types' | 'subject_types' | 'line_groups' | 'google_sheets' | 'gemini_api';

export default function MasterSettingsPage() {
  const { t } = useStaffLocale();
  const { 
    hospitals: ctxHospitals, 
    departments: ctxDepartments, 
    companySettings: ctxGlobalSettings, 
    refreshData,
    userProfile
  } = useAppContext();

  const canEdit = React.useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_master === 'edit';
  }, [userProfile]);

  const { addToast } = useNotificationContext();

  const [activeTab, setActiveTab] = useState<Tab>('hospitals');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  
  const [hospitals, setHospitals] = useState<any[]>(ctxHospitals);
  const [globalSettings, setGlobalSettings] = useState<any>(ctxGlobalSettings);
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAbbr, setNewItemAbbr] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemAbbr, setEditItemAbbr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setHospitals(ctxHospitals);
  }, [ctxHospitals]);

  useEffect(() => {
    setGlobalSettings(ctxGlobalSettings);
  }, [ctxGlobalSettings]);
  
  const getTableName = (tab: Tab): string => {
    if (tab === 'departments' || tab === 'hospital_depts') return 'departments';
    if (tab === 'modules') return 'ticket_modules';
    if (tab === 'issue_types') return 'ticket_issue_types';
    if (tab === 'subject_types') return 'ticket_subject_types';
    return tab;
  };

  const fetchData = React.useCallback(async () => {
    if (activeTab === 'hospitals') {
      setItems(ctxHospitals);
      return;
    }

    if (activeTab === 'departments' || activeTab === 'hospital_depts') {
      const filtered = activeTab === 'departments' 
        ? ctxDepartments.filter(d => d.dept_type === 'organization')
        : ctxDepartments.filter(d => d.dept_type === 'hospital');
      setItems(filtered);
      return;
    }

    if (activeTab === 'google_sheets') {
      setItems([]);
      return;
    }

    setLoading(true);
    const table = getTableName(activeTab);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      console.error('Fetch error:', e);
      addToast({
        id: `fetch-error-${Date.now()}`,
        type: 'ticket',
        title: 'Error loading data',
        body: e.message || 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, ctxHospitals, ctxDepartments, addToast]);

  useEffect(() => {
    fetchData();
    setIsAdding(false);
    setEditingId(null);
    setNewItemName('');
  }, [fetchData]);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setSubmitting(true);
    const table = getTableName(activeTab);

    const payload: any = { 
      name: newItemName, 
      is_active: true 
    };

    if (activeTab === 'hospitals') {
      payload.abbreviation = newItemAbbr.trim() || newItemName.slice(0, 10).toUpperCase();
      payload.ticket_prefix = `SRS_${payload.abbreviation}_`;
    }

    if (activeTab === 'line_groups') {
      payload.group_id = newItemAbbr.trim();
      if (!payload.group_id) {
        alert('กรุณาระบุ LINE Group ID');
        setSubmitting(false);
        return;
      }
    }

    if (activeTab === 'hospital_depts') {
      payload.dept_type = 'hospital';
    } else if (activeTab === 'departments') {
      payload.dept_type = 'organization';
    }

    const { error } = await supabase.from(table).insert([payload]);
    
    if (error) {
      console.error('Add Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message}`);
    } else {
      setNewItemName('');
      setNewItemAbbr('');
      setIsAdding(false);
      
      if (activeTab === 'hospitals') await refreshData('hospitals');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_CREATE',
        entity_type: table.toUpperCase(),
        new_data: payload,
        note: `Created new ${table}: ${newItemName} (${activeTab})`
      });

      addToast({
        id: `master-add-${table}-${newItemName}`,
        type: 'ticket',
        title: t('settingsMaster.addSuccessTitle'),
        body: t('settingsMaster.addSuccessBody').replace('{name}', newItemName),
      });
    }
    setSubmitting(false);
  };

  const handleUpdate = async (id: string) => {
    if (!editItemName.trim()) return;
    setSubmitting(true);
    const table = getTableName(activeTab);

    const updateData: any = { name: editItemName };
    if (activeTab === 'hospitals') {
      updateData.abbreviation = editItemAbbr.trim() || editItemName.slice(0, 10).toUpperCase();
    }
    if (activeTab === 'line_groups') {
      updateData.group_id = editItemAbbr.trim();
    }

    const { error } = await supabase.from(table).update(updateData).eq('id', id);
    
    if (error) {
      console.error('Update Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message}`);
    } else {
      setEditingId(null);
      
      if (activeTab === 'hospitals') await refreshData('hospitals');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_UPDATE',
        entity_type: table.toUpperCase(),
        entity_id: id,
        new_data: updateData,
        note: `Updated ${table} to: ${editItemName} ${activeTab === 'hospitals' ? `(${editItemAbbr})` : ''}`
      });

      addToast({
        id: `master-upd-${table}-${id}`,
        type: 'ticket',
        title: t('settingsMaster.updateSuccessTitle'),
        body: t('settingsMaster.updateSuccessBody').replace('{name}', editItemName),
      });
    }
    setSubmitting(false);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    const table = getTableName(activeTab);

    const { error } = await supabase.from(table).update({ is_active: !current }).eq('id', id);
    
    if (error) {
      console.error('Toggle status Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message}`);
    } else {
      if (activeTab === 'hospitals') await refreshData('hospitals');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_TOGGLE',
        entity_type: table.toUpperCase(),
        entity_id: id,
        new_data: { is_active: !current },
        note: `Toggled ${table} status to: ${!current ? 'Active' : 'Inactive'}`
      });

      addToast({
        id: `master-toggle-${id}`,
        type: 'ticket',
        title: t('settingsMaster.toggleSuccessTitle'),
        body: t('settingsMaster.toggleSuccessBody'),
      });
    }
  };

  const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  const TAB_CONFIG = {
    hospitals: { title: t('settingsMaster.tabs.hospitals'), icon: Building2, desc: t('settingsMaster.descriptions.hospitals') },
    departments: { title: t('settingsMaster.tabs.departments'), icon: Users, desc: t('settingsMaster.descriptions.departments') },
    hospital_depts: { title: t('settingsMaster.tabs.hospitalDepartments'), icon: Layout, desc: t('settingsMaster.descriptions.hospitalDepartments') },
    positions: { title: t('settingsMaster.tabs.positions'), icon: Briefcase, desc: t('settingsMaster.descriptions.positions') },
    modules: { title: t('settingsMaster.tabs.modules'), icon: FileText, desc: t('settingsMaster.descriptions.modules') },
    issue_types: { title: t('settingsMaster.tabs.issueTypes'), icon: Tag, desc: t('settingsMaster.descriptions.issueTypes') },
    subject_types: { title: t('settingsMaster.tabs.subjectTypes'), icon: MessageSquare, desc: t('settingsMaster.descriptions.subjectTypes') },
    line_groups: { title: t('settingsMaster.tabs.lineGroups'), icon: MessageSquare, desc: t('settingsMaster.descriptions.lineGroups') },
    google_sheets: { title: 'Google Sheets', icon: FileSpreadsheet, desc: 'ตั้งค่าการเชื่อมโยงรายงานไปยัง Google Sheets ประจำวัน' },
    gemini_api: { title: 'Gemini AI API', icon: Sparkles, desc: 'ตั้งค่า Gemini AI API Key สำหรับวิเคราะห์สรุปรายงานและคำแนะนำในสไลด์' }
  };

  const ActiveIcon = TAB_CONFIG[activeTab].icon;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
         <h1 style={{ fontSize: '28px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ActiveIcon size={32} color="var(--primary)" />
            {t('settingsMaster.title')}
         </h1>
         <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>{TAB_CONFIG[activeTab].desc}</p>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border)', width: 'fit-content', flexWrap: 'wrap' }}>
        {(['hospitals', 'departments', 'hospital_depts', 'positions', 'modules', 'issue_types', 'subject_types', 'line_groups', 'google_sheets', 'gemini_api'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '10px 20px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: '800',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === t ? 'var(--primary)' : 'transparent',
              color: activeTab === t ? 'black' : 'var(--text-muted)',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
             {React.createElement(TAB_CONFIG[t].icon, { size: 16 })}
             {TAB_CONFIG[t].title.split(' / ')[0]}
          </button>
        ))}
      </div>

      {/* Main Content Card */}
      {activeTab === 'google_sheets' ? (
        <GoogleSheetsConfigForm globalSettings={globalSettings} onSaveSuccess={() => refreshData('settings')} />
      ) : activeTab === 'gemini_api' ? (
        <GeminiConfigForm globalSettings={globalSettings} onSaveSuccess={() => refreshData('settings')} />
      ) : (
        <div className="glass" style={{ borderRadius: '24px', overflow: 'hidden' }}>
         {/* List Toolbar */}
         <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
               <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
               <input 
                 type="text" 
                 placeholder={`${t('settingsMaster.search')} ${TAB_CONFIG[activeTab].title}...`}
                 value={search}
                 onChange={e => setSearch(e.target.value)}
                 style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px 12px 48px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
               />
            </div>

            <button 
              onClick={() => setIsAdding(true)}
              disabled={!canEdit}
              style={{ background: 'var(--primary)', color: 'black', border: 'none', padding: '12px 20px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: !canEdit ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: !canEdit ? 0.5 : 1 }}
            >
               <Plus size={18} /> {t('settingsMaster.addItem')}
            </button>
         </div>

         {/* Add Form (Expandable) */}
         {isAdding && (
           <div style={{ padding: '24px', background: 'rgba(0, 242, 254, 0.03)', borderBottom: '1px solid var(--border)', animation: 'slideInRight 0.3s ease-out' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                 <input 
                   autoFocus
                   type="text" 
                   placeholder={`${t('settingsMaster.addItemNamed')} ${TAB_CONFIG[activeTab].title}...`}
                   value={newItemName}
                   onChange={e => setNewItemName(e.target.value)}
                   style={{ flex: 2, minWidth: '200px', background: 'rgba(255,255,255,0.1)', border: '1px solid var(--primary)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
                   onKeyDown={e => e.key === 'Enter' && handleAdd()}
                 />
                 
                 {(activeTab === 'hospitals' || activeTab === 'line_groups') && (
                   <input 
                     type="text" 
                     placeholder={activeTab === 'line_groups' ? 'LINE Group ID' : t('settingsMaster.abbreviation')} 
                     value={newItemAbbr}
                     onChange={e => setNewItemAbbr(e.target.value)}
                     style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '15px', outline: 'none' }}
                   />
                 )}

                 {activeTab === 'hospital_depts' && (
                   <select
                     value=""
                     onChange={() => {}}
                     style={{ flex: 1, minWidth: '150px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '15px', outline: 'none', cursor: 'pointer' }}
                   >
                     <option value="">{t('settingsMaster.selectHospital')}</option>
                     {hospitals.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                   </select>
                 )}

                 <button onClick={handleAdd} disabled={submitting} style={{ background: 'var(--primary)', border: 'none', width: '48px', minWidth: '48px', height: '48px', borderRadius: '12px', cursor: 'pointer', color: 'black' }} className="flex-center">
                    {submitting ? <Loader2 className="animate-spin" size={20} /> : <Check size={24} />}
                 </button>
                 <button onClick={() => setIsAdding(false)} style={{ background: 'rgba(234, 84, 85, 0.1)', border: 'none', width: '48px', minWidth: '48px', height: '48px', borderRadius: '12px', cursor: 'pointer', color: 'var(--danger)' }} className="flex-center">
                    <X size={24} />
                 </button>
              </div>
           </div>
         )}

         {/* Items List */}
         <div style={{ minHeight: '300px' }}>
            {loading ? (
               <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '16px' }}>
                  <Loader2 className="animate-spin" color="var(--primary)" size={40} />
                  <p style={{ color: 'var(--text-muted)' }}>{t('common.messages.loading')}</p>
               </div>
            ) : filteredItems.length === 0 ? (
               <div className="flex-center" style={{ height: '300px', flexDirection: 'column', gap: '16px', opacity: 0.5 }}>
                  <ActiveIcon size={48} />
                  <p>{t('common.messages.noResults')}</p>
               </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                 {filteredItems.map(item => (
                   <div key={item.id} style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.2s' }} className="hover-item">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                         <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ActiveIcon size={18} color={item.is_active ? 'var(--primary)' : 'var(--text-muted)'} />
                         </div>
                         
                          {editingId === item.id ? (
                           <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                             <input 
                               autoFocus
                               type="text" 
                               value={editItemName}
                               onChange={e => setEditItemName(e.target.value)}
                               style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '700', outline: 'none', width: '250px' }}
                               onKeyDown={e => e.key === 'Enter' && handleUpdate(item.id)}
                             />
                             {(activeTab === 'hospitals' || activeTab === 'line_groups') && (
                               <input 
                                 type="text" 
                                 placeholder={activeTab === 'line_groups' ? 'LINE Group ID' : "ย่อ"}
                                 value={editItemAbbr}
                                 onChange={e => setEditItemAbbr(e.target.value)}
                                 style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '14px', outline: 'none', width: '100px' }}
                                 onKeyDown={e => e.key === 'Enter' && handleUpdate(item.id)}
                               />
                             )}
                           </div>
                         ) : (
                           <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <p style={{ fontSize: '15px', fontWeight: '700', color: item.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{item.name}</p>
                                {(activeTab === 'hospitals' && item.abbreviation) && (
                                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-muted)' }}>
                                    {item.abbreviation}
                                  </span>
                                )}
                                {(activeTab === 'line_groups' && item.group_id) && (
                                  <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', color: 'var(--primary)' }}>
                                    {item.group_id}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>ID: {item.id.slice(0,8)}</span>
                           </div>
                         )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                         {/* Status Badge */}
                          <button 
                            onClick={() => {
                              if (!canEdit) return;
                              toggleStatus(item.id, item.is_active);
                            }}
                            disabled={!canEdit}
                            style={{ 
                              padding: '6px 12px', 
                              borderRadius: '20px', 
                              fontSize: '10px', 
                              fontWeight: '800', 
                              background: item.is_active ? 'rgba(40, 199, 111, 0.1)' : 'rgba(255,255,255,0.05)', 
                              color: item.is_active ? 'var(--success)' : 'var(--text-muted)', 
                              border: 'none', 
                              cursor: canEdit ? 'pointer' : 'not-allowed', 
                              marginRight: '16px',
                              opacity: canEdit ? 1 : 0.5
                            }}
                          >
                             {item.is_active ? t('settingsMaster.active') : t('settingsMaster.inactive')}
                          </button>

                         {/* Actions */}
                         {editingId === item.id ? (
                           <>
                              <button onClick={() => handleUpdate(item.id)} style={{ color: 'var(--primary)' }} className="glass-interactive p-2 rounded-lg">
                                 <Check size={18} />
                              </button>
                              <button onClick={() => setEditingId(null)} style={{ color: 'var(--text-muted)' }} className="glass-interactive p-2 rounded-lg">
                                 <X size={18} />
                              </button>
                           </>
                         ) : (
                           <>
                               <button 
                                 onClick={() => {
                                   if (!canEdit) return;
                                   setEditingId(item.id);
                                   setEditItemName(item.name);
                                   setEditItemAbbr(activeTab === 'line_groups' ? item.group_id : (item.abbreviation || ''));
                                 }}
                                 disabled={!canEdit}
                                 style={{ color: 'var(--text-muted)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }} 
                                 className="glass-interactive p-2 rounded-lg"
                               >
                                  <Edit3 size={18} />
                               </button>
                           </>
                         )}
                      </div>
                   </div>
                 ))}
              </div>
            )}
         </div>
      </div>

      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-item:hover { background: rgba(255,255,255,0.015); }
        .p-2 { padding: 8px; }
      `}} />
    </div>
  );
}

function GoogleSheetsConfigForm({ globalSettings, onSaveSuccess }: { globalSettings: any; onSaveSuccess: () => void }) {
  useStaffLocale();
  const { addToast } = useNotificationContext();
  const [sheetsUrl, setSheetsUrl] = useState(globalSettings?.google_sheets_url || '');
  const [saving, setSaving] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (globalSettings?.google_sheets_url) {
      setSheetsUrl(globalSettings.google_sheets_url);
    }
  }, [globalSettings]);

  const handleSave = async () => {
    if (sheetsUrl && !sheetsUrl.startsWith('http')) {
      alert('กรุณากรอก URL ที่ถูกต้อง');
      return;
    }
    setSaving(true);
    setDbError(null);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ google_sheets_url: sheetsUrl })
        .eq('id', globalSettings.id);

      if (error) {
        console.error('Save error:', error);
        if (error.code === '42703' || error.message?.includes('column "google_sheets_url" of relation')) {
          setDbError('column_missing');
        } else {
          alert('ไม่สามารถบันทึกได้: ' + error.message);
        }
      } else {
        onSaveSuccess();
        addToast({
          id: `gsheets-save-success-${Date.now()}`,
          type: 'ticket',
          title: 'บันทึกสำเร็จ',
          body: 'บันทึก Google Sheets URL เรียบร้อยแล้ว ✨'
        });
      }
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  const appsScriptCode = `function doPost(e) {
  try {
    var jsonString = e.postData.contents;
    var data = JSON.parse(jsonString);
    var rows = data.rows;
    
    if (!rows || rows.length === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: 0, message: "No data received" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    if (sheet.getLastRow() === 0) {
      var headers = Object.keys(rows[0]);
      sheet.appendRow(headers);
      
      var headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight("bold");
      headerRange.setBackground("#e2efda");
      headerRange.setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
    }
    
    var headerKeys = Object.keys(rows[0]);
    for (var i = 0; i < rows.length; i++) {
      var rowData = rows[i];
      var values = [];
      for (var j = 0; j < headerKeys.length; j++) {
        values.push(rowData[headerKeys[j]] || "");
      }
      sheet.appendRow(values);
    }
    
    var numCols = headerKeys.length;
    for (var col = 1; col <= numCols; col++) {
      sheet.autoResizeColumn(col);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", count: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput("Google Sheets Web App is Active! Ready to receive POST exports.")
    .setMimeType(ContentService.MimeType.TEXT);
}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(appsScriptCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({
      id: `copy-script-${Date.now()}`,
      type: 'ticket',
      title: 'คัดลอกแล้ว',
      body: 'คัดลอกโค้ดสคริปต์ไปยังคลิปบอร์ดแล้ว 📋'
    });
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '300px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            Google Sheets Web App URL
          </label>
          <input
            type="url"
            placeholder="https://script.google.com/macros/s/.../exec"
            value={sheetsUrl}
            onChange={(e) => setSheetsUrl(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
          />
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ alignSelf: 'flex-end', background: '#10b981', color: 'white', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', height: '48px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)' }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          บันทึกการตั้งค่า
        </button>
      </div>

      {dbError === 'column_missing' && (
        <div style={{ background: 'rgba(234, 84, 85, 0.1)', border: '1px solid var(--danger)', padding: '24px', borderRadius: '16px', color: 'var(--danger)' }}>
          <h4 style={{ fontWeight: '800', fontSize: '15px', marginBottom: '8px', color: 'var(--danger)' }}>
            ⚠️ ตรวจพบตารางฐานข้อมูลรุ่นเก่า (Database Schema Update Required)
          </h4>
          <p style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '16px', color: 'rgba(234, 84, 85, 0.85)' }}>
            ระบบตรวจพบว่าตาราง <code>company_settings</code> ในฐานข้อมูล Supabase ของคุณยังไม่มีคอลัมน์ <code>google_sheets_url</code> เพื่อจัดเก็บข้อมูลนี้ กรุณาคัดลอกและรันคำสั่ง SQL ด้านล่างนี้ในหน้า <strong>SQL Editor</strong> บน <strong>Supabase Dashboard</strong> ของคุณ จากนั้นลองกดบันทึกอีกครั้ง:
          </p>
          <pre style={{ background: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(234, 84, 85, 0.2)', fontSize: '12px', fontWeight: '700', overflowX: 'auto', color: 'var(--text-main)' }}>
            ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS google_sheets_url TEXT;
          </pre>
        </div>
      )}

      {/* Guide & Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="grid-responsive">
        {/* Step List */}
        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)' }}>
          <h4 style={{ fontWeight: '900', fontSize: '15px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981' }}>
            <FileSpreadsheet size={20} />
            ขั้นตอนการติดตั้งระบบบันทึกข้อมูล
          </h4>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
            <li>
              <strong>สร้างและเตรียมสเปรดชีต:</strong><br />
              เปิด Google Sheets ของคุณขึ้นมาก่อน (แนะนำให้เปิดไฟล์สเปรดชีตเปล่าที่ต้องการเก็บบันทึก)
            </li>
            <li>
              <strong>สร้างสคริปต์ที่ผูกกับตาราง:</strong><br />
              เลือกเมนู <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong> เพื่อให้สคริปต์ผูกเข้ากับชีตโดยตรง (ห้ามสร้างเป็น standalone script)
            </li>
            <li>
              <strong>คัดลอกโค้ดไปวาง:</strong><br />
              กดปุ่ม <span style={{ color: '#10b981', fontWeight: '700' }}>&ldquo;คัดลอกโค้ดสคริปต์&rdquo;</span> ทางด้านขวา แล้วลบโค้ดเดิมทั้งหมดในหน้าโปรแกรมแก้ไขออก จากนั้นวางโค้ดสคริปต์ลงไปและกด <strong>บันทึก (Save)</strong>
            </li>
            <li>
              <strong>เผยแพร่เป็นเว็บแอป:</strong><br />
              คลิก <strong>การใช้งานได้จริง (Deploy) &gt; การทำงานใหม่ (New deployment)</strong> เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong>
            </li>
            <li>
              <strong>ตั้งค่าสิทธิ์ให้เป็นสาธารณะ:</strong><br />
              ตั้งค่าช่อง <strong>ผู้ที่มีสิทธิ์เข้าถึง (Who has access)</strong> ให้เป็น <strong>ทุกคน (Anyone)</strong> จากนั้นกด Deploy เพื่อเผยแพร่
            </li>
            <li>
              <strong>คัดลอกลิงก์มาบันทึก:</strong><br />
              คัดลอก <strong>URL เว็บแอป (Web app URL)</strong> ที่ได้จาก Google มาวางในช่องด้านบนนี้แล้วกด <span style={{ color: '#10b981', fontWeight: '700' }}>&ldquo;บันทึกการตั้งค่า&rdquo;</span>
            </li>
          </ol>
        </div>

        {/* Code Block display */}
        <div className="glass" style={{ padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ fontWeight: '900', fontSize: '15px', color: 'var(--text-main)' }}>
              โค้ด Google Apps Script 🚀
            </h4>
            <button
              onClick={copyToClipboard}
              style={{ background: copied ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)', color: copied ? '#10b981' : 'var(--text-main)', border: '1px solid ' + (copied ? '#10b981' : 'var(--border)'), padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {copied ? 'คัดลอกแล้ว! ✅' : 'คัดลอกโค้ดสคริปต์ 📋'}
            </button>
          </div>
          <pre style={{ flex: 1, background: 'rgba(0,0,0,0.3)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '11px', lineHeight: '1.5', fontFamily: 'monospace', overflowY: 'auto', maxHeight: '350px', color: '#a6e22e' }}>
            {appsScriptCode}
          </pre>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .grid-responsive { grid-template-columns: 1fr !important; }
        }
      `}} />
    </div>
  );
}

function GeminiConfigForm({ globalSettings, onSaveSuccess }: { globalSettings: any; onSaveSuccess: () => void }) {
  const { addToast } = useNotificationContext();
  const [apiKey, setApiKey] = useState(globalSettings?.gemini_api_key || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (globalSettings?.gemini_api_key) {
      setApiKey(globalSettings.gemini_api_key);
    }
  }, [globalSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ gemini_api_key: apiKey })
        .eq('id', globalSettings.id);

      if (error) {
        console.error('Save error:', error);
        alert('ไม่สามารถบันทึกได้: ' + error.message);
      } else {
        onSaveSuccess();
        addToast({
          id: `gemini-save-success-${Date.now()}`,
          type: 'ticket',
          title: 'บันทึกสำเร็จ',
          body: 'บันทึก Gemini API Key เรียบร้อยแล้ว ✨'
        });
      }
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass" style={{ padding: '32px', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '600px', margin: '0 auto', animation: 'slideInRight 0.3s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
        <div style={{ background: 'var(--primary)', padding: '10px', borderRadius: '12px' }}>
          <Sparkles size={24} color="#0a0e14" />
        </div>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', lineHeight: '1.2' }}>ตั้งค่า Gemini AI API Key</h2>
          <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Gemini AI API Configuration</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', marginBottom: '8px' }}>
            Gemini API Key สำหรับสรุปรายงาน
          </label>
          <input
            type="password"
            placeholder="AI_..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 20px', color: 'var(--text-main)', fontSize: '14px', outline: 'none' }}
          />
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', lineHeight: '1.4' }}>
            บันทึก API Key ของระบบเพื่อเปิดใช้งานการวิเคราะห์สรุปความพึงพอใจและแนวทางแก้ไขโดย Gemini อัตโนมัติในสไลด์พรีเซนต์
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: 'var(--primary)', color: 'black', border: 'none', padding: '14px 28px', borderRadius: '12px', fontWeight: '900', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', height: '56px', transition: 'all 0.2s', boxShadow: '0 8px 30px rgba(0, 242, 254, 0.2)', marginTop: '8px' }}
        >
          {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}
