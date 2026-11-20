'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Copy,
  Edit3,
  FileSpreadsheet,
  FileText,
  Layout,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { auditService } from '@/lib/services/auditService';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import styles from '../settings.module.css';

type Tab =
  | 'organizations'
  | 'departments'
  | 'hospital_depts'
  | 'positions'
  | 'modules'
  | 'issue_types'
  | 'subject_types'
  | 'line_groups'
  | 'google_sheets'
  | 'gemini_api';

const PROJECT_SCOPED_TABS: Tab[] = ['organizations', 'modules', 'issue_types', 'subject_types'];

export default function MasterSettingsPage() {
  const { t } = useStaffLocale();
  const {
    organizations: ctxOrganizations,
    departments: ctxDepartments,
    companySettings: ctxGlobalSettings,
    refreshData,
    userProfile,
    ensureOrganizations,
    ensureDepartments,
    projects,
    activeProject,
    selectedProjectId,
  } = useAppContext();

  useEffect(() => {
    if (ensureOrganizations) void ensureOrganizations();
    if (ensureDepartments) void ensureDepartments();
  }, [ensureOrganizations, ensureDepartments]);

  const canEdit = React.useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_master === 'edit';
  }, [userProfile]);

  const { addToast } = useNotificationContext();

  const [activeTab, setActiveTab] = useState<Tab>('organizations');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [organizations, setOrganizations] = useState<any[]>(ctxOrganizations);
  const [globalSettings, setGlobalSettings] = useState<any>(ctxGlobalSettings);

  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAbbr, setNewItemAbbr] = useState('');
  const [newItemProjectId, setNewItemProjectId] = useState<string>('');
  const [editItemName, setEditItemName] = useState('');
  const [editItemAbbr, setEditItemAbbr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setOrganizations(ctxOrganizations);
  }, [ctxOrganizations]);

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
    if (activeTab === 'organizations') {
      setItems(ctxOrganizations);
      return;
    }

    if (activeTab === 'departments' || activeTab === 'hospital_depts') {
      const filtered = ctxDepartments.filter((d) => d.dept_type === 'organization');
      setItems(filtered);
      return;
    }

    if (activeTab === 'google_sheets' || activeTab === 'gemini_api') {
      setItems([]);
      return;
    }

    setLoading(true);
    const table = getTableName(activeTab);
    try {
      const { data, error } = await supabase.from(table).select('*').order('name');
      if (error) throw error;
      setItems(data || []);
    } catch (e: any) {
      console.error('Fetch error:', e);
      addToast({
        id: `fetch-error-${Date.now()}`,
        type: 'ticket',
        title: 'Error loading data',
        body: e.message || 'Unknown error occurred',
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, ctxOrganizations, ctxDepartments, addToast]);

  useEffect(() => {
    fetchData();
    setIsAdding(false);
    setEditingId(null);
    setNewItemName('');
    if (activeTab === 'organizations') {
      setNewItemProjectId(activeProject?.id || projects[0]?.id || '');
    } else {
      setNewItemProjectId(selectedProjectId !== 'all' ? selectedProjectId : '');
    }
  }, [activeTab, activeProject?.id, fetchData, projects, selectedProjectId]);

  const isProjectScopedTab = PROJECT_SCOPED_TABS.includes(activeTab);

  const handleAdd = async () => {
    if (!newItemName.trim()) return;
    setSubmitting(true);
    const table = getTableName(activeTab);

    const payload: any = {
      name: newItemName,
      is_active: true,
    };

    if (activeTab === 'organizations') {
      payload.abbreviation = newItemAbbr.trim() || newItemName.slice(0, 10).toUpperCase();
      payload.ticket_prefix = `SRS_${payload.abbreviation}_`;
      if (newItemProjectId) payload.project_id = newItemProjectId;
    } else if (isProjectScopedTab) {
      payload.project_id = newItemProjectId || null;
    }

    if (activeTab === 'line_groups') {
      payload.group_id = newItemAbbr.trim();
      if (!payload.group_id) {
        alert('กรุณาระบุ LINE Group ID');
        setSubmitting(false);
        return;
      }
    }

    if (activeTab === 'hospital_depts' || activeTab === 'departments') {
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

      if (activeTab === 'organizations') await refreshData('organizations');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_CREATE',
        entity_type: table.toUpperCase(),
        new_data: payload,
        note: `Created new ${table}: ${newItemName} (${activeTab})`,
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
    if (activeTab === 'organizations') {
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

      if (activeTab === 'organizations') await refreshData('organizations');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_UPDATE',
        entity_type: table.toUpperCase(),
        entity_id: id,
        new_data: updateData,
        note: `Updated ${table} to: ${editItemName} ${activeTab === 'organizations' ? `(${editItemAbbr})` : ''}`,
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
      if (activeTab === 'organizations') await refreshData('organizations');
      else if (activeTab === 'departments' || activeTab === 'hospital_depts') await refreshData('departments');
      else fetchData();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      await auditService.log({
        performer_id: user?.id,
        action_type: 'MASTER_TOGGLE',
        entity_type: table.toUpperCase(),
        entity_id: id,
        new_data: { is_active: !current },
        note: `Toggled ${table} status to: ${!current ? 'Active' : 'Inactive'}`,
      });

      addToast({
        id: `master-toggle-${id}`,
        type: 'ticket',
        title: t('settingsMaster.toggleSuccessTitle'),
        body: t('settingsMaster.toggleSuccessBody'),
      });
    }
  };

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));

  const TAB_CONFIG: Record<Tab, { title: string; icon: React.ComponentType<any>; desc: string; scope: 'project' | 'hybrid' | 'global' | 'integration' }> = {
    organizations: {
      title: t('settingsMaster.tabs.organizations'),
      icon: Building2,
      desc: t('settingsMaster.descriptions.organizations'),
      scope: 'project',
    },
    departments: {
      title: t('settingsMaster.tabs.departments'),
      icon: Users,
      desc: t('settingsMaster.descriptions.departments'),
      scope: 'global',
    },
    hospital_depts: {
      title: t('settingsMaster.tabs.hospitalDepartments'),
      icon: Layout,
      desc: t('settingsMaster.descriptions.hospitalDepartments'),
      scope: 'global',
    },
    positions: {
      title: t('settingsMaster.tabs.positions'),
      icon: Briefcase,
      desc: t('settingsMaster.descriptions.positions'),
      scope: 'global',
    },
    modules: {
      title: t('settingsMaster.tabs.modules'),
      icon: FileText,
      desc: t('settingsMaster.descriptions.modules'),
      scope: 'hybrid',
    },
    issue_types: {
      title: t('settingsMaster.tabs.issueTypes'),
      icon: Tag,
      desc: t('settingsMaster.descriptions.issueTypes'),
      scope: 'hybrid',
    },
    subject_types: {
      title: t('settingsMaster.tabs.subjectTypes'),
      icon: MessageSquare,
      desc: t('settingsMaster.descriptions.subjectTypes'),
      scope: 'hybrid',
    },
    line_groups: {
      title: t('settingsMaster.tabs.lineGroups'),
      icon: MessageSquare,
      desc: t('settingsMaster.descriptions.lineGroups'),
      scope: 'global',
    },
    google_sheets: {
      title: 'Google Sheets',
      icon: FileSpreadsheet,
      desc: 'ตั้งค่าการเชื่อมโยงรายงานไปยัง Google Sheets ประจำวัน',
      scope: 'integration',
    },
    gemini_api: {
      title: 'Gemini AI API',
      icon: Sparkles,
      desc: 'ตั้งค่า Gemini AI API Key สำหรับวิเคราะห์สรุปรายงานและคำแนะนำในสไลด์',
      scope: 'integration',
    },
  };

  const ActiveIcon = TAB_CONFIG[activeTab].icon;
  const activeScope = TAB_CONFIG[activeTab].scope;

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <ActiveIcon size={22} color="var(--color-primary)" aria-hidden="true" />
            <span>{t('settingsMaster.title')}</span>
          </span>
        }
        subtitle={TAB_CONFIG[activeTab].desc}
        badge={
          activeScope === 'hybrid' ? (
            <Badge variant="info" size="md">
              Hybrid (Global / Per-Project)
            </Badge>
          ) : activeScope === 'project' ? (
            <Badge variant="primary" size="md">
              Per-Project
            </Badge>
          ) : activeScope === 'global' ? (
            <Badge variant="success" size="md">
              Global Shared
            </Badge>
          ) : (
            <Badge variant="neutral" size="md">
              Integration
            </Badge>
          )
        }
      />

      {/* Segmented Tabs */}
      <div className={styles.segmentedTabs} role="tablist" aria-label={t('settingsMaster.title')}>
        {(
          [
            'organizations',
            'departments',
            'hospital_depts',
            'positions',
            'modules',
            'issue_types',
            'subject_types',
            'line_groups',
            'google_sheets',
            'gemini_api',
          ] as Tab[]
        ).map((tabKey) => {
          const TabIcon = TAB_CONFIG[tabKey].icon;
          const isActive = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tabKey)}
              className={`${styles.segmentedTab} ${isActive ? styles.segmentedTabActive : ''}`}
            >
              <TabIcon size={15} aria-hidden="true" />
              <span>{TAB_CONFIG[tabKey].title.split(' / ')[0]}</span>
            </button>
          );
        })}
      </div>

      {/* Main Content */}
      {activeTab === 'google_sheets' ? (
        <GoogleSheetsConfigForm globalSettings={globalSettings} onSaveSuccess={() => refreshData('settings')} />
      ) : activeTab === 'gemini_api' ? (
        <GeminiConfigForm globalSettings={globalSettings} onSaveSuccess={() => refreshData('settings')} />
      ) : (
        <Card>
          <div className={styles.toolbar}>
            <div className={styles.searchWrap}>
              <Input
                type="search"
                aria-label={`${t('settingsMaster.search')} ${TAB_CONFIG[activeTab].title}`}
                placeholder={`${t('settingsMaster.search')} ${TAB_CONFIG[activeTab].title}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search size={16} aria-hidden="true" />}
              />
            </div>

            <Button
              variant="primary"
              onClick={() => setIsAdding(true)}
              disabled={!canEdit}
              leftIcon={<Plus size={16} aria-hidden="true" />}
            >
              {t('settingsMaster.addItem')}
            </Button>
          </div>

          {isAdding && (
            <div className={styles.masterAddPanel}>
              <div style={{ flex: 2, minWidth: '200px' }}>
                <Input
                  autoFocus
                  label={TAB_CONFIG[activeTab].title.split(' / ')[0]}
                  placeholder={`${t('settingsMaster.addItemNamed')} ${TAB_CONFIG[activeTab].title}...`}
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                />
              </div>

              {(activeTab === 'organizations' || activeTab === 'line_groups') && (
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <Input
                    label={activeTab === 'line_groups' ? 'LINE Group ID' : t('settingsMaster.abbreviation')}
                    placeholder={activeTab === 'line_groups' ? 'LINE Group ID' : t('settingsMaster.abbreviation')}
                    value={newItemAbbr}
                    onChange={(e) => setNewItemAbbr(e.target.value)}
                    className="tabular-nums"
                  />
                </div>
              )}

              {isProjectScopedTab && projects.length > 0 && (
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <Select
                    label="ขอบเขตโครงการ"
                    value={newItemProjectId}
                    onChange={(e) => setNewItemProjectId(e.target.value)}
                  >
                    {activeTab !== 'organizations' && <option value="">ใช้ร่วมทุกโครงการ (Global)</option>}
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} • {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {activeTab === 'hospital_depts' && (
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <Select label={t('settingsMaster.selectHospital')} value="" onChange={() => {}}>
                    <option value="">{t('settingsMaster.selectHospital')}</option>
                    {organizations.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              <div className={styles.rowGap}>
                <Button
                  variant="primary"
                  iconOnly
                  onClick={handleAdd}
                  loading={submitting}
                  aria-label="บันทึกข้อมูลใหม่"
                >
                  <Check size={16} aria-hidden="true" />
                </Button>
                <Button
                  variant="secondary"
                  iconOnly
                  onClick={() => setIsAdding(false)}
                  aria-label="ยกเลิกการเพิ่มข้อมูล"
                >
                  <X size={16} aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}

          <div>
            {loading ? (
              <div
                className="flex-center"
                style={{ height: '260px', flexDirection: 'column', gap: 'var(--space-3)' }}
                role="status"
              >
                <Loader2 className="animate-spin" color="var(--color-primary)" size={28} aria-hidden="true" />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>
                  {t('common.messages.loading')}
                </p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 'var(--space-6)' }}>
                <EmptyState
                  compact
                  icon={<ActiveIcon size={20} aria-hidden="true" />}
                  title={t('common.messages.noResults')}
                />
              </div>
            ) : (
              <div>
                {filteredItems.map((item) => (
                  <div key={item.id} className={styles.masterRow}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1, minWidth: 0 }}>
                      <div
                        className={`${styles.statIcon} ${item.is_active ? styles.statIconPrimary : ''}`}
                        style={
                          !item.is_active
                            ? {
                                background: 'var(--color-surface-subtle)',
                                color: 'var(--color-text-muted)',
                                borderColor: 'var(--color-border)',
                              }
                            : undefined
                        }
                      >
                        <ActiveIcon size={16} aria-hidden="true" />
                      </div>

                      {editingId === item.id ? (
                        <div className={styles.rowGap} style={{ flexWrap: 'wrap', flex: 1 }}>
                          <div style={{ minWidth: '220px', flex: '1 1 220px', maxWidth: '340px' }}>
                            <Input
                              autoFocus
                              aria-label="แก้ไขชื่อรายการ"
                              value={editItemName}
                              onChange={(e) => setEditItemName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleUpdate(item.id)}
                            />
                          </div>
                          {(activeTab === 'organizations' || activeTab === 'line_groups') && (
                            <div style={{ width: '140px' }}>
                              <Input
                                aria-label={activeTab === 'line_groups' ? 'LINE Group ID' : 'ตัวย่อ'}
                                placeholder={activeTab === 'line_groups' ? 'LINE Group ID' : 'ย่อ'}
                                value={editItemAbbr}
                                onChange={(e) => setEditItemAbbr(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdate(item.id)}
                                className="tabular-nums"
                              />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                            <p
                              style={{
                                fontSize: 'var(--text-sm)',
                                fontWeight: 'var(--weight-semibold)',
                                color: item.is_active ? 'var(--color-text)' : 'var(--color-text-muted)',
                              }}
                            >
                              {item.name}
                            </p>

                            {activeTab === 'organizations' && item.abbreviation && (
                              <Badge variant="neutral" size="sm">
                                <span className="tabular-nums">{item.abbreviation}</span>
                              </Badge>
                            )}

                            {isProjectScopedTab &&
                              projects.length > 0 &&
                              (() => {
                                const proj = projects.find((p) => p.id === item.project_id);
                                if (!proj && activeTab !== 'organizations') {
                                  return (
                                    <Badge variant="success" size="sm">
                                      GLOBAL
                                    </Badge>
                                  );
                                }
                                if (!proj) return null;
                                return (
                                  <Badge variant="neutral" size="sm" dot={proj.primary_color || '#1d4ed8'}>
                                    <span className="tabular-nums">{proj.code}</span>
                                  </Badge>
                                );
                              })()}

                            {activeTab === 'line_groups' && item.group_id && (
                              <Badge variant="info" size="sm">
                                <span className="tabular-nums">{item.group_id}</span>
                              </Badge>
                            )}
                          </div>
                          <span
                            className="tabular-nums"
                            style={{
                              fontSize: '11px',
                              color: 'var(--color-text-subtle)',
                              textTransform: 'uppercase',
                            }}
                          >
                            ID: {item.id.slice(0, 8)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className={styles.rowGap}>
                      <Button
                        size="sm"
                        variant={item.is_active ? 'secondary' : 'ghost'}
                        onClick={() => {
                          if (!canEdit) return;
                          toggleStatus(item.id, item.is_active);
                        }}
                        disabled={!canEdit}
                      >
                        <Badge variant={item.is_active ? 'success' : 'neutral'} size="sm" dot>
                          {item.is_active ? t('settingsMaster.active') : t('settingsMaster.inactive')}
                        </Badge>
                      </Button>

                      {editingId === item.id ? (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            iconOnly
                            onClick={() => handleUpdate(item.id)}
                            loading={submitting}
                            aria-label="บันทึกการแก้ไข"
                          >
                            <Check size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            iconOnly
                            onClick={() => setEditingId(null)}
                            aria-label="ยกเลิกการแก้ไข"
                          >
                            <X size={15} aria-hidden="true" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          iconOnly
                          onClick={() => {
                            if (!canEdit) return;
                            setEditingId(item.id);
                            setEditItemName(item.name);
                            setEditItemAbbr(activeTab === 'line_groups' ? item.group_id : item.abbreviation || '');
                          }}
                          disabled={!canEdit}
                          aria-label={`แก้ไข ${item.name}`}
                        >
                          <Edit3 size={15} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function GoogleSheetsConfigForm({
  globalSettings,
  onSaveSuccess,
}: {
  globalSettings: any;
  onSaveSuccess: () => void;
}) {
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
          body: 'บันทึก Google Sheets URL เรียบร้อยแล้ว ✨',
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
      body: 'คัดลอกโค้ดสคริปต์ไปยังคลิปบอร์ดแล้ว 📋',
    });
  };

  return (
    <div className={styles.stackLg}>
      <Card>
        <CardBody className={styles.stackMd}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              <Input
                type="url"
                label="Google Sheets Web App URL"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              leftIcon={<Check size={16} aria-hidden="true" />}
            >
              บันทึกการตั้งค่า
            </Button>
          </div>

          {dbError === 'column_missing' && (
            <div className={`${styles.alertBanner} ${styles.alertDanger}`} style={{ flexDirection: 'column' }}>
              <strong style={{ fontSize: 'var(--text-sm)' }}>
                ⚠️ ตรวจพบตารางฐานข้อมูลรุ่นเก่า (Database Schema Update Required)
              </strong>
              <p style={{ fontSize: 'var(--text-xs)', lineHeight: 'var(--leading-normal)' }}>
                ระบบตรวจพบว่าตาราง <code>company_settings</code> ในฐานข้อมูล Supabase ของคุณยังไม่มีคอลัมน์{' '}
                <code>google_sheets_url</code> กรุณารันคำสั่ง SQL ด้านล่างนี้ใน SQL Editor บน Supabase Dashboard แล้วลองบันทึกอีกครั้ง:
              </p>
              <pre className={styles.codeBlock} style={{ width: '100%' }}>
                ALTER TABLE public.company_settings ADD COLUMN IF NOT EXISTS google_sheets_url TEXT;
              </pre>
            </div>
          )}
        </CardBody>
      </Card>

      <div className={styles.twoColEqual}>
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <FileSpreadsheet size={18} color="var(--color-success)" aria-hidden="true" />
              <CardTitle>ขั้นตอนการติดตั้งระบบบันทึกข้อมูล</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <ol
              style={{
                margin: 0,
                paddingLeft: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
                lineHeight: 'var(--leading-normal)',
              }}
            >
              <li>
                <strong style={{ color: 'var(--color-text)' }}>สร้างและเตรียมสเปรดชีต:</strong> เปิด Google Sheets
                ของคุณขึ้นมาก่อน (แนะนำให้เปิดไฟล์สเปรดชีตเปล่าที่ต้องการเก็บบันทึก)
              </li>
              <li>
                <strong style={{ color: 'var(--color-text)' }}>สร้างสคริปต์ที่ผูกกับตาราง:</strong> เลือกเมนู{' '}
                <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong> เพื่อให้สคริปต์ผูกเข้ากับชีตโดยตรง
              </li>
              <li>
                <strong style={{ color: 'var(--color-text)' }}>คัดลอกโค้ดไปวาง:</strong> กดปุ่ม{' '}
                <strong>&ldquo;คัดลอกโค้ดสคริปต์&rdquo;</strong> ทางด้านขวา วางแทนโค้ดเดิมแล้วกด{' '}
                <strong>บันทึก (Save)</strong>
              </li>
              <li>
                <strong style={{ color: 'var(--color-text)' }}>เผยแพร่เป็นเว็บแอป:</strong> คลิก{' '}
                <strong>การใช้งานได้จริง (Deploy) &gt; การทำงานใหม่ (New deployment)</strong> เลือกประเภท{' '}
                <strong>เว็บแอป (Web app)</strong>
              </li>
              <li>
                <strong style={{ color: 'var(--color-text)' }}>ตั้งค่าสิทธิ์ให้เป็นสาธารณะ:</strong> ตั้งค่า{' '}
                <strong>ผู้ที่มีสิทธิ์เข้าถึง (Who has access)</strong> เป็น <strong>ทุกคน (Anyone)</strong> แล้วกด Deploy
              </li>
              <li>
                <strong style={{ color: 'var(--color-text)' }}>คัดลอกลิงก์มาบันทึก:</strong> นำ{' '}
                <strong>Web app URL</strong> ที่ได้มาวางในช่องด้านบนแล้วกด <strong>&ldquo;บันทึกการตั้งค่า&rdquo;</strong>
              </li>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={copyToClipboard}
                leftIcon={copied ? <Check size={14} color="var(--color-success)" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
              >
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกโค้ดสคริปต์'}
              </Button>
            }
          >
            <CardTitle>โค้ด Google Apps Script</CardTitle>
          </CardHeader>
          <CardBody>
            <pre className={styles.codeBlock}>{appsScriptCode}</pre>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function GeminiConfigForm({
  globalSettings,
  onSaveSuccess,
}: {
  globalSettings: any;
  onSaveSuccess: () => void;
}) {
  const { addToast } = useNotificationContext();
  const [apiKey, setApiKey] = useState(globalSettings?.gemini_api_key || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (globalSettings?.gemini_api_key) {
      setApiKey(globalSettings.gemini_api_key);
    }
  }, [globalSettings]);

  const handleTestApi = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'กรุณากรอก API Key ก่อนทดสอบ' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    const endpoints = [
      {
        url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        label: 'Gemini 1.5 Flash (v1)',
      },
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`,
        label: 'Gemini 1.5 Flash (v1beta)',
      },
      {
        url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey.trim()}`,
        label: 'Gemini 2.5 Flash (v1beta)',
      },
    ];

    let lastErrorMsg = '';

    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Respond with exactly one word: OK' }] }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.candidates && data.candidates.length > 0) {
            setTestResult({
              success: true,
              message: `การเชื่อมต่อสำเร็จผ่าน ${endpoint.label}! API Key สามารถใช้งานได้`,
            });
            setTesting(false);
            return;
          }
        } else {
          const errorData = await response.json().catch(() => null);
          lastErrorMsg = errorData?.error?.message || response.statusText;
        }
      } catch (e: any) {
        lastErrorMsg = e.message;
      }
    }

    setTestResult({
      success: false,
      message: `ล้มเหลว: ${lastErrorMsg || 'ไม่สามารถเชื่อมต่อได้ทุกรุ่นจำลอง'}`,
    });
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_settings')
        .update({ gemini_api_key: apiKey.trim() })
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
          body: 'บันทึก Gemini API Key เรียบร้อยแล้ว ✨',
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
    <div style={{ maxWidth: '600px', width: '100%' }}>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
              <Sparkles size={18} aria-hidden="true" />
            </div>
            <div>
              <CardTitle>ตั้งค่า Gemini AI API Key</CardTitle>
              <CardDescription>Gemini AI API Configuration</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardBody className={styles.stackMd}>
          <Input
            type="password"
            label="Gemini API Key สำหรับสรุปรายงาน"
            placeholder="AIza..."
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value);
              setTestResult(null);
            }}
            hint="บันทึก API Key ของระบบเพื่อเปิดใช้งานการวิเคราะห์สรุปความพึงพอใจและแนวทางแก้ไขโดย Gemini อัตโนมัติในสไลด์พรีเซนต์"
          />

          {testResult && (
            <div
              className={`${styles.alertBanner} ${testResult.success ? styles.alertSuccess : styles.alertDanger}`}
              role="status"
            >
              <span>{testResult.message}</span>
            </div>
          )}

          <div className={styles.formGrid2}>
            <Button
              variant="secondary"
              onClick={handleTestApi}
              loading={testing}
              disabled={!apiKey}
              leftIcon={<Sparkles size={16} aria-hidden="true" />}
              fullWidth
            >
              ทดสอบการเชื่อมต่อ
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              loading={saving}
              leftIcon={<Check size={16} aria-hidden="true" />}
              fullWidth
            >
              บันทึกการตั้งค่า
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
