'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart2,
  Bell,
  Building,
  CheckCircle,
  ChevronLeft,
  Loader2,
  Mail,
  Search,
  Send,
  Settings2,
  Shield,
  ShieldCheck,
  Trash2,
  User,
  UserPlus,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateStaffRole, translateStaffStatus } from '@/lib/i18n/staff';
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
} from '@/components/ui';
import styles from '../settings.module.css';

const DEFAULT_PERMISSIONS = {
  analytics: 'view',
  analytics_personal: 'view',
  analytics_staff: 'none',
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
};

export default function StaffManagementPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile, projects: contextProjects, refreshData } = useAppContext();
  const { addToast } = useNotificationContext();

  const [staff, setStaff] = useState<any[]>([]);
  const [allProjects, setAllProjects] = useState<any[]>([]);
  const [staffProjectsMap, setStaffProjectsMap] = useState<Record<string, string[]>>({});
  const [selectedStaffProjectIds, setSelectedStaffProjectIds] = useState<string[]>([]);

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
    department: t('settingsStaff.defaults.department'),
    project_ids: [] as string[],
  });
  const [submitting, setSubmitting] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>(DEFAULT_PERMISSIONS);
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'full_name',
    direction: 'asc',
  });

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    const [{ data, error }, { data: membershipRows }] = await Promise.all([
      supabase.from('profiles').select('*').order('full_name', { ascending: true }),
      supabase.from('project_members').select('profile_id, project_id'),
    ]);

    if (error) {
      console.error('Fetch error:', error);
      alert(t('common.messages.fetchError') + ': ' + error.message);
    } else {
      setStaff(data || []);
    }

    const nextMap: Record<string, string[]> = {};
    for (const row of membershipRows || []) {
      if (!nextMap[row.profile_id]) nextMap[row.profile_id] = [];
      nextMap[row.profile_id].push(row.project_id);
    }
    setStaffProjectsMap(nextMap);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    let isMounted = true;
    const fetchStaffAsync = async () => {
      if (!isMounted) return;
      await fetchStaff();

      const [{ data: depts }, projRes] = await Promise.all([
        supabase
          .from('departments')
          .select('name')
          .eq('is_active', true)
          .eq('dept_type', 'organization')
          .order('name'),
        fetch('/api/projects/mine', { cache: 'no-store' })
          .then((r) => (r.ok ? r.json() : { projects: [] }))
          .catch(() => ({ projects: [] })),
      ]);

      const loadedProjects =
        (projRes.projects && projRes.projects.length > 0 ? projRes.projects : contextProjects) || [];
      setAllProjects(loadedProjects);
      const defaultProj = loadedProjects.find((p: any) => p.is_default) || loadedProjects[0];

      if (depts) {
        const deptNames = depts.map((d) => d.name);
        setDepartments(deptNames);
        setForm((prev) => ({
          ...prev,
          department: deptNames[0] || '',
          project_ids: prev.project_ids.length > 0 ? prev.project_ids : defaultProj ? [defaultProj.id] : [],
        }));
      } else if (defaultProj) {
        setForm((prev) => ({
          ...prev,
          project_ids: prev.project_ids.length > 0 ? prev.project_ids : [defaultProj.id],
        }));
      }
    };
    fetchStaffAsync();
    return () => {
      isMounted = false;
    };
  }, [contextProjects, fetchStaff]);

  const handleDeleteStaff = async (id: string, name: string) => {
    if (!confirm(t('common.messages.deleteConfirm').replace('{name}', name))) return;

    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) {
      alert(t('common.messages.deleteFailed') + ': ' + error.message);
    } else {
      setStaff((prev) => prev.filter((s) => s.id !== id));

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'STAFF_DELETE',
        entity_type: 'PROFILE',
        entity_id: id,
        note: `Deleted staff member: ${name}`,
      });

      addToast({
        id: `staff-del-${id}`,
        type: 'ticket',
        title: t('settingsStaff.messages.deleteSuccessTitle'),
        body: t('common.messages.deleteSuccess').replace('{name}', name),
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
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create staff');

      alert(t('common.messages.success'));
      const defaultProj = allProjects.find((p) => p.is_default) || allProjects[0];
      setIsModalOpen(false);
      setForm({
        username: '',
        password: '',
        full_name: '',
        role: 'Agent',
        department: t('settingsStaff.defaults.department'),
        project_ids: defaultProj ? [defaultProj.id] : [],
      });
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
      ...(staffMember.permissions || {}),
    });
    setSelectedStaffProjectIds(staffProjectsMap[staffMember.id] || []);
    setPermissionModalOpen(true);
  };

  const handleSavePermissions = async () => {
    setSubmitting(true);
    try {
      const [{ error }, projRes] = await Promise.all([
        supabase.from('profiles').update({ permissions }).eq('id', selectedStaff.id),
        fetch(`/api/admin/staff/${selectedStaff.id}/projects`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectIds: selectedStaffProjectIds }),
        }),
      ]);

      if (error) throw error;
      if (!projRes.ok) {
        const errBody = await projRes.json().catch(() => ({}));
        throw new Error(errBody.error || 'Failed to save project scope');
      }

      alert(t('common.messages.success'));
      setPermissionModalOpen(false);
      await fetchStaff();
      await refreshData('projects');

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'STAFF_PERMISSION_UPDATE',
        entity_type: 'PROFILE',
        entity_id: selectedStaff.id,
        new_data: { permissions },
        note: `Updated permissions for ${selectedStaff.full_name}`,
      });

      addToast({
        id: `staff-perm-${selectedStaff.id}`,
        type: 'ticket',
        title: t('settingsStaff.messages.permSaveSuccessTitle'),
        body: t('common.messages.saveSuccess').replace('{name}', selectedStaff.full_name),
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
    const result = staff.filter(
      (s) =>
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

  const activeCount = useMemo(() => staff.filter((s) => s.status === 'Active').length, [staff]);
  const adminCount = useMemo(() => staff.filter((s) => s.role === 'Administrator').length, [staff]);

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '70vh' }} role="status" aria-label={t('common.messages.loading')}>
        <Loader2 className="animate-spin" color="var(--color-primary)" size={28} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <Link href="/" className={styles.backLink} aria-label="กลับหน้าหลัก">
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
            <span>{t('settingsStaff.title')}</span>
          </span>
        }
        subtitle={t('settingsStaff.subtitle')}
        actions={
          <Button
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            disabled={!canEdit}
            leftIcon={<UserPlus size={16} aria-hidden="true" />}
          >
            {t('settingsStaff.addStaff')}
          </Button>
        }
      />

      {/* Stats Strip */}
      <div className={styles.statsGrid}>
        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <Users size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>{t('settingsStaff.totalStaff')}</p>
              <p className={styles.statValue}>{staff.length}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconSuccess}`}>
              <CheckCircle size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>{t('settingsStaff.onlineNow')}</p>
              <p className={styles.statValue}>{activeCount}</p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody compact className={styles.statCardBody}>
            <div className={`${styles.statIcon} ${styles.statIconInfo}`}>
              <Shield size={18} aria-hidden="true" />
            </div>
            <div>
              <p className={styles.statLabel}>{t('settingsStaff.administrators')}</p>
              <p className={styles.statValue}>{adminCount}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Staff RBAC Table */}
      <Card>
        <div className={styles.toolbar}>
          <div className={styles.toolbarTitleGroup}>
            <h2 className={styles.toolbarTitle}>{t('settingsStaff.teamList')}</h2>
            <Badge variant="neutral" size="sm">
              {filteredStaff.length}
            </Badge>
          </div>
          <div className={styles.searchWrap}>
            <Input
              type="search"
              aria-label={t('settingsStaff.searchPlaceholder')}
              placeholder={t('settingsStaff.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search size={16} aria-hidden="true" />}
            />
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div style={{ padding: 'var(--space-6)' }}>
            <EmptyState
              compact
              icon={<Users size={20} aria-hidden="true" />}
              title={t('settingsStaff.noResults')}
            />
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    { key: 'full_name', label: t('settingsStaff.columns.staff') },
                    { key: 'department', label: t('settingsStaff.columns.department') },
                    { key: 'role', label: t('settingsStaff.columns.role') },
                    { key: 'status', label: t('settingsStaff.columns.status') },
                    { key: 'actions', label: t('settingsStaff.columns.actions'), noSort: true, right: true },
                  ].map((col) => {
                    const isSorted = sortConfig.key === col.key;
                    const ariaSort = col.noSort
                      ? undefined
                      : isSorted
                        ? sortConfig.direction === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none';

                    return (
                      <th key={col.key} aria-sort={ariaSort} className={col.right ? styles.thRight : undefined}>
                        {col.noSort ? (
                          col.label
                        ) : (
                          <button
                            type="button"
                            className={styles.thSortBtn}
                            onClick={() => handleSort(col.key)}
                          >
                            <span>{col.label}</span>
                            {isSorted ? (
                              sortConfig.direction === 'asc' ? (
                                <ArrowUp size={12} aria-hidden="true" />
                              ) : (
                                <ArrowDown size={12} aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown size={12} style={{ opacity: 0.35 }} aria-hidden="true" />
                            )}
                          </button>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredStaff.map((member) => {
                  const statusVariant =
                    member.status === 'Active' ? 'success' : member.status === 'Away' ? 'warning' : 'neutral';

                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                          <img
                            src={
                              member.avatar_url ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(member.full_name || 'Staff')}`
                            }
                            alt={member.full_name}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--color-border)',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                          />
                          <div>
                            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>
                              {member.full_name}
                            </p>
                            <p className="mono" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                          {member.department || '-'}
                        </span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Shield
                              size={14}
                              color={member.role === 'Administrator' ? 'var(--color-primary)' : 'var(--color-text-muted)'}
                              aria-hidden="true"
                            />
                            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
                              {translateStaffRole(member.role, locale)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {member.role === 'Administrator' ? (
                              <Badge variant="success" size="sm">
                                ทุกโครงการ
                              </Badge>
                            ) : (staffProjectsMap[member.id] || []).length === 0 ? (
                              <Badge variant="warning" size="sm">
                                ยังไม่กำหนดโครงการ
                              </Badge>
                            ) : (
                              (staffProjectsMap[member.id] || []).map((pid) => {
                                const proj = allProjects.find((p) => p.id === pid);
                                if (!proj) return null;
                                return (
                                  <Badge key={pid} variant="neutral" size="sm" dot={proj.primary_color || '#1d4ed8'}>
                                    <span className="mono">{proj.code}</span>
                                  </Badge>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        <Badge variant={statusVariant} size="sm" dot>
                          {translateStaffStatus(member.status, locale)}
                        </Badge>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            onClick={() => {
                              if (!canEdit) return;
                              handleOpenPermissions(member);
                            }}
                            disabled={!canEdit}
                            title={canEdit ? t('settingsStaff.managePermissions') : t('settingsStaff.noEditPermission')}
                            aria-label={`${t('settingsStaff.managePermissions')}: ${member.full_name}`}
                          >
                            <Shield size={16} color="var(--color-primary)" aria-hidden="true" />
                          </Button>

                          {member.email ? (
                            <a
                              href={`mailto:${member.email}`}
                              aria-label={`ส่งอีเมลถึง ${member.full_name}`}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 'var(--control-sm)',
                                height: 'var(--control-sm)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <Mail size={16} aria-hidden="true" />
                            </a>
                          ) : null}

                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            onClick={() => {
                              if (!canEdit) return;
                              handleDeleteStaff(member.id, member.full_name);
                            }}
                            disabled={!canEdit}
                            aria-label={`ลบ ${member.full_name}`}
                          >
                            <Trash2 size={16} color="var(--color-danger)" aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Add Staff Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t('settingsStaff.modalTitle')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              form="add-staff-form"
              variant="primary"
              loading={submitting}
              disabled={!canEdit}
              leftIcon={<CheckCircle size={16} aria-hidden="true" />}
            >
              {t('settingsStaff.confirmAddStaff')}
            </Button>
          </>
        }
      >
        <form id="add-staff-form" onSubmit={handleAddStaff} className={styles.stackMd}>
          <Input
            label={t('settingsStaff.fields.username')}
            required
            placeholder={t('settingsStaff.placeholders.username')}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <Input
            label={t('settingsStaff.fields.fullName')}
            required
            placeholder={t('settingsStaff.placeholders.fullName')}
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            type="password"
            label={t('settingsStaff.fields.password')}
            required
            placeholder={t('settingsStaff.placeholders.password')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <div className={styles.formGrid2}>
            <Select
              label={t('settingsStaff.fields.role')}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="Agent">{t('settingsStaff.roleOptions.agent')}</option>
              <option value="Administrator">{t('settingsStaff.roleOptions.admin')}</option>
            </Select>

            <Select
              label={t('settingsStaff.fields.department')}
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            >
              {departments.map((dept, idx) => (
                <option key={idx} value={dept}>
                  {dept}
                </option>
              ))}
              {departments.length === 0 && <option value="">{t('settingsStaff.noDepartments')}</option>}
            </Select>
          </div>

          {allProjects.length > 0 && form.role !== 'Administrator' && (
            <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
              <legend
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--color-text)',
                  marginBottom: 'var(--space-2)',
                }}
              >
                โครงการที่รับผิดชอบ (เลือกได้หลายโครงการ)
              </legend>
              <div className={styles.checkboxGroup}>
                {allProjects.map((proj) => {
                  const checked = form.project_ids.includes(proj.id);
                  return (
                    <label
                      key={proj.id}
                      className={`${styles.checkboxPill} ${checked ? styles.checkboxPillChecked : ''}`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkboxInput}
                        checked={checked}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            project_ids: e.target.checked
                              ? [...prev.project_ids, proj.id]
                              : prev.project_ids.filter((id) => id !== proj.id),
                          }));
                        }}
                      />
                      <Badge variant="neutral" size="sm" dot={proj.primary_color || '#1d4ed8'}>
                        <span className="mono">{proj.code}</span>
                      </Badge>
                      <span>{proj.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}
        </form>
      </Modal>

      {/* Permissions & Project Scope Modal */}
      <Modal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        title={t('settingsStaff.permissionsTitle')}
        description={
          selectedStaff
            ? `${selectedStaff.full_name} (${translateStaffRole(selectedStaff.role, locale)})`
            : undefined
        }
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setPermissionModalOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePermissions}
              loading={submitting}
              disabled={!canEdit}
            >
              {t('settingsStaff.permissionsSave')}
            </Button>
          </>
        }
      >
        <div className={styles.stackMd}>
          {/* Multi-Project Access Assignment */}
          {allProjects.length > 0 && (
            <fieldset
              style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface-subtle)',
                margin: 0,
              }}
            >
              <div className={styles.rowBetween} style={{ marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
                <legend
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--color-text)',
                    float: 'none',
                  }}
                >
                  โครงการที่อนุญาตให้เข้าถึงและดูแล
                </legend>
                {selectedStaff?.role === 'Administrator' && (
                  <Badge variant="success" size="sm">
                    Administrator เข้าถึงได้ทุกโครงการอัตโนมัติ
                  </Badge>
                )}
              </div>

              <div className={styles.checkboxGroup}>
                {allProjects.map((proj) => {
                  const isAdminTarget = selectedStaff?.role === 'Administrator';
                  const isChecked = isAdminTarget || selectedStaffProjectIds.includes(proj.id);
                  const isDisabled = isAdminTarget || !canEdit;

                  return (
                    <label
                      key={proj.id}
                      className={`${styles.checkboxPill} ${isChecked ? styles.checkboxPillChecked : ''} ${
                        isDisabled ? styles.checkboxPillDisabled : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        className={styles.checkboxInput}
                        checked={isChecked}
                        disabled={isDisabled}
                        onChange={(e) => {
                          setSelectedStaffProjectIds((prev) =>
                            e.target.checked
                              ? [...prev, proj.id]
                              : prev.filter((id) => id !== proj.id)
                          );
                        }}
                      />
                      <Badge variant="neutral" size="sm" dot={proj.primary_color || '#1d4ed8'}>
                        <span className="mono">{proj.code}</span>
                      </Badge>
                      <span>{proj.name}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {/* RBAC Modules */}
          <div className={styles.stackSm}>
            {[
              { key: 'analytics', label: t('settingsStaff.permissionLabels.analytics'), icon: BarChart2 },
              { key: 'analytics_personal', label: t('settingsStaff.permissionLabels.analyticsPersonal'), icon: User },
              { key: 'analytics_staff', label: t('settingsStaff.permissionLabels.analyticsStaff'), icon: Users },
              { key: 'inbox', label: t('settingsStaff.permissionLabels.inbox'), icon: Mail },
              { key: 'tickets', label: t('settingsStaff.permissionLabels.tickets'), icon: Shield },
              { key: 'notifications', label: t('settingsStaff.permissionLabels.notifications'), icon: Bell },
              { key: 'customers', label: t('settingsStaff.permissionLabels.customers'), icon: Users },
              { key: 'reports', label: t('settingsStaff.permissionLabels.reports'), icon: Send },
              { key: 'settings_profile', label: t('settingsStaff.permissionLabels.settingsProfile'), icon: User },
              { key: 'settings_branding', label: t('settingsStaff.permissionLabels.settingsBranding'), icon: Building },
              { key: 'settings_staff', label: t('settingsStaff.permissionLabels.settingsStaff'), icon: UserPlus },
              { key: 'settings_sla', label: t('settingsStaff.permissionLabels.settingsSla'), icon: ShieldCheck },
              { key: 'settings_master', label: t('settingsStaff.permissionLabels.settingsMaster'), icon: Settings2 },
              { key: 'settings_audit', label: t('settingsStaff.permissionLabels.settingsAudit'), icon: Shield },
            ].map((module) => (
              <div key={module.key} className={styles.permRow}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <module.icon size={16} color="var(--color-text-muted)" aria-hidden="true" />
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)' }}>
                    {module.label}
                  </span>
                </div>

                <div className={styles.permControlGroup} role="group" aria-label={module.label}>
                  {(['none', 'view', 'edit'] as const).map((level) => {
                    const active = permissions[module.key] === level;
                    const activeClass =
                      level === 'edit'
                        ? styles.permOptionEdit
                        : level === 'view'
                          ? styles.permOptionView
                          : styles.permOptionNone;

                    return (
                      <button
                        key={level}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          if (!canEdit) return;
                          setPermissions({ ...permissions, [module.key]: level });
                        }}
                        disabled={!canEdit}
                        className={`${styles.permOptionBtn} ${active ? activeClass : ''}`}
                      >
                        {level === 'none'
                          ? t('settingsStaff.accessLevels.none')
                          : level === 'view'
                            ? t('settingsStaff.accessLevels.view')
                            : t('settingsStaff.accessLevels.edit')}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
