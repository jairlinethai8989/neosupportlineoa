'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building, Camera, ChevronLeft, Loader2, Save, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
  Button,
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  PageHeader,
  Select,
  Skeleton,
} from '@/components/ui';
import styles from '../settings.module.css';

export default function BrandingSettingsPage() {
  const { t } = useStaffLocale();
  const { userProfile } = useAppContext();
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { addToast } = useNotificationContext();
  const logoInputRef = useRef<HTMLInputElement>(null);

  const canEdit = useMemo(() => {
    if (userProfile?.role === 'Administrator') return true;
    return userProfile?.permissions?.settings_branding === 'edit';
  }, [userProfile]);

  useEffect(() => {
    async function fetchData() {
      const { data: c } = await supabase
        .from('company_settings')
        .select('id, company_name, logo_url')
        .limit(1)
        .single();
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

      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      setCompany({ ...company, logo_url: publicUrl });
      addToast({
        id: 'logo-upload',
        type: 'ticket',
        title: t('settingsBranding.messages.uploadSuccessTitle'),
        body: t('common.messages.success'),
      });
    } catch (err: any) {
      alert(t('common.messages.error') + ': ' + (err.message || 'Error uploading file'));
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    try {
      if (company?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            company_name: company.company_name,
            logo_url: company.logo_url,
            updated_at: new Date().toISOString(),
          })
          .eq('id', company.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('company_settings').insert([
          {
            company_name: company?.company_name,
            logo_url: company?.logo_url,
          },
        ]);
        if (error) throw error;
      }

      try {
        const { auditService } = await import('@/lib/services/auditService');
        const {
          data: { user },
        } = await supabase.auth.getUser();
        await auditService.log({
          performer_id: user?.id,
          action_type: 'BRANDING_UPDATE',
          entity_type: 'COMPANY',
          entity_id: company?.id,
          new_data: {
            company_name: company?.company_name,
            logo_url: company?.logo_url,
            active_threshold_minutes: company?.active_threshold_minutes || 15,
          },
          note: `Updated corporate branding and active threshold settings`,
        });
      } catch (logErr) {
        console.error('Logging failed:', logErr);
      }

      addToast({
        id: 'branding-save',
        type: 'ticket',
        title: t('settingsBranding.messages.saveSuccessTitle'),
        body: t('common.messages.saveSuccess'),
      });
    } catch (err: any) {
      console.error('Save failed details:', err);
      const errorMsg = err.message || err.details || 'Unknown database error';
      alert(`${t('common.messages.saveFailed')}: ${errorMsg}\n\n${t('settingsBranding.messages.migrationNote')}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <Skeleton width={32} height={32} borderRadius={8} />
          <Skeleton width={280} height={28} />
        </div>
        <div style={{ maxWidth: '640px', width: '100%' }}>
          <Card>
            <CardBody className={styles.stackMd}>
              <Skeleton width="100%" height={184} borderRadius={12} />
              <Skeleton width="100%" height={40} borderRadius={8} />
              <Skeleton width="100%" height={40} borderRadius={8} />
              <Skeleton width="100%" height={44} borderRadius={8} />
            </CardBody>
          </Card>
        </div>
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
            <span>{t('settingsBranding.title')}</span>
          </span>
        }
      />

      <div style={{ maxWidth: '640px', width: '100%' }}>
        <Card>
          <CardHeader>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
                <Building size={18} aria-hidden="true" />
              </div>
              <div>
                <CardTitle>{t('settingsBranding.sectionTitle')}</CardTitle>
                <CardDescription>{t('settingsBranding.sectionSubtitle')}</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardBody className={styles.stackMd}>
            <div className={styles.logoDropzone}>
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company?.company_name || 'Company Logo'}
                  style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                />
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Building size={40} style={{ opacity: 0.4, margin: '0 auto' }} aria-hidden="true" />
                  <p style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
                    {t('settingsBranding.noLogo')}
                  </p>
                </div>
              )}

              <input
                ref={logoInputRef}
                type="file"
                hidden
                accept="image/*"
                onChange={handleFileUpload}
                disabled={uploading || !canEdit}
                aria-label={t('settingsBranding.changeLogo')}
              />
              <Button
                variant="primary"
                size="sm"
                className={styles.logoUploadBtn}
                disabled={uploading || !canEdit}
                loading={uploading}
                onClick={() => logoInputRef.current?.click()}
                leftIcon={uploading ? undefined : <Camera size={15} aria-hidden="true" />}
              >
                {uploading ? t('settingsBranding.uploading') : t('settingsBranding.changeLogo')}
              </Button>
            </div>

            <Input
              label={t('settingsBranding.companyName')}
              placeholder={t('settingsBranding.companyNamePlaceholder')}
              value={company?.company_name || ''}
              disabled={!canEdit}
              onChange={(e) => setCompany({ ...(company || {}), company_name: e.target.value })}
            />

            <Select
              label={t('settingsBranding.activeThreshold')}
              value={company?.active_threshold_minutes || 15}
              disabled={!canEdit}
              hint={t('settingsBranding.activeThresholdHelp')}
              onChange={(e) =>
                setCompany({ ...(company || {}), active_threshold_minutes: parseInt(e.target.value, 10) })
              }
            >
              <option value={5}>{t('settingsBranding.minutes5')}</option>
              <option value={10}>{t('settingsBranding.minutes10')}</option>
              <option value={15}>{t('settingsBranding.minutes15')}</option>
            </Select>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={handleSaveCompany}
              disabled={uploading || !canEdit}
              loading={saving}
              leftIcon={saving ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            >
              {t('settingsBranding.saveBranding')}
            </Button>

            <div className={`${styles.alertBanner} ${styles.alertInfo}`}>
              <ShieldCheck size={18} style={{ flexShrink: 0, marginTop: '2px' }} aria-hidden="true" />
              <div className={styles.stackSm}>
                <p style={{ fontWeight: 'var(--weight-semibold)', color: 'var(--color-text)' }}>
                  {t('settingsBranding.infoTitle')}
                </p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', lineHeight: 'var(--leading-normal)' }}>
                  {t('settingsBranding.infoBody')}
                </p>
                <Link
                  href="/settings/master"
                  style={{
                    color: 'var(--color-primary)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--weight-semibold)',
                    textDecoration: 'none',
                  }}
                >
                  {t('settingsBranding.manageMasterData')} →
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
