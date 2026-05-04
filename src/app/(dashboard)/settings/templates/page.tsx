'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  MessageSquare, 
  ClipboardCheck, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  Loader2, 
  ChevronLeft,
  LayoutGrid,
  Search,
  Tag
} from 'lucide-react';
import Link from 'next/link';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

type TemplateType = 'quick' | 'resolution';

interface Template {
  id: string;
  title: string;
  content: string;
  category: string;
}

export default function TemplatesSettingsPage() {
  const { t } = useStaffLocale();
  const { companySettings, userProfile, refreshData } = useAppContext();
  const { addToast } = useNotificationContext();

  const canEdit = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_master === 'edit';
  }, [userProfile]);

  const [activeType, setActiveType] = useState<TemplateType>('quick');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [form, setForm] = useState<Omit<Template, 'id'>>({
    title: '',
    content: '',
    category: 'General'
  });

  useEffect(() => {
    if (companySettings) {
      const key = activeType === 'quick' ? 'global_quick_replies' : 'global_resolution_templates';
      const data = (companySettings as any)[key] || [];
      setTemplates(data);
      setLoading(false);
    }
  }, [companySettings, activeType]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;
    
    setSaving(true);
    try {
      const key = activeType === 'quick' ? 'global_quick_replies' : 'global_resolution_templates';
      const currentTemplates = [...templates];
      
      let nextTemplates;
      if (editingTemplate) {
        nextTemplates = currentTemplates.map(t => t.id === editingTemplate.id ? { ...form, id: t.id } : t);
      } else {
        const newTemplate = { ...form, id: crypto.randomUUID() };
        nextTemplates = [...currentTemplates, newTemplate];
      }

      const { error } = await supabase
        .from('company_settings')
        .update({ [key]: nextTemplates })
        .eq('id', companySettings?.id);

      if (error) throw error;

      await auditService.log({
        performer_id: userProfile?.id,
        action_type: editingTemplate ? 'TEMPLATE_UPDATE' : 'TEMPLATE_CREATE',
        entity_type: 'GLOBAL_TEMPLATE',
        new_data: { type: activeType, template: form },
        note: `${editingTemplate ? 'Updated' : 'Added'} global ${activeType === 'quick' ? 'Quick Reply' : 'Resolution Template'}: ${form.title}`
      });

      addToast({
        id: `template-save-${Date.now()}`,
        type: 'ticket',
        title: t('common.messages.success'),
        body: t('common.messages.saveSuccess')
      });

      await refreshData('settings');
      setIsModalOpen(false);
      setEditingTemplate(null);
      setForm({ title: '', content: '', category: 'General' });
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!canEdit || !confirm(t('common.messages.deleteConfirm'))) return;

    try {
      const key = activeType === 'quick' ? 'global_quick_replies' : 'global_resolution_templates';
      const nextTemplates = templates.filter(t => t.id !== id);

      const { error } = await supabase
        .from('company_settings')
        .update({ [key]: nextTemplates })
        .eq('id', companySettings?.id);

      if (error) throw error;

      addToast({
        id: `template-del-${Date.now()}`,
        type: 'ticket',
        title: t('common.messages.success'),
        body: t('common.messages.deleteSuccess')
      });

      await refreshData('settings');
    } catch (err: any) {
      alert(t('common.messages.deleteFailed'));
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    t.content.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading && !companySettings) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <Link href="/settings/master" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={24} /></Link>
           <div>
             <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1' }}>{t('settingsTemplates.title')}</h1>
             <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsTemplates.subtitle')}</p>
           </div>
        </div>
        
        <button 
          onClick={() => {
            setEditingTemplate(null);
            setForm({ title: '', content: '', category: 'General' });
            setIsModalOpen(true);
          }}
          disabled={!canEdit}
          className="glass-interactive" 
          style={{ 
            padding: '12px 24px', 
            background: 'var(--primary)', 
            color: '#0a0e14', 
            border: 'none', 
            fontWeight: '800', 
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)',
            opacity: !canEdit ? 0.5 : 1,
            cursor: !canEdit ? 'not-allowed' : 'pointer'
          }}
        >
          <Plus size={20} />
          <span>{t('settingsTemplates.addTemplate')}</span>
        </button>
      </div>

      {/* Tabs Selector */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', background: 'rgba(255,255,255,0.03)', padding: '6px', borderRadius: '16px', border: '1px solid var(--border)', width: 'fit-content' }}>
        <button
          onClick={() => setActiveType('quick')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '800',
            border: 'none',
            cursor: 'pointer',
            background: activeType === 'quick' ? 'var(--primary)' : 'transparent',
            color: activeType === 'quick' ? 'black' : 'var(--text-muted)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
           <MessageSquare size={18} />
           {t('settingsTemplates.tabs.quickReplies')}
        </button>
        <button
          onClick={() => setActiveType('resolution')}
          style={{
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '800',
            border: 'none',
            cursor: 'pointer',
            background: activeType === 'resolution' ? 'var(--secondary)' : 'transparent',
            color: activeType === 'resolution' ? 'white' : 'var(--text-muted)',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
           <ClipboardCheck size={18} />
           {t('settingsTemplates.tabs.resolutions')}
        </button>
      </div>

      {/* Search & Description */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
         <p style={{ color: 'var(--text-muted)', fontSize: '14px', maxWidth: '600px' }}>
           {activeType === 'quick' ? t('settingsTemplates.descriptions.quickReplies') : t('settingsTemplates.descriptions.resolutions')}
         </p>
         <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder={t('settingsStaff.searchPlaceholder')} 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 10px 10px 40px', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
            />
          </div>
      </div>

      {/* Grid of Templates */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
        gap: '20px' 
      }}>
        {filteredTemplates.map((template) => (
          <div key={template.id} className="glass" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative', transition: 'transform 0.2s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ 
                  fontSize: '10px', 
                  fontWeight: '800', 
                  padding: '2px 8px', 
                  borderRadius: '4px', 
                  background: activeType === 'quick' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(115, 103, 240, 0.1)',
                  color: activeType === 'quick' ? 'var(--primary)' : 'var(--secondary)',
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                  display: 'inline-block'
                }}>
                  {template.category}
                </span>
                <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text-main)' }}>{template.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  onClick={() => {
                    setEditingTemplate(template);
                    setForm({ title: template.title, content: template.content, category: template.category });
                    setIsModalOpen(true);
                  }}
                  className="glass-interactive"
                  style={{ padding: '8px', borderRadius: '8px', color: 'var(--text-muted)', border: 'none', background: 'rgba(255,255,255,0.05)' }}
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(template.id)}
                  className="glass-interactive"
                  style={{ padding: '8px', borderRadius: '8px', color: 'var(--danger)', border: 'none', background: 'rgba(234, 84, 85, 0.1)' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            
            <p style={{ 
              fontSize: '14px', 
              color: 'var(--text-muted)', 
              lineHeight: '1.6', 
              whiteSpace: 'pre-wrap',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '12px',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              {template.content}
            </p>
          </div>
        ))}

        {filteredTemplates.length === 0 && (
          <div style={{ gridColumn: '1 / -1', padding: '100px', textAlign: 'center', opacity: 0.5 }}>
            <LayoutGrid size={48} style={{ marginBottom: '16px', margin: '0 auto' }} />
            <p>{t('settingsTemplates.empty')}</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(10px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: activeType === 'quick' ? 'var(--primary)' : 'var(--secondary)', padding: '10px', borderRadius: '12px' }}>
                   {activeType === 'quick' ? <MessageSquare size={24} color="#0a0e14" /> : <ClipboardCheck size={24} color="#fff" />}
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{editingTemplate ? t('settingsTemplates.editTemplate') : t('settingsTemplates.addTemplate')}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{activeType === 'quick' ? 'Quick Response' : 'Resolution Summary'}</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('settingsTemplates.fields.title')}</label>
                  <input 
                    type="text" 
                    required
                    placeholder={t('settingsTemplates.placeholders.title')}
                    value={form.title}
                    onChange={e => setForm({...form, title: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', fontSize: '15px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('settingsTemplates.fields.category')}</label>
                  <div style={{ position: 'relative' }}>
                    <Tag size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
                    <input 
                      type="text" 
                      placeholder={t('settingsTemplates.placeholders.category')}
                      value={form.category}
                      onChange={e => setForm({...form, category: e.target.value})}
                      style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px 14px 14px 36px', color: 'var(--text-main)', fontSize: '14px' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>{t('settingsTemplates.fields.content')}</label>
                <textarea 
                  required
                  rows={6}
                  placeholder={t('settingsTemplates.placeholders.content')}
                  value={form.content}
                  onChange={e => setForm({...form, content: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-main)', fontSize: '15px', resize: 'none', lineHeight: '1.6' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={saving || !canEdit}
                  className="glass-interactive"
                  style={{ flex: 1, padding: '16px', borderRadius: '14px', background: activeType === 'quick' ? 'var(--primary)' : 'var(--secondary)', border: 'none', color: activeType === 'quick' ? '#0a0e14' : 'white', fontWeight: '900', cursor: canEdit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !canEdit ? 0.5 : 1 }}
                >
                  {saving ? <Loader2 size={20} className="animate-spin" /> : <><Save size={20} /> {t('common.save')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scaleUp {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}} />
    </div>
  );
}
