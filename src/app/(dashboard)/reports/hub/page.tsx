'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Zap,
} from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useAppContext } from '@/contexts/AppContext';
import DailyReportPage from '../daily/page';
import PresentationPage from '../presentation/page';

type ReportSet = '1' | '2';
type ReportBroadcastMode = 'manual' | 'auto';

type ReportScheduleRow = {
  id: string;
  time: string;
  set: ReportSet;
  enabled: boolean;
};

type ReportBroadcastSettings = {
  mode: ReportBroadcastMode;
  groupId: string | null;
  schedules: ReportScheduleRow[];
};

type LineGroup = {
  id: string;
  name: string;
  group_id: string;
  is_active: boolean;
};

type SettingsResponse = {
  settings?: ReportBroadcastSettings;
  groups?: LineGroup[];
  schemaReady?: boolean;
  error?: string;
};

type PreviewResponse = {
  total: number;
  newProgress: number;
  resolved: number;
  hospitalGroups: Record<string, number>;
  targetGroupName?: string;
};

const DEFAULT_SETTINGS: ReportBroadcastSettings = {
  mode: 'manual',
  groupId: null,
  schedules: [],
};

function toYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatPreviewDate(ymd: string, locale: 'th' | 'en'): string {
  const date = new Date(`${ymd}T00:00:00`);
  const intlLocale = locale === 'th' ? 'th-TH' : 'en-US';
  return new Intl.DateTimeFormat(intlLocale, {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function makeScheduleRow(): ReportScheduleRow {
  return {
    id: `row-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    time: '08:30',
    set: '1',
    enabled: true,
  };
}

export default function ReportsPage() {
  const { t, locale } = useStaffLocale();
  const { userProfile } = useAppContext();

  const [activeTab, setActiveTab] = useState<string>('daily');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState<ReportSet | null>(null);
  const [targetDate, setTargetDate] = useState(() => toYmd(new Date()));
  const [preview, setPreview] = useState<PreviewResponse>({
    total: 0,
    newProgress: 0,
    resolved: 0,
    hospitalGroups: {},
    targetGroupName: '',
  });
  const [settings, setSettings] = useState<ReportBroadcastSettings>(DEFAULT_SETTINGS);
  const [lineGroups, setLineGroups] = useState<LineGroup[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [schemaReady, setSchemaReady] = useState(true);
  const [settingsError, setSettingsError] = useState('');

  const renderTabBar = () => {
    const tabs = [
      { id: 'daily', label: locale === 'th' ? '📝 รายงานประจำวัน' : '📝 Daily Report' },
      { id: 'hub', label: locale === 'th' ? '📂 ศูนย์จัดเก็บรายงาน' : '📂 Report Hub' },
      { id: 'presentation', label: locale === 'th' ? '💻 Weekly Presentation' : '💻 Weekly Presentation' }
    ];

    return (
      <div 
        style={{ 
          position: 'sticky', 
          top: '0px', 
          zIndex: 99, 
          background: 'var(--bg-deep)', 
          paddingTop: '16px', 
          paddingBottom: '16px', 
          borderBottom: '1px solid var(--border)', 
          marginRight: '-24px', 
          marginLeft: '-24px', 
          paddingRight: '24px', 
          paddingLeft: '24px',
          marginBottom: '24px',
          backdropFilter: 'blur(10px)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <div 
          style={{ 
            display: 'inline-flex', 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid var(--border)', 
            borderRadius: '16px', 
            padding: '6px', 
            gap: '6px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
            flexWrap: 'wrap'
          }}
        >
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="glass-interactive"
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isActive ? 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-muted)',
                  fontSize: '13px',
                  fontWeight: isActive ? '850' : '600',
                  cursor: 'pointer',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? '0 4px 15px rgba(0, 242, 254, 0.25)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const canSend = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.reports === 'edit';
  }, [userProfile]);

  const previewDateLabel = useMemo(
    () => formatPreviewDate(targetDate, locale),
    [locale, targetDate]
  );

  const hospitalLabel = useMemo(
    () => (locale === 'th' ? 'สรุปรายองค์กร/บริษัท' : 'Organization Summary'),
    [locale]
  );
  const reportModeLabel = useMemo(
    () => (locale === 'th' ? 'โหมดการส่งรายงาน' : 'Report delivery mode'),
    [locale]
  );
  const lineGroupLabel = useMemo(
    () => (locale === 'th' ? 'กลุ่ม LINE ปลายทาง' : 'Target LINE group'),
    [locale]
  );
  const scheduleLabel = useMemo(
    () => (locale === 'th' ? 'ช่วงเวลาส่งอัตโนมัติ' : 'Automatic schedule'),
    [locale]
  );
  const selectGroupPlaceholder = useMemo(
    () => (locale === 'th' ? '-- เลือกกลุ่ม --' : '-- Select group --'),
    [locale]
  );
  const addScheduleRowLabel = useMemo(
    () => (locale === 'th' ? 'เพิ่มแถวเวลา' : 'Add schedule row'),
    [locale]
  );
  const scheduleSchemaWarning = useMemo(
    () =>
      locale === 'th'
        ? 'ยังบันทึกเวลาอัตโนมัติไม่ได้ กรุณาตรวจว่ารัน add_report_broadcast_settings.sql ใน Supabase ตรง environment นี้แล้ว'
        : 'Automatic schedules are not ready yet. Please make sure add_report_broadcast_settings.sql was executed in this Supabase environment.',
    [locale]
  );
  const loadSettingsErrorLabel = useMemo(
    () => (locale === 'th' ? 'โหลดค่าการส่งรายงานอัตโนมัติไม่สำเร็จ' : 'Failed to load broadcast settings'),
    [locale]
  );
  const saveSettingsErrorLabel = useMemo(
    () => (locale === 'th' ? 'บันทึกไม่สำเร็จ' : 'Failed to save settings'),
    [locale]
  );
  const chooseGroupFirstLabel = useMemo(
    () => (locale === 'th' ? 'กรุณาเลือกกลุ่ม LINE ปลายทางก่อน' : 'Please choose a target LINE group first'),
    [locale]
  );

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/hub/preview?date=${targetDate}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as Partial<PreviewResponse> & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || `Preview API failed (${res.status})`);
      }

      setPreview({
        total: data.total || 0,
        newProgress: data.newProgress || 0,
        resolved: data.resolved || 0,
        hospitalGroups: data.hospitalGroups || {},
        targetGroupName: data.targetGroupName || '',
      });
    } catch (error) {
      console.error('fetch preview failed', error);
      setPreview({
        total: 0,
        newProgress: 0,
        resolved: 0,
        hospitalGroups: {},
        targetGroupName: '',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcastSettings = async () => {
    try {
      const res = await fetch('/api/reports/hub/settings', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as SettingsResponse;
      if (!res.ok) {
        throw new Error(data.error || loadSettingsErrorLabel);
      }

      setSettings(data.settings || DEFAULT_SETTINGS);
      setLineGroups(data.groups || []);
      setSchemaReady(data.schemaReady !== false);
      setSettingsError('');
    } catch (error) {
      console.error('load settings failed', error);
      setSchemaReady(false);
      setSettingsError(
        error instanceof Error && error.message ? error.message : loadSettingsErrorLabel
      );
    }
  };

  useEffect(() => {
    if (activeTab === 'hub') {
      void fetchPreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetDate, activeTab]);

  useEffect(() => {
    if (activeTab === 'hub') {
      void fetchBroadcastSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const groupedData = useMemo(() => {
    const normalizedHospitalGroups: Record<string, number> = {};
    for (const [name, count] of Object.entries(preview.hospitalGroups || {})) {
      normalizedHospitalGroups[name || t('reports.unspecifiedHospital')] = count;
    }
    return {
      total: preview.total,
      newProgress: preview.newProgress,
      resolved: preview.resolved,
      hospitalGroups: normalizedHospitalGroups,
    };
  }, [preview, t]);

  const selectedGroupName = useMemo(() => {
    return (
      lineGroups.find((group) => group.group_id === settings.groupId)?.name ||
      preview.targetGroupName ||
      ''
    );
  }, [lineGroups, preview.targetGroupName, settings.groupId]);
  const isManualMode = settings.mode === 'manual';
  const confirmScheduleChangeLabel =
    locale === 'th'
      ? 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¸à¸²à¸£à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™à¸Šà¹ˆà¸§à¸‡à¹€à¸§à¸¥à¸²à¸ªà¹ˆà¸‡à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹ƒà¸Šà¹ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?'
      : 'Confirm schedule time change?';
  const confirmAddScheduleLabel =
    locale === 'th'
      ? 'à¸¢à¸·à¸™à¸¢à¸±à¸™à¹€à¸žà¸´à¹ˆà¸¡à¹à¸–à¸§à¹€à¸§à¸¥à¸²à¸­à¸±à¸•à¹‚à¸™à¸¡à¸±à¸•à¸´à¹ƒà¸Šà¹ˆà¸«à¸£à¸·à¸­à¹„à¸¡à¹ˆ?'
      : 'Confirm adding a new schedule row?';

  const persistSettings = async (next: ReportBroadcastSettings) => {
    setSettings(next);
    if (!canSend) return;

    setSettingsError('');
    setSavingSettings(true);
    try {
      const res = await fetch('/api/reports/hub/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || saveSettingsErrorLabel);
      }

      setSchemaReady(true);
      void fetchBroadcastSettings();
    } catch (error) {
      console.error('save settings failed', error);
      const message =
        error instanceof Error && error.message ? error.message : saveSettingsErrorLabel;
      setSettingsError(message);
      alert(message);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSendReport = async (set: ReportSet) => {
    if (!settings.groupId) {
      alert(chooseGroupFirstLabel);
      return;
    }

    const reportName = set === '1' ? t('reports.set1Title') : t('reports.set2Title');
    if (!window.confirm(`${t('common.messages.confirmAction')}: ${reportName} ?`)) return;

    setSending(set);
    try {
      const res = await fetch(
        `/api/cron/daily-summary?key=NEO_CRON_2026&set=${set}&date=${targetDate}`,
        { cache: 'no-store' }
      );
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };

      if (data.success) {
        alert(`${t('common.messages.success')}: "${reportName}"`);
      } else {
        alert(`${t('common.messages.error')}: ${data.error || 'Unknown Error'}`);
      }
    } catch (error) {
      console.error('send report failed', error);
      alert(t('common.messages.error'));
    } finally {
      setSending(null);
    }
  };

  return (
    <div
      style={{
        animation: 'fadeIn 0.5s ease-out',
        width: '100%',
        maxWidth: 'none',
        paddingBottom: '40px',
      }}
    >
      {renderTabBar()}

      {/* Tab: Daily Report */}
      <div style={{ display: activeTab === 'daily' ? 'block' : 'none', width: '100%' }}>
        <DailyReportPage />
      </div>

      {/* Tab: Weekly Presentation */}
      <div style={{ display: activeTab === 'presentation' ? 'block' : 'none', width: '100%' }}>
        <PresentationPage />
      </div>

      {/* Tab: Report Hub */}
      <div style={{ display: activeTab === 'hub' ? 'block' : 'none', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginBottom: '32px',
            gap: '24px',
            flexWrap: 'wrap',
          }}
        >
        <div>
          <h1
            style={{
              fontSize: '28px',
              fontWeight: '800',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <ShieldCheck color="var(--primary)" size={32} />
            {t('reports.hubTitle')}
          </h1>
          <p
            style={{
              color: 'var(--text-muted)',
              fontSize: '11px',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}
          >
            {t('reports.hubSubtitle')}
          </p>
        </div>

        <div
          className="glass"
          style={{
            padding: '8px 16px',
            borderRadius: '14px',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <Calendar size={18} color="var(--primary)" />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-main)',
              fontSize: '14px',
              fontWeight: '700',
              outline: 'none',
              cursor: 'pointer',
            }}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 420px)',
          gap: '24px',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div
            className="glass-premium"
            style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}
          >
            <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1 }}>
              <BarChart2 size={120} color="var(--primary)" />
            </div>
            <h3
              style={{
                fontSize: '16px',
                fontWeight: '800',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Eye size={18} color="var(--primary)" />
              {t('reports.previewFor')}: {previewDateLabel}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {[
                {
                  label: t('dashboard.tabs.all'),
                  value: groupedData.total,
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  background: 'rgba(255,255,255,0.03)',
                },
                {
                  label: t('dashboard.inProgress'),
                  value: groupedData.newProgress,
                  color: 'var(--primary)',
                  border: '1px solid var(--primary)',
                  background: 'rgba(0, 242, 254, 0.05)',
                },
                {
                  label: t('dashboard.resolved'),
                  value: groupedData.resolved,
                  color: 'var(--success)',
                  border: '1px solid var(--success)',
                  background: 'rgba(40, 199, 111, 0.05)',
                },
              ].map((card) => (
                <div
                  key={card.label}
                  style={{
                    background: card.background,
                    padding: '16px',
                    borderRadius: '12px',
                    border: card.border,
                  }}
                >
                  <p
                    style={{
                      fontSize: '10px',
                      color: card.color,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                    }}
                  >
                    {card.label}
                  </p>
                  <p style={{ fontSize: '24px', fontWeight: '900', color: card.color }}>
                    {loading ? '...' : card.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass" style={{ padding: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ fontSize: '14px', fontWeight: '800' }}>{hospitalLabel}</h3>
              {loading && <Zap size={16} className="animate-pulse" color="var(--primary)" />}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {Object.entries(groupedData.hospitalGroups).length === 0 && !loading ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <Zap size={32} style={{ opacity: 0.1, marginBottom: '12px' }} />
                  <p>{t('reports.noDataRange')}</p>
                </div>
              ) : (
                Object.entries(groupedData.hospitalGroups).map(([name, count]) => (
                  <div
                    key={name}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.02)',
                      borderRadius: '10px',
                      border: '1px solid var(--border)',
                      gap: '12px',
                    }}
                  >
                    <span style={{ fontSize: '14px', fontWeight: '600' }}>{name}</span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: '800',
                        background: 'var(--primary)',
                        color: 'black',
                        padding: '2px 10px',
                        borderRadius: '20px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {count} {t('tickets.unit')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass" style={{ padding: '16px', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 800 }}>
              {reportModeLabel}
            </p>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                disabled={!canSend}
                className="glass-interactive"
                onClick={() => persistSettings({ ...settings, mode: 'manual' })}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    settings.mode === 'manual' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: settings.mode === 'manual' ? 'black' : 'var(--text-main)',
                }}
              >
                Manual
              </button>
              <button
                disabled={!canSend}
                className="glass-interactive"
                onClick={() => persistSettings({ ...settings, mode: 'auto' })}
                style={{
                  flex: 1,
                  borderRadius: 10,
                  padding: '10px',
                  border: 'none',
                  cursor: 'pointer',
                  background:
                    settings.mode === 'auto' ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                  color: settings.mode === 'auto' ? 'black' : 'var(--text-main)',
                }}
              >
                Auto
              </button>
            </div>

            <p style={{ fontSize: '12px', marginBottom: '8px', fontWeight: 800 }}>
              {lineGroupLabel}
            </p>
            <select
              value={settings.groupId || ''}
              disabled={!canSend || savingSettings}
              onChange={(e) => void persistSettings({ ...settings, groupId: e.target.value || null })}
              style={{
                width: '100%',
                borderRadius: 10,
                padding: '10px',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                color: 'var(--text-main)',
              }}
            >
              <option value="">{selectGroupPlaceholder}</option>
              {lineGroups.map((group) => (
                <option key={group.id} value={group.group_id}>
                  {group.name}
                </option>
              ))}
            </select>

            {schemaReady === false && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(234, 84, 85, 0.25)',
                  background: 'rgba(234, 84, 85, 0.06)',
                  color: 'var(--danger)',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                {scheduleSchemaWarning}
              </div>
            )}

            {settingsError && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: '1px solid rgba(251, 192, 45, 0.25)',
                  background: 'rgba(251, 192, 45, 0.08)',
                  color: '#9a6a00',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}
              >
                {settingsError}
              </div>
            )}

            <p style={{ fontSize: '12px', margin: '14px 0 8px', fontWeight: 800 }}>
              {scheduleLabel}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {settings.schedules.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="time"
                    value={row.time}
                    disabled={!canSend || savingSettings || isManualMode}
                    onChange={(e) =>
                      void (window.confirm(confirmScheduleChangeLabel) &&
                        persistSettings({
                          ...settings,
                          schedules: settings.schedules.map((item) =>
                            item.id === row.id ? { ...item, time: e.target.value } : item
                          ),
                        }))
                    }
                    style={{
                      borderRadius: 10,
                      padding: '10px',
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-main)',
                    }}
                    lang="fr-CA"
                  />
                  <select
                    value={row.set}
                    disabled={!canSend || savingSettings || isManualMode}
                    onChange={(e) =>
                      void (window.confirm(confirmScheduleChangeLabel) &&
                        persistSettings({
                          ...settings,
                          schedules: settings.schedules.map((item) =>
                            item.id === row.id
                              ? { ...item, set: e.target.value === '2' ? '2' : '1' }
                              : item
                          ),
                        }))
                    }
                    style={{
                      borderRadius: 10,
                      padding: '10px',
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--text-main)',
                    }}
                  >
                    <option value="1">SET 1</option>
                    <option value="2">SET 2</option>
                  </select>
                  <button
                    disabled={!canSend || savingSettings || isManualMode}
                    onClick={() =>
                      void persistSettings({
                        ...settings,
                        schedules: settings.schedules.filter((item) => item.id !== row.id),
                      })
                    }
                    style={{
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'rgba(255,255,255,0.04)',
                      color: 'var(--danger)',
                      width: 40,
                      height: 40,
                      cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button
                disabled={!canSend || savingSettings || isManualMode}
                onClick={() =>
                  void (window.confirm(confirmAddScheduleLabel) &&
                    persistSettings({
                      ...settings,
                      schedules: [...settings.schedules, makeScheduleRow()],
                    }))
                }
                style={{
                  borderRadius: 10,
                  border: '1px dashed var(--border)',
                  background: 'transparent',
                  color: 'var(--primary)',
                  padding: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Plus size={14} /> {addScheduleRowLabel}
              </button>
            </div>
          </div>

          <div className="glass-premium" style={{ padding: '24px', border: '1px solid #FBC02D' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <FileText color="#FBC02D" size={24} />
              <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 1</h4>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: '24px',
                lineHeight: '1.6',
              }}
            >
              {t('reports.set1Desc')}
            </p>
            <button
              disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
              onClick={() => void handleSendReport('1')}
              className="glass-interactive"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: !canSend
                  ? 'rgba(255,255,255,0.05)'
                  : sending === '1'
                    ? 'var(--bg-card)'
                    : '#FBC02D',
                color: !canSend ? 'var(--text-muted)' : 'black',
                fontWeight: '900',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: groupedData.total === 0 || loading ? 0.5 : 1,
              }}
            >
              {sending === '1' ? (
                t('common.messages.loading')
              ) : (
                <>
                  <Send size={18} /> {t('reports.sendSet1')}
                </>
              )}
            </button>
          </div>

          <div className="glass-premium" style={{ padding: '24px', border: '1px solid var(--primary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <Send color="var(--primary)" size={24} />
              <h4 style={{ fontWeight: '800', fontSize: '15px' }}>REPORT SET 2</h4>
            </div>
            <p
              style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginBottom: '24px',
                lineHeight: '1.6',
              }}
            >
              {t('reports.set2Desc')}
            </p>
            <button
              disabled={sending !== null || groupedData.total === 0 || loading || !canSend}
              onClick={() => void handleSendReport('2')}
              className="glass-interactive"
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '12px',
                background: !canSend
                  ? 'rgba(255,255,255,0.05)'
                  : sending === '2'
                    ? 'var(--bg-card)'
                    : 'var(--primary)',
                color: !canSend ? 'var(--text-muted)' : 'black',
                fontWeight: '900',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                opacity: groupedData.total === 0 || loading ? 0.5 : 1,
              }}
            >
              {sending === '2' ? (
                t('common.messages.loading')
              ) : (
                <>
                  <ChevronRight size={18} /> {t('reports.sendSet2')}
                </>
              )}
            </button>
          </div>

          <div
            style={{
              padding: '16px',
              background: 'rgba(234, 84, 85, 0.05)',
              borderRadius: '12px',
              border: '1px solid rgba(234, 84, 85, 0.1)',
              display: 'flex',
              gap: '12px',
            }}
          >
            <AlertCircle size={20} color="var(--danger)" style={{ flexShrink: 0 }} />
            <p style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: '600' }}>
              {t('reports.cautionNote')}
            </p>
          </div>

          {selectedGroupName && (
            <div
              style={{
                padding: '16px',
                background: 'rgba(0, 242, 254, 0.03)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  background: 'rgba(0, 242, 254, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={14} color="var(--primary)" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                  }}
                >
                  {lineGroupLabel}
                </span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'var(--primary)' }}>
                  {selectedGroupName}
                </span>
              </div>
            </div>
          )}

          {groupedData.total > 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--success)',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} /> {t('reports.dataReady')}
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
