'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ChevronLeft,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

export default function SLASettingsPage() {
  const { userProfile } = useAppContext();
  const { t } = useStaffLocale();
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const canEdit = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_sla === 'edit';
  }, [userProfile]);

  useEffect(() => {
    let isMounted = true;

    async function fetchRules() {
      const { data } = await supabase.from('sla_rules').select('*').order('priority', { ascending: true });
      if (!isMounted) return;
      setRules(data || []);
      setLoading(false);
    }

    fetchRules();
    return () => {
      isMounted = false;
    };
  }, []);

  const addRule = () => {
    setRules([...rules, { priority: 'Medium', response_time_minutes: 60, resolution_time_minutes: 1440 }]);
  };

  const updateRule = (index: number, field: string, value: any) => {
    const updated = [...rules];
    updated[index][field] = value;
    setRules(updated);
  };

  const deleteRule = async (index: number) => {
    const ruleToDelete = rules[index];
    if (ruleToDelete.id) {
      await supabase.from('sla_rules').delete().eq('id', ruleToDelete.id);
    }
    setRules(rules.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const rule of rules) {
        if (rule.id) {
          await supabase
            .from('sla_rules')
            .update({
              priority: rule.priority,
              response_time_minutes: rule.response_time_minutes,
              resolution_time_minutes: rule.resolution_time_minutes,
            })
            .eq('id', rule.id);
        } else {
          await supabase.from('sla_rules').insert([rule]);
        }
      }

      const { auditService } = await import('@/lib/services/auditService');
      await auditService.log({
        performer_id: (await supabase.auth.getUser()).data.user?.id,
        action_type: 'SLA_UPDATE',
        entity_type: 'SLA',
        new_data: { rules },
        note: `Updated system SLA priority matrix (${rules.length} rules)`,
      });

      alert(t('settingsSla.saveSuccess'));
    } catch {
      alert(t('settingsSla.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const priorityOptions = [
    { value: 'Critical', label: t('settingsSla.priorities.critical') },
    { value: 'High', label: t('settingsSla.priorities.high') },
    { value: 'Medium', label: t('settingsSla.priorities.medium') },
    { value: 'Low', label: t('settingsSla.priorities.low') },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link href="/analytics" style={{ color: 'var(--text-muted)' }}>
          <ChevronLeft size={24} />
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: '800' }}>{t('settingsSla.title')}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>
        <div className="glass" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700' }}>{t('settingsSla.matrixRules')}</h2>
            <button
              onClick={addRule}
              disabled={!canEdit}
              className="glass-interactive flex-center"
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                gap: '8px',
                opacity: !canEdit ? 0.5 : 1,
                cursor: !canEdit ? 'not-allowed' : 'pointer',
              }}
            >
              <Plus size={16} />
              {t('settingsSla.addRule')}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 className="animate-spin" size={24} color="var(--primary)" />
              </div>
            ) : (
              rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="glass"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'end',
                    background: 'rgba(255,255,255,0.02)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('settingsSla.priorityLevel')}
                    </label>
                    <select
                      value={rule.priority}
                      onChange={(event) => updateRule(idx, 'priority', event.target.value)}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px',
                        color: 'var(--text-main)',
                        fontSize: '14px',
                      }}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('settingsSla.firstResponseMinutes')}
                    </label>
                    <input
                      type="number"
                      value={rule.response_time_minutes}
                      onChange={(event) => updateRule(idx, 'response_time_minutes', parseInt(event.target.value, 10))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px',
                        color: 'var(--text-main)',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '11px',
                        fontWeight: '700',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t('settingsSla.resolutionMinutes')}
                    </label>
                    <input
                      type="number"
                      value={rule.resolution_time_minutes}
                      onChange={(event) =>
                        updateRule(idx, 'resolution_time_minutes', parseInt(event.target.value, 10))
                      }
                      style={{
                        width: '100%',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        padding: '10px',
                        color: 'var(--text-main)',
                        fontSize: '14px',
                      }}
                    />
                  </div>

                  <button
                    onClick={() => deleteRule(idx)}
                    disabled={!canEdit}
                    className="glass-interactive flex-center"
                    style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(234, 84, 85, 0.1)',
                      color: 'var(--danger)',
                      opacity: !canEdit ? 0.3 : 1,
                      cursor: !canEdit ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))
            )}

            {!loading && rules.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px' }}>
                {t('settingsSla.noRules')}
              </p>
            )}
          </div>

          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={handleSave}
              disabled={saving || !canEdit}
              className="glass-interactive flex-center"
              style={{
                padding: '14px 40px',
                background: 'var(--primary)',
                color: '#0a0e14',
                border: 'none',
                borderRadius: '10px',
                fontWeight: '800',
                gap: '10px',
                opacity: saving || !canEdit ? 0.5 : 1,
                cursor: !canEdit || saving ? 'not-allowed' : 'pointer',
              }}
            >
              {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
              {t('settingsSla.saveConfiguration')}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="glass" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <ShieldCheck color="var(--primary)" size={18} />
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{t('settingsSla.policyGuide')}</h3>
            </div>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: '1.6', whiteSpace: 'pre-line' }}>
              {t('settingsSla.policyBody')}
            </div>
          </div>

          <div className="glass" style={{ padding: '24px', border: '1px solid rgba(255, 159, 67, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <AlertCircle color="var(--warning)" size={18} />
              <h3 style={{ fontSize: '16px', fontWeight: '700' }}>{t('settingsSla.escalationLevels')}</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {t('settingsSla.escalationBody')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
