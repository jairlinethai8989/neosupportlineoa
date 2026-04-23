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
  MessageSquare
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

type Tab = 'hospitals' | 'departments' | 'hospital_depts' | 'positions' | 'modules' | 'issue_types' | 'subject_types';

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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setHospitals(ctxHospitals);
  }, [ctxHospitals]);

  useEffect(() => {
    setGlobalSettings(ctxGlobalSettings);
  }, [ctxGlobalSettings]);
  
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

    setLoading(true);

    // Handle company_settings based tabs
    if (activeTab === 'modules' || activeTab === 'issue_types' || activeTab === 'subject_types') {
      if (ctxGlobalSettings) {
        let arrayProp = '';
        if (activeTab === 'modules') arrayProp = 'modules';
        else if (activeTab === 'issue_types') arrayProp = 'issue_types';
        else arrayProp = 'subject_types';

        const itemsList = (ctxGlobalSettings[arrayProp] || []).map((name: string, index: number) => ({
          id: `item-${index}`,
          name: name,
          is_active: true
        }));
        setItems(itemsList);
      }
      setLoading(false);
      return;
    }

    let table = '';
    if (activeTab === 'positions') table = 'positions';

    if (table) {
      const { data } = await supabase.from(table).select('*').order('name');
      setItems(data || []);
    }
    setLoading(false);
  }, [activeTab, ctxHospitals, ctxDepartments, ctxGlobalSettings]);

  useEffect(() => {
    fetchData();
    setIsAdding(false);
    setEditingId(null);
    setNewItemName('');
  }, [fetchData]);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setSubmitting(true);
    const table = (activeTab === 'departments' || activeTab === 'hospital_depts') ? 'departments' : activeTab;
    
    // Handle company_settings based tabs
    if (activeTab === 'modules' || activeTab === 'issue_types' || activeTab === 'subject_types') {
      let arrayProp = '';
      if (activeTab === 'modules') arrayProp = 'modules';
      else if (activeTab === 'issue_types') arrayProp = 'issue_types';
      else arrayProp = 'subject_types';

      const currentList = globalSettings?.[arrayProp] || [];
      if (currentList.includes(newItemName)) {
        alert(t('settingsMaster.alreadyExists'));
        setSubmitting(false);
        return;
      }
      const newList = [...currentList, newItemName];
      const { error } = await supabase.from('company_settings').update({ [arrayProp]: newList }).eq('id', globalSettings.id);
      
      if (!error) {
        setNewItemName('');
        setIsAdding(false);
        await refreshData('settings');
        addToast({
          id: `master-add-${arrayProp}-${newItemName}`,
          type: 'ticket',
          title: t('settingsMaster.addSuccessTitle'),
          body: t('settingsMaster.addSuccessBody').replace('{name}', newItemName),
        });
      } else {
        alert(t('common.messages.saveFailed'));
      }
      setSubmitting(false);
      return;
    }

    const payload: any = { 
      name: newItemName, 
      is_active: true 
    };

    if (activeTab === 'hospitals') {
      payload.abbreviation = newItemAbbr.trim() || newItemName.slice(0, 10).toUpperCase();
      payload.ticket_prefix = `SRS_${payload.abbreviation}_`;
    }

    if (activeTab === 'hospital_depts') {
      payload.dept_type = 'hospital';
    } else if (activeTab === 'departments') {
      payload.dept_type = 'organization';
    }

    const { error } = await supabase.from(table).insert([payload]);
    
    if (error) {
      console.error('Add Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message} (${t('settingsMaster.messages.sqlGuidance')})`);
    } else {
      setNewItemName('');
      setNewItemAbbr('');
      setIsAdding(false);
      
      if (activeTab === 'hospitals') await refreshData('hospitals');
      else if (table === 'departments') await refreshData('departments');
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
    const table = (activeTab === 'departments' || activeTab === 'hospital_depts') ? 'departments' : activeTab;

    if (activeTab === 'modules' || activeTab === 'issue_types' || activeTab === 'subject_types') {
        let arrayProp = '';
        if (activeTab === 'modules') arrayProp = 'modules';
        else if (activeTab === 'issue_types') arrayProp = 'issue_types';
        else arrayProp = 'subject_types';

        const currentList = globalSettings?.[arrayProp] || [];
        const itemToUpdate = items.find(i => i.id === id);
        const newList = currentList.map((name: string) => name === itemToUpdate.name ? editItemName : name);
        
        const { error } = await supabase.from('company_settings').update({ [arrayProp]: newList }).eq('id', globalSettings.id);
        if (!error) {
          await refreshData('settings');
          setEditingId(null);
          addToast({
            id: `master-upd-${arrayProp}-${id}`,
            type: 'ticket',
            title: t('settingsMaster.updateSuccessTitle'),
            body: t('settingsMaster.updateSuccessBody').replace('{name}', editItemName),
          });
        } else {
          alert(t('common.messages.saveFailed'));
        }
        setSubmitting(false);
        return;
    }

    const { error } = await supabase.from(table).update({ name: editItemName }).eq('id', id);
    
    if (error) {
      console.error('Update Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message}`);
    } else {
      setEditingId(null);
      fetchData();

      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_UPDATE',
        entity_type: table.toUpperCase(),
        entity_id: id,
        new_data: { name: editItemName },
        note: `Updated ${table} name to: ${editItemName}`
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
    const table = (activeTab === 'departments' || activeTab === 'hospital_depts') ? 'departments' : activeTab;
    
    if (activeTab === 'modules' || activeTab === 'issue_types' || activeTab === 'subject_types') {
        // Simple delete for arrays instead of toggle
        if (!confirm(t('common.messages.deleteConfirm'))) return;
        let arrayProp = '';
        if (activeTab === 'modules') arrayProp = 'modules';
        else if (activeTab === 'issue_types') arrayProp = 'issue_types';
        else arrayProp = 'subject_types';

        const itemToDelete = items.find(i => i.id === id);
        const newList = (globalSettings?.[arrayProp] || []).filter((name: string) => name !== itemToDelete.name);
        
        const { error } = await supabase.from('company_settings').update({ [arrayProp]: newList }).eq('id', globalSettings.id);
        if (!error) {
           await refreshData('settings');
           addToast({
             id: `master-del-${id}`,
             type: 'ticket',
             title: t('settingsMaster.deleteSuccessTitle'),
             body: t('settingsMaster.deleteSuccessBody'),
           });
        }
        return;
    }

    const { error } = await supabase.from(table).update({ is_active: !current }).eq('id', id);
    if (error) {
      console.error('Toggle status Error:', error);
      alert(`${t('common.messages.saveFailed')}: ${error.message}`);
    } else {
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
      fetchData();
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
    subject_types: { title: t('settingsMaster.tabs.subjectTypes'), icon: MessageSquare, desc: t('settingsMaster.descriptions.subjectTypes') }
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
        {(['hospitals', 'departments', 'hospital_depts', 'positions', 'modules', 'issue_types', 'subject_types'] as Tab[]).map(t => (
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
                 
                 {activeTab === 'hospitals' && (
                   <input 
                     type="text" 
                     placeholder={t('settingsMaster.abbreviation')} 
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
                           <input 
                             autoFocus
                             type="text" 
                             value={editItemName}
                             onChange={e => setEditItemName(e.target.value)}
                             style={{ background: 'rgba(0, 242, 254, 0.05)', border: '1px solid var(--primary)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-main)', fontSize: '15px', fontWeight: '700', outline: 'none', width: '250px' }}
                             onKeyDown={e => e.key === 'Enter' && handleUpdate(item.id)}
                           />
                         ) : (
                           <div>
                              <p style={{ fontSize: '15px', fontWeight: '700', color: item.is_active ? 'var(--text-main)' : 'var(--text-muted)' }}>{item.name}</p>
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

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-item:hover { background: rgba(255,255,255,0.015); }
        .p-2 { padding: 8px; }
      `}} />
    </div>
  );
}
