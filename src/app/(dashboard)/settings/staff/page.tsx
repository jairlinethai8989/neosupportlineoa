'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  Mail,
  MoreVertical,
  Loader2,
  ChevronLeft,
  CheckCircle,
  XCircle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Send,
  BarChart2,
  Bell,
  User,
  Building,
  ShieldCheck,
  Settings2,
  LayoutGrid
} from 'lucide-react';
import Link from 'next/link';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateStaffRole, translateStaffStatus } from '@/lib/i18n/staff';

export default function StaffManagementPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile } = useAppContext();
  const [staff, setStaff] = useState<any[]>([]);
  
  const canEdit = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_staff === 'edit';
  }, [userProfile]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'Agent',
    department: t('settingsStaff.defaults.department')
  });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const { addToast } = useNotificationContext();
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const DEFAULT_PERMISSIONS = {
    analytics: 'view',
    inbox: 'edit',
    tickets: 'edit',
    notifications: 'view',
    customers: 'view',
    reports: 'none',
    settings_profile: 'edit',
    settings_branding: 'none',
    settings_staff: 'none',
    settings_sla: 'none',
    settings_master: 'none',
    settings_audit: 'none',
    module_doctor: 'none',
    module_nurse: 'none',
    module_pharmacy: 'none',
    module_records: 'none',
    module_surgery: 'none',
    module_anesthesia: 'none',
    module_consult: 'none'
  };
  const [permissions, setPermissions] = useState<any>(DEFAULT_PERMISSIONS);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'full_name', direction: 'asc' });

  const fetchStaff = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name', { ascending: true });
    
    if (error) {
      console.error('Fetch error:', error);
      alert(t('common.messages.fetchError') + ': ' + error.message);
    } else {
      setStaff(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;
    const fetchStaffAsync = async () => {
      if (!isMounted) return;
      await fetchStaff();
      
      // Fetch dynamic organization departments from normalized table
      const { data: depts } = await supabase.from('departments').select('name').eq('is_active', true).eq('dept_type', 'organization').order('name');
      if (depts) {
        const deptNames = depts.map(d => d.name);
        setDepartments(deptNames);
        setForm(prev => ({ ...prev, department: deptNames[0] || '' }));
      }
    };
    fetchStaffAsync();
    return () => { isMounted = false; };
  }, []);

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(t('common.messages.deleteConfirm').replace('{name}', name))) return;
    
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert(t('common.messages.deleteFailed') + ': ' + error.message);
    } else {
      setStaff(prev => prev.filter(s => s.id !== id));
      
      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'STAFF_DELETE',
        entity_type: 'PROFILE',
        entity_id: id,
        note: `Deleted staff member: ${name}`
      });

      addToast({
        id: `staff-del-${id}`,
        type: 'ticket',
        title: t('settingsStaff.messages.deleteSuccessTitle'),
        body: t('common.messages.deleteSuccess').replace('{name}', name)
      });
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff');
      
      alert(t('common.messages.success'));
      setIsModalOpen(false);
      setForm({ username: '', password: '', full_name: '', role: 'Agent', department: t('settingsStaff.defaults.department') });
      fetchStaff();
    } catch (err: any) {
      alert(t('common.messages.error') + ': ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPermissions = (staffMember: any) => {
    setSelectedStaff(staffMember);
    setPermissions({
      ...DEFAULT_PERMISSIONS,
      ...(staffMember.permissions || {})
    });
    setPermissionModalOpen(true);
  };

  const handleSavePermissions = async () => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions })
        .eq('id', selectedStaff.id);
      
      if (error) throw error;
      
      alert(t('common.messages.success'));
      setPermissionModalOpen(false);
      fetchStaff();

      const { data: { user } } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'STAFF_PERMISSION_UPDATE',
        entity_type: 'PROFILE',
        entity_id: selectedStaff.id,
        new_data: { permissions },
        note: `Updated permissions for ${selectedStaff.full_name}`
      });

      addToast({
        id: `staff-perm-${selectedStaff.id}`,
        type: 'ticket',
        title: t('settingsStaff.messages.permSaveSuccessTitle'),
        body: t('common.messages.saveSuccess').replace('{name}', selectedStaff.full_name)
      });
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const filteredStaff = useMemo(() => {
    const result = staff.filter(s => 
      s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (sortConfig.key) {
      result.sort((a, b) => {
        let aValue: any = '';
        let bValue: any = '';

        switch (sortConfig.key) {
          case 'full_name':
            aValue = a.full_name;
            bValue = b.full_name;
            break;
          case 'department':
            aValue = a.department || '';
            bValue = b.department || '';
            break;
          case 'role':
            aValue = a.role;
            bValue = b.role;
            break;
          case 'status':
            aValue = a.status || '';
            bValue = b.status || '';
            break;
          default:
            aValue = a[sortConfig.key];
            bValue = b[sortConfig.key];
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [staff, searchTerm, sortConfig]);

  if (loading) return <div className="flex-center" style={{ height: '70vh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
           <Link href="/" style={{ color: 'var(--text-muted)' }}><ChevronLeft size={24} /></Link>
           <div>
             <h1 style={{ fontSize: '28px', fontWeight: '800', lineHeight: '1.1' }}>{t('settingsStaff.title')}</h1>
             <p style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('settingsStaff.subtitle')}</p>
           </div>
        </div>
        
        <button 
          onClick={() => setIsModalOpen(true)}
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
          <UserPlus size={20} />
          <span>{t('settingsStaff.addStaff')}</span>
        </button>
      </div>

      {/* Stats Quick View */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(0, 242, 254, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Users size={20} color="var(--primary)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settingsStaff.totalStaff')}</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>{staff.length}</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(40, 199, 111, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <CheckCircle size={20} color="var(--success)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settingsStaff.onlineNow')}</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>2</p>
          </div>
        </div>
        <div className="glass" style={{ padding: '16px 24px', flex: 1, display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(115, 103, 240, 0.1)', padding: '10px', borderRadius: '12px' }}>
            <Shield size={20} color="var(--secondary)" />
          </div>
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('settingsStaff.administrators')}</p>
            <p style={{ fontSize: '20px', fontWeight: '800' }}>1</p>
          </div>
        </div>
      </div>

      {/* Main Content: Staff List */}
      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{t('settingsStaff.teamList')}</h2>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder={t('settingsStaff.searchPlaceholder')} 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 10px 10px 40px', color: 'var(--text-main)', outline: 'none', fontSize: '14px' }}
            />
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
              {[
                { key: 'full_name', label: t('settingsStaff.columns.staff') },
                { key: 'department', label: t('settingsStaff.columns.department') },
                { key: 'role', label: t('settingsStaff.columns.role') },
                { key: 'status', label: t('settingsStaff.columns.status') },
                { key: 'actions', label: t('settingsStaff.columns.actions'), noSort: true, textAlign: 'right' }
              ].map(col => (
                <th 
                  key={col.key}
                  onClick={() => !col.noSort && handleSort(col.key)}
                  style={{ 
                    padding: '16px 24px', 
                    fontSize: '12px', 
                    fontWeight: '700', 
                    color: 'var(--text-muted)', 
                    textTransform: 'uppercase',
                    cursor: col.noSort ? 'default' : 'pointer',
                    textAlign: (col as any).textAlign || 'left',
                    userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: (col as any).textAlign === 'right' ? 'flex-end' : 'flex-start', gap: '8px' }}>
                    {col.label}
                    {!col.noSort && (
                      <span style={{ display: 'flex', alignItems: 'center' }}>
                        {sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : (
                          <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredStaff.map((member) => (
              <tr key={member.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.2s' }} className="hover-row">
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img src={member.avatar_url} style={{ width: '40px', height: '40px', borderRadius: '12px', border: '1px solid var(--border)' }} />
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: '700' }}>{member.full_name}</p>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{member.email}</p>
                    </div>
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                   <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{member.department}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shield size={14} color={member.role === 'Administrator' ? 'var(--primary)' : 'var(--text-muted)'} />
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{translateStaffRole(member.role, locale)}</span>
                   </div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: member.status === 'Active' ? 'var(--success)' : member.status === 'Away' ? 'var(--warning)' : 'var(--text-muted)' 
                    }} />
                    <span style={{ fontSize: '13px' }}>{translateStaffStatus(member.status, locale)}</span>
                  </div>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                      <button 
                        onClick={() => {
                          if (!canEdit) return;
                          handleOpenPermissions(member);
                        }}
                        disabled={!canEdit}
                        title={canEdit ? t('settingsStaff.managePermissions') : t('settingsStaff.noEditPermission')}
                        style={{ padding: '8px', borderRadius: '8px', background: 'rgba(54, 153, 255, 0.1)', border: 'none', color: 'var(--primary)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}
                      >
                        <Shield size={16} />
                      </button>
                     <button style={{ padding: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Mail size={16} /></button>
                      <button 
                        onClick={() => {
                          if (!canEdit) return;
                          handleDeleteStaff(member.id, member.full_name);
                        }}
                        disabled={!canEdit}
                        style={{ padding: '8px', borderRadius: '8px', background: 'rgba(234, 84, 85, 0.1)', border: 'none', color: 'var(--danger)', cursor: canEdit ? 'pointer' : 'not-allowed', opacity: canEdit ? 1 : 0.5 }}
                      >
                        <Trash2 size={16} />
                      </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {filteredStaff.length === 0 && (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)' }}>{t('settingsStaff.noResults')}</p>
          </div>
        )}
      </div>

      {/* Add Staff Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(8px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '500px', padding: '32px', position: 'relative', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '10px' }}>
                   <UserPlus size={20} color="#0a0e14" />
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{t('settingsStaff.modalTitle')}</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={handleAddStaff} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsStaff.fields.username')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('settingsStaff.placeholders.username')}
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsStaff.fields.fullName')}</label>
                <input 
                  type="text" 
                  required
                  placeholder={t('settingsStaff.placeholders.fullName')}
                  value={form.full_name}
                  onChange={e => setForm({...form, full_name: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsStaff.fields.password')}</label>
                <input 
                  type="password" 
                  required
                  placeholder={t('settingsStaff.placeholders.password')}
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsStaff.fields.role')}</label>
                  <select 
                    value={form.role}
                    onChange={e => setForm({...form, role: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)' }}
                  >
                    <option value="Agent">{t('settingsStaff.roleOptions.agent')}</option>
                    <option value="Administrator">{t('settingsStaff.roleOptions.admin')}</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>{t('settingsStaff.fields.department')}</label>
                  <select 
                    value={form.department}
                    onChange={e => setForm({...form, department: e.target.value})}
                    style={{ width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-main)' }}
                  >
                    {departments.map((dept, idx) => (
                      <option key={idx} value={dept}>{dept}</option>
                    ))}
                    {departments.length === 0 && <option value="">{t('settingsStaff.noDepartments')}</option>}
                  </select>
                </div>
              </div>

              <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer' }}>{t('common.cancel')}</button>
                <button 
                  type="submit" 
                  disabled={submitting || !canEdit}
                  style={{ flex: 1, padding: '14px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '800', cursor: canEdit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !canEdit ? 0.5 : 1 }}
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <><CheckCircle size={18} /> {t('settingsStaff.confirmAddStaff')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Permissions Modal */}
      {permissionModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, backdropFilter: 'blur(10px)' }}>
          <div className="glass" style={{ width: '100%', maxWidth: '600px', padding: '32px', position: 'relative', animation: 'scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: 'rgba(54, 153, 255, 0.1)', padding: '10px', borderRadius: '12px' }}>
                   <Shield size={24} color="var(--primary)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '800' }}>{t('settingsStaff.permissionsTitle')}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{selectedStaff?.full_name} ({translateStaffRole(selectedStaff?.role, locale)})</p>
                </div>
              </div>
              <button 
                onClick={() => setPermissionModalOpen(false)} 
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-main)', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <XCircle size={20} />
              </button>
            </div>

            <div className="no-scrollbar" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              marginBottom: '32px', 
              maxHeight: 'calc(80vh - 200px)', 
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {[
                { key: 'analytics', label: t('settingsStaff.permissionLabels.analytics'), icon: BarChart2 },
                { key: 'inbox', label: t('settingsStaff.permissionLabels.inbox'), icon: Mail },
                { key: 'tickets', label: t('settingsStaff.permissionLabels.tickets'), icon: Shield },
                { key: 'notifications', label: t('settingsStaff.permissionLabels.notifications'), icon: Bell },
                { key: 'customers', label: t('settingsStaff.permissionLabels.customers'), icon: Users },
                { key: 'reports', label: t('settingsStaff.permissionLabels.reports'), icon: Send },
                { key: 'module_doctor', label: t('settingsStaff.permissionLabels.moduleDoctor'), icon: LayoutGrid },
                { key: 'module_nurse', label: t('settingsStaff.permissionLabels.moduleNurse'), icon: LayoutGrid },
                { key: 'module_pharmacy', label: t('settingsStaff.permissionLabels.modulePharmacy'), icon: LayoutGrid },
                { key: 'module_records', label: t('settingsStaff.permissionLabels.moduleRecords'), icon: LayoutGrid },
                { key: 'module_surgery', label: t('settingsStaff.permissionLabels.moduleSurgery'), icon: LayoutGrid },
                { key: 'module_anesthesia', label: t('settingsStaff.permissionLabels.moduleAnesthesia'), icon: LayoutGrid },
                { key: 'module_consult', label: t('settingsStaff.permissionLabels.moduleConsult'), icon: LayoutGrid },
                { key: 'settings_profile', label: t('settingsStaff.permissionLabels.settingsProfile'), icon: User },
                { key: 'settings_branding', label: t('settingsStaff.permissionLabels.settingsBranding'), icon: Building },
                { key: 'settings_staff', label: t('settingsStaff.permissionLabels.settingsStaff'), icon: UserPlus },
                { key: 'settings_sla', label: t('settingsStaff.permissionLabels.settingsSla'), icon: ShieldCheck },
                { key: 'settings_master', label: t('settingsStaff.permissionLabels.settingsMaster'), icon: Settings2 },
                { key: 'settings_audit', label: t('settingsStaff.permissionLabels.settingsAudit'), icon: Shield },
              ].map((module) => (
                <div key={module.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <module.icon size={18} color="var(--text-muted)" />
                    <span style={{ fontSize: '14px', fontWeight: '700' }}>{module.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.1)', padding: '4px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                    {['none', 'view', 'edit'].map((level) => (
                      <button
                        key={level}
                        onClick={() => {
                          if (!canEdit) return;
                          setPermissions({ ...permissions, [module.key]: level });
                        }}
                        disabled={!canEdit}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '8px',
                          fontSize: '11px',
                          fontWeight: '800',
                          border: 'none',
                          cursor: canEdit ? 'pointer' : 'not-allowed',
                          textTransform: 'uppercase',
                          background: permissions[module.key] === level 
                            ? (level === 'edit' ? 'var(--primary)' : level === 'view' ? 'var(--secondary)' : 'var(--danger)') 
                            : 'rgba(255,255,255,0.05)',
                          color: permissions[module.key] === level 
                            ? '#0a0e14' 
                            : 'var(--text-main)',
                          opacity: permissions[module.key] === level ? 1 : 0.4,
                          transition: 'all 0.2s'
                        }}
                      >
                        {level === 'none' ? t('settingsStaff.accessLevels.none') : level === 'view' ? t('settingsStaff.accessLevels.view') : t('settingsStaff.accessLevels.edit')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setPermissionModalOpen(false)} style={{ flex: 1, padding: '16px', borderRadius: '14px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button 
                onClick={handleSavePermissions}
                disabled={submitting || !canEdit}
                className="glass-interactive"
                style={{ flex: 1, padding: '16px', borderRadius: '14px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '900', cursor: canEdit ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: !canEdit ? 0.5 : 1 }}
              >
                {submitting ? <Loader2 size={20} className="animate-spin" /> : t('settingsStaff.permissionsSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .hover-row:hover {
          background: rgba(255,255,255,0.03);
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
