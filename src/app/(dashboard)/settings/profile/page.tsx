'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Loader2,
  Lock,
  Mail,
  MessageSquarePlus,
  PenTool,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { auditService } from '@/lib/services/auditService';
import { SignaturePad } from '@/components/profile/SignaturePad';
import { ImageCropper } from '@/components/profile/ImageCropper';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
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

const AVATAR_SEEDS = [
  'Ariel', 'Willow', 'Casper', 'Sasha', 'Jasper', 'Zoey', 'Felix', 'Luna',
  'Simba', 'Nala', 'Coco', 'Ruby', 'Milo', 'Cleo', 'Jack', 'Oliver',
  'Midnight', 'Shadow', 'Ginger', 'Snowball', 'Pepper', 'Sunny', 'Cookie', 'Bear',
  'Charlie', 'Daisy', 'Max', 'Bella', 'Rocky', 'Lola',
];

const PROFILE_COLORS = [
  '#1d4ed8', // Ocean Cobalt
  '#2563eb', // Cobalt Bright
  '#3b82f6', // Sky Cobalt
  '#0284c7', // Cerulean
  '#0ea5e9', // Sky Blue
  '#0891b2', // Cyan Deep
  '#06b6d4', // Cyan
  '#0d9488', // Teal
  '#14b8a6', // Mint Teal
  '#059669', // Emerald
  '#10b981', // Green
  '#16a34a', // Forest Green
  '#65a30d', // Olive Green
  '#ca8a04', // Gold
  '#d97706', // Amber
  '#f59e0b', // Warm Amber
  '#ea580c', // Burnt Orange
  '#f97316', // Signal Orange
  '#dc2626', // Crimson
  '#ef4444', // Red
  '#b91c1c', // Deep Crimson
  '#475569', // Slate
  '#334155', // Deep Slate
  '#0f172a', // Charcoal Navy
];

const AVATAR_OPTIONS = AVATAR_SEEDS.map((seed) => `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}`);

export default function ProfileSettingsPage() {
  const { t } = useStaffLocale();
  const [profile, setProfile] = useState<any>(null);
  const [companyDepts, setCompanyDepts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  const [addingQuick, setAddingQuick] = useState(false);
  const [quickDraft, setQuickDraft] = useState('');
  const [addingRes, setAddingRes] = useState(false);
  const [resDraft, setResDraft] = useState('');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const { data: depts } = await supabase
          .from('departments')
          .select('name')
          .eq('is_active', true)
          .eq('dept_type', 'organization')
          .order('name');
        setProfile(p);
        if (depts) setCompanyDepts(depts.map((d) => d.name));
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const triggerToast = (message: string, duration = 3000) => {
    setToastMsg(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), duration);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.addEventListener('load', () => setCropImageSrc(reader.result?.toString() || null));
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const handleCropComplete = async (croppedFile: File) => {
    setCropImageSrc(null);
    setUploading(true);
    try {
      const fileExt = croppedFile.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `profile/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, croppedFile);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(filePath);
      setProfile({ ...profile, avatar_url: publicUrl });

      triggerToast(t('common.messages.success'));
    } catch (err: any) {
      alert(t('common.messages.error') + ': ' + (err.message || 'Error'));
    } finally {
      setUploading(false);
    }
  };

  const handleSignatureSave = async (dataUrl: string) => {
    setSaving(true);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `signature_${profile.id}.png`, { type: 'image/png' });

      const filePath = `signatures/${profile.id}_${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(filePath);

      const { error } = await supabase
        .from('profiles')
        .update({
          signature_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, signature_url: publicUrl });
      triggerToast(t('common.messages.saveSuccess'));
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignatureUpload = async (file: File) => {
    setSaving(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `signatures/${profile.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(filePath);

      const { error } = await supabase
        .from('profiles')
        .update({
          signature_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile({ ...profile, signature_url: publicUrl });
      triggerToast(t('common.messages.saveSuccess'));
    } catch (err: any) {
      alert(t('common.messages.saveFailed') + ': ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          department: profile.department,
          landing_page: profile.landing_page || null,
          theme_color: profile.theme_color,
          signature_url: profile.signature_url,
          quick_replies: profile.quick_replies || [],
          resolution_templates: profile.resolution_templates || [],
          auto_logout_minutes: profile.auto_logout_minutes ?? 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;
      await auditService.log({
        performer_id: profile.id,
        action_type: 'PROFILE_UPDATE',
        entity_type: 'PROFILE',
        entity_id: profile.id,
        new_data: {
          full_name: profile.full_name,
          department: profile.department,
          landing_page: profile.landing_page || null,
          avatar_url: profile.avatar_url,
          theme_color: profile.theme_color,
          signature_url: profile.signature_url,
          auto_logout_minutes: profile.auto_logout_minutes ?? 0,
        },
        note: `Updated own profile information`,
      });
      triggerToast(t('common.messages.saveSuccess'));
    } catch {
      alert(t('common.messages.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const addTemplate = async (type: 'quick' | 'res', text: string) => {
    if (!text.trim() || !profile) return;
    const key = type === 'quick' ? 'quick_replies' : 'resolution_templates';
    const current = profile[key] || [];
    if (current.includes(text.trim())) return;

    const updatedList = [...current, text.trim()];
    const updatedProfile = { ...profile, [key]: updatedList };
    setProfile(updatedProfile);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          [key]: updatedList,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (!error) {
        await auditService.log({
          performer_id: profile.id,
          action_type: 'TEMPLATE_ADD',
          entity_type: 'PROFILE_TEMPLATE',
          new_data: { type, text: text.trim() },
          note: `Added new ${type === 'quick' ? 'Quick Reply' : 'Resolution Template'}`,
        });
        triggerToast(t('common.messages.saveSuccess'), 2000);
      }
    } catch (err) {
      console.error('Auto-save failed:', err);
    }
  };

  const removeTemplate = async (type: 'quick' | 'res', index: number) => {
    if (!profile) return;
    const key = type === 'quick' ? 'quick_replies' : 'resolution_templates';
    const current = profile[key] || [];
    const next = current.filter((_: any, i: number) => i !== index);
    const updatedProfile = { ...profile, [key]: next };
    setProfile(updatedProfile);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          [key]: next,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (!error) {
        await auditService.log({
          performer_id: profile.id,
          action_type: 'TEMPLATE_DELETE',
          entity_type: 'PROFILE_TEMPLATE',
          new_data: { type, index },
          note: `Removed ${type === 'quick' ? 'Quick Reply' : 'Resolution Template'}`,
        });
        triggerToast(t('common.messages.deleteSuccess'), 2000);
      }
    } catch (err) {
      console.error('Auto-delete failed:', err);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert(t('settingsProfile.messages.passMismatch'));
      return;
    }
    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      triggerToast(t('common.messages.success'));
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      alert(t('common.messages.error') + ': ' + err.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

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
            <span>{t('settingsProfile.title')}</span>
          </span>
        }
        subtitle={t('settingsProfile.subtitle')}
      />

      <div className={styles.segmentedTabs} role="tablist" aria-label="หมวดการตั้งค่าโปรไฟล์">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'profile'}
          onClick={() => setActiveTab('profile')}
          className={`${styles.segmentedTab} ${activeTab === 'profile' ? styles.segmentedTabActive : ''}`}
        >
          <User size={15} aria-hidden="true" />
          <span>{t('settingsProfile.profileTab')}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'security'}
          onClick={() => setActiveTab('security')}
          className={`${styles.segmentedTab} ${activeTab === 'security' ? styles.segmentedTabActive : ''}`}
        >
          <Lock size={15} aria-hidden="true" />
          <span>{t('settingsProfile.securityTab')}</span>
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className={styles.threeColProfile}>
          {/* 1. Identity Card */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
                  <User size={18} aria-hidden="true" />
                </div>
                <CardTitle>{t('settingsProfile.profileSection')}</CardTitle>
              </div>
            </CardHeader>

            <CardBody className={styles.stackMd}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-4)' }}>
                <div className={styles.avatarFrame}>
                  <img
                    src={
                      profile?.avatar_url ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.full_name || 'User')}`
                    }
                    alt={profile?.full_name || 'Profile avatar'}
                    className={styles.avatarImg}
                  />
                  <input
                    ref={avatarInputRef}
                    type="file"
                    hidden
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    aria-label="อัปโหลดรูปโปรไฟล์"
                  />
                  <button
                    type="button"
                    className={styles.avatarEditBtn}
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploading}
                    aria-label="เปลี่ยนรูปโปรไฟล์"
                  >
                    {uploading ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Camera size={14} aria-hidden="true" />}
                  </button>
                </div>

                <div className={styles.avatarGrid} role="group" aria-label="เลือกอวตารสำเร็จรูป">
                  {AVATAR_OPTIONS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setProfile({ ...profile, avatar_url: url })}
                      aria-label={`เลือกอวตาร ${AVATAR_SEEDS[idx]}`}
                      aria-pressed={profile?.avatar_url === url}
                      className={`${styles.avatarPresetBtn} ${
                        profile?.avatar_url === url ? styles.avatarPresetBtnActive : ''
                      }`}
                    >
                      <img src={url} alt="" style={{ width: '100%', height: '100%', display: 'block' }} />
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label={t('settingsProfile.fullName')}
                value={profile?.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
              />

              <Select
                label={t('settingsProfile.department')}
                value={profile?.department || ''}
                onChange={(e) => setProfile({ ...profile, department: e.target.value })}
              >
                <option value="">{t('settingsProfile.selectDepartment')}</option>
                {companyDepts.map((d: string) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>

              <Select
                label="หน้าแรกหลังเข้าสู่ระบบ (Default Landing Page)"
                value={profile?.landing_page || ''}
                onChange={(e) => setProfile({ ...profile, landing_page: e.target.value })}
              >
                <option value="">ค่าเริ่มต้นตามสิทธิ์ระบบ (Default by Role)</option>
                <option value="dashboard">หน้าแดชบอร์ดหลัก (Dashboard)</option>
                <option value="inbox">หน้ากล่องใบงาน (Ticket Inbox)</option>
              </Select>

              <Select
                label={t('settingsProfile.autoLogout')}
                value={profile?.auto_logout_minutes ?? 0}
                hint={t('settingsProfile.autoLogoutHint')}
                onChange={(e) =>
                  setProfile({ ...profile, auto_logout_minutes: parseInt(e.target.value, 10) || 0 })
                }
              >
                <option value={0}>{t('settingsProfile.autoLogoutNever')}</option>
                <option value={5}>{t('settingsProfile.autoLogout5Min')}</option>
                <option value={15}>{t('settingsProfile.autoLogout15Min')}</option>
                <option value={30}>{t('settingsProfile.autoLogout30Min')}</option>
                <option value={60}>{t('settingsProfile.autoLogout1Hour')}</option>
                <option value={120}>{t('settingsProfile.autoLogout2Hours')}</option>
              </Select>

              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--weight-semibold)',
                    color: 'var(--color-text)',
                    marginBottom: '6px',
                  }}
                >
                  สีประจำตัว (Theme Color)
                </legend>
                <div className={styles.swatchGrid}>
                  {PROFILE_COLORS.map((color) => {
                    const active = profile?.theme_color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`เลือกสี ${color}`}
                        aria-pressed={active}
                        onClick={() => setProfile({ ...profile, theme_color: color })}
                        className={`${styles.swatchBtn} ${active ? styles.swatchBtnActive : ''}`}
                        style={{ backgroundColor: color }}
                      />
                    );
                  })}
                </div>
              </fieldset>

              <Button
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleSaveProfile}
                disabled={uploading}
                loading={saving}
                leftIcon={<Save size={16} aria-hidden="true" />}
              >
                {t('settingsProfile.saveProfile')}
              </Button>
            </CardBody>
          </Card>

          {/* 2. Digital Signature Card */}
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconPrimary}`}>
                  <PenTool size={18} aria-hidden="true" />
                </div>
                <CardTitle>{t('settingsProfile.signatureSection')}</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <SignaturePad
                initialValue={profile?.signature_url}
                onSave={handleSignatureSave}
                onUpload={handleSignatureUpload}
              />
            </CardBody>
          </Card>

          {/* 3. Workflow Templates Column */}
          <div className={styles.stackMd}>
            <Card>
              <CardHeader
                actions={
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      setAddingQuick(true);
                      setQuickDraft('');
                    }}
                    leftIcon={<Plus size={14} aria-hidden="true" />}
                  >
                    {t('settingsProfile.add')}
                  </Button>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <MessageSquarePlus size={18} color="var(--color-primary)" aria-hidden="true" />
                  <CardTitle>{t('settingsProfile.quickReplies')}</CardTitle>
                </div>
              </CardHeader>
              <CardBody className={styles.stackSm}>
                {addingQuick && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!quickDraft.trim()) return;
                      void addTemplate('quick', quickDraft);
                      setQuickDraft('');
                      setAddingQuick(false);
                    }}
                    style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
                  >
                    <Input
                      autoFocus
                      aria-label={t('settingsProfile.addQuickReplyPrompt')}
                      placeholder={t('settingsProfile.addQuickReplyPrompt')}
                      value={quickDraft}
                      onChange={(e) => setQuickDraft(e.target.value)}
                    />
                    <Button type="submit" size="sm" variant="primary" iconOnly aria-label="บันทึกข้อความตอบกลับด่วน">
                      <Check size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      onClick={() => setAddingQuick(false)}
                      aria-label="ยกเลิก"
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </form>
                )}

                <div className={styles.templateList}>
                  {(profile?.quick_replies || []).map((text: string, idx: number) => (
                    <div key={idx} className={styles.templateItem}>
                      <p style={{ margin: 0, flex: 1, color: 'var(--color-text)' }}>{text}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        onClick={() => removeTemplate('quick', idx)}
                        aria-label={`ลบข้อความ ${text}`}
                      >
                        <Trash2 size={15} color="var(--color-danger)" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {(profile?.quick_replies || []).length === 0 && (
                    <EmptyState compact title={t('settingsProfile.noData')} />
                  )}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                actions={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setAddingRes(true);
                      setResDraft('');
                    }}
                    leftIcon={<Plus size={14} aria-hidden="true" />}
                  >
                    {t('settingsProfile.add')}
                  </Button>
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ClipboardCheck size={18} color="var(--color-success)" aria-hidden="true" />
                  <CardTitle>{t('settingsProfile.resolutionTemplates')}</CardTitle>
                </div>
              </CardHeader>
              <CardBody className={styles.stackSm}>
                {addingRes && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!resDraft.trim()) return;
                      void addTemplate('res', resDraft);
                      setResDraft('');
                      setAddingRes(false);
                    }}
                    style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}
                  >
                    <Input
                      autoFocus
                      aria-label={t('settingsProfile.addResolutionTemplatePrompt')}
                      placeholder={t('settingsProfile.addResolutionTemplatePrompt')}
                      value={resDraft}
                      onChange={(e) => setResDraft(e.target.value)}
                    />
                    <Button type="submit" size="sm" variant="primary" iconOnly aria-label="บันทึกรูปแบบการปิดงาน">
                      <Check size={15} aria-hidden="true" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      onClick={() => setAddingRes(false)}
                      aria-label="ยกเลิก"
                    >
                      <X size={15} aria-hidden="true" />
                    </Button>
                  </form>
                )}

                <div className={styles.templateList}>
                  {(profile?.resolution_templates || []).map((text: string, idx: number) => (
                    <div key={idx} className={styles.templateItem}>
                      <p style={{ margin: 0, flex: 1, color: 'var(--color-text)' }}>{text}</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        iconOnly
                        onClick={() => removeTemplate('res', idx)}
                        aria-label={`ลบรูปแบบ ${text}`}
                      >
                        <Trash2 size={15} color="var(--color-danger)" aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {(profile?.resolution_templates || []).length === 0 && (
                    <EmptyState compact title={t('settingsProfile.noData')} />
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: '560px', width: '100%' }}>
          <Card>
            <CardHeader>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div className={`${styles.statIcon} ${styles.statIconDanger}`}>
                  <Lock size={18} aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>{t('settingsProfile.securitySection')}</CardTitle>
                  <CardDescription>{t('settingsProfile.securitySubtitle')}</CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardBody className={styles.stackLg}>
              <Input
                label={t('settingsProfile.email')}
                value={profile?.email || ''}
                readOnly
                disabled
                leftIcon={<Mail size={16} aria-hidden="true" />}
              />

              <form
                onSubmit={handleChangePassword}
                className={styles.stackMd}
                style={{ paddingTop: 'var(--space-4)', borderTop: '1px solid var(--color-border)' }}
              >
                <h3 style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--weight-semibold)' }}>
                  {t('settingsProfile.changePassword')}
                </h3>
                <Input
                  type="password"
                  required
                  label={t('settingsProfile.newPasswordPlaceholder')}
                  placeholder={t('settingsProfile.newPasswordPlaceholder')}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  type="password"
                  required
                  label={t('settingsProfile.confirmPasswordPlaceholder')}
                  placeholder={t('settingsProfile.confirmPasswordPlaceholder')}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <Button
                  type="submit"
                  variant="danger"
                  size="lg"
                  fullWidth
                  loading={updatingPassword}
                  leftIcon={<ShieldCheck size={18} aria-hidden="true" />}
                >
                  {t('settingsProfile.updatePassword')}
                </Button>
              </form>
            </CardBody>
          </Card>
        </div>
      )}

      {showToast && (
        <div className={styles.floatingToast} role="status">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>{toastMsg}</span>
        </div>
      )}

      {cropImageSrc && (
        <ImageCropper
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
