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
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  PageHeader,
  Select,
} from '@/components/ui';
import styles from '../settings.module.css';

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
      const { data } = await supabase
        .from('sla_rules')
        .select('*')
        .order('priority', { ascending: true });
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

  const getPriorityBadgeVariant = (priority: string) => {
    if (priority === 'Critical') return 'danger' as const;
    if (priority === 'High') return 'warning' as const;
    if (priority === 'Medium') return 'info' as const;
    return 'neutral' as const;
  };

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <Link href="/analytics" className={styles.backLink} aria-label="กลับหน้าวิเคราะห์">
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
            <span>{t('settingsSla.title')}</span>
          </span>
        }
        badge={
          <Badge variant="primary" size="md">
            <span className="tabular-nums">{rules.length}</span> กฎ
          </Badge>
        }
        actions={
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!canEdit}
            leftIcon={<Save size={16} aria-hidden="true" />}
          >
            {t('settingsSla.saveConfiguration')}
          </Button>
        }
      />

      <div className={styles.twoColMainAside}>
        <Card>
          <CardHeader
            actions={
              <Button
                size="sm"
                variant="secondary"
                onClick={addRule}
                disabled={!canEdit}
                leftIcon={<Plus size={15} aria-hidden="true" />}
              >
                {t('settingsSla.addRule')}
              </Button>
            }
          >
            <CardTitle>{t('settingsSla.matrixRules')}</CardTitle>
          </CardHeader>

          <CardBody className={styles.stackMd}>
            {loading ? (
              <div className="flex-center" style={{ padding: 'var(--space-10)' }} role="status">
                <Loader2 className="animate-spin" size={24} color="var(--color-primary)" aria-hidden="true" />
              </div>
            ) : rules.length === 0 ? (
              <EmptyState compact title={t('settingsSla.noRules')} />
            ) : (
              <div className={styles.stackSm}>
                {rules.map((rule, idx) => (
                  <div key={rule.id || idx} className={styles.slaRuleRow}>
                    <Select
                      label={t('settingsSla.priorityLevel')}
                      labelRight={
                        <Badge variant={getPriorityBadgeVariant(rule.priority)} size="sm" dot>
                          {rule.priority}
                        </Badge>
                      }
                      value={rule.priority}
                      disabled={!canEdit}
                      onChange={(event) => updateRule(idx, 'priority', event.target.value)}
                    >
                      {priorityOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Select>

                    <Input
                      type="number"
                      min={1}
                      label={t('settingsSla.firstResponseMinutes')}
                      value={rule.response_time_minutes}
                      disabled={!canEdit}
                      className="tabular-nums"
                      onChange={(event) =>
                        updateRule(idx, 'response_time_minutes', parseInt(event.target.value, 10) || 0)
                      }
                    />

                    <Input
                      type="number"
                      min={1}
                      label={t('settingsSla.resolutionMinutes')}
                      value={rule.resolution_time_minutes}
                      disabled={!canEdit}
                      className="tabular-nums"
                      onChange={(event) =>
                        updateRule(idx, 'resolution_time_minutes', parseInt(event.target.value, 10) || 0)
                      }
                    />

                    <Button
                      variant="ghost"
                      iconOnly
                      onClick={() => deleteRule(idx)}
                      disabled={!canEdit}
                      aria-label={`ลบกฎ ${rule.priority}`}
                    >
                      <Trash2 size={17} color="var(--color-danger)" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--space-2)' }}>
              <Button
                variant="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!canEdit}
                leftIcon={<Save size={16} aria-hidden="true" />}
              >
                {t('settingsSla.saveConfiguration')}
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className={styles.stackMd}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <ShieldCheck color="var(--color-primary)" size={18} aria-hidden="true" />
                <CardTitle>{t('settingsSla.policyGuide')}</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 'var(--leading-normal)',
                  whiteSpace: 'pre-line',
                }}
              >
                {t('settingsSla.policyBody')}
              </div>
            </CardBody>
          </Card>

          <Card style={{ borderColor: 'var(--color-warning-border)' }}>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <AlertCircle color="var(--color-warning)" size={18} aria-hidden="true" />
                <CardTitle>{t('settingsSla.escalationLevels')}</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-muted)',
                  lineHeight: 'var(--leading-normal)',
                }}
              >
                {t('settingsSla.escalationBody')}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
