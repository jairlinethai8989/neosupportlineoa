'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useId, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronLeft,
  Copy,
  Edit3,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Textarea,
} from '@/components/ui';
import styles from '../settings.module.css';

interface AdminProjectRow {
  id: string;
  slug: string;
  name: string;
  code: string;
  organization_label: string;
  logo_url: string | null;
  primary_color: string;
  line_channel_id: string | null;
  line_liff_id: string | null;
  line_bot_id: string | null;
  line_staff_group_id: string | null;
  notify_on_customer_message: boolean;
  is_default: boolean;
  is_active: boolean;
  has_line_secret: boolean;
  has_line_token: boolean;
  member_count: number;
}

const EMPTY_FORM = {
  id: '',
  name: '',
  code: '',
  slug: '',
  organization_label: 'หน่วยงาน',
  primary_color: '#1d4ed8',
  logo_url: '',
  line_channel_id: '',
  line_channel_secret: '',
  line_channel_access_token: '',
  line_liff_id: '',
  line_bot_id: '',
  line_staff_group_id: '',
  notify_on_customer_message: false,
  is_active: true,
};

export default function ProjectsSettingsPage() {
  const { userProfile, refreshData } = useAppContext();
  const isAdmin = userProfile?.role === 'Administrator';

  const [projects, setProjects] = useState<AdminProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testingGroupId, setTestingGroupId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const colorInputId = useId();
  const notifyCheckboxId = useId();

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/projects', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load projects');
      setProjects(data.projects || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      void loadProjects();
    } else {
      setLoading(false);
    }
  }, [isAdmin, loadProjects]);

  const handleCopy = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const openCreateModal = () => {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (project: AdminProjectRow) => {
    setForm({
      id: project.id,
      name: project.name,
      code: project.code,
      slug: project.slug,
      organization_label: project.organization_label || 'หน่วยงาน',
      primary_color: project.primary_color || '#1d4ed8',
      logo_url: project.logo_url || '',
      line_channel_id: project.line_channel_id || '',
      line_channel_secret: '',
      line_channel_access_token: '',
      line_liff_id: project.line_liff_id || '',
      line_bot_id: project.line_bot_id || '',
      line_staff_group_id: project.line_staff_group_id || '',
      notify_on_customer_message: Boolean(project.notify_on_customer_message),
      is_active: project.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEdit = Boolean(form.id);
      const res = await fetch('/api/admin/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save project');

      setModalOpen(false);
      await loadProjects();
      await refreshData('projects');
    } catch (err: any) {
      alert('บันทึกไม่สำเร็จ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestGroup = async (project: AdminProjectRow) => {
    if (!project.line_staff_group_id) {
      alert('กรุณาตั้งค่า LINE Staff Group ID ในโครงการนี้ก่อน');
      return;
    }
    setTestingGroupId(project.id);
    try {
      const res = await fetch('/api/admin/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-group',
          projectId: project.id,
          line_staff_group_id: project.line_staff_group_id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ส่งไม่สำเร็จ');
      alert(`ส่งข้อความทดสอบเข้ากลุ่มของ "${project.name}" เรียบร้อยแล้ว`);
    } catch (err: any) {
      alert('ส่งทดสอบไม่สำเร็จ: ' + err.message);
    } finally {
      setTestingGroupId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className={styles.page}>
        <Card>
          <CardBody>
            <EmptyState
              icon={<ShieldCheck size={22} color="var(--color-danger)" aria-hidden="true" />}
              title="เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น"
              description="หน้าจัดการโครงการและคีย์เชื่อมต่อ LINE OA จำกัดสิทธิ์เฉพาะผู้ดูแลระบบระดับสูง"
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://neoworkspace.vercel.app';

  return (
    <div className={styles.page}>
      <PageHeader
        title={
          <span className={styles.headerTitleRow}>
            <Link href="/" className={styles.backLink} aria-label="กลับหน้าหลัก">
              <ChevronLeft size={18} aria-hidden="true" />
            </Link>
            <span>จัดการโครงการ &amp; ช่องทาง LINE OA</span>
          </span>
        }
        subtitle="รองรับแยก LINE OA, LIFF Portal, กลุ่มแจ้งเตือนทีมงาน และคำเรียกองค์กรแยกอิสระต่อโครงการ"
        badge={
          <Badge variant="primary" size="md">
            {projects.length} โครงการ
          </Badge>
        }
        actions={
          <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus size={16} aria-hidden="true" />}>
            เพิ่มโครงการใหม่
          </Button>
        }
      />

      {error && (
        <div className={`${styles.alertBanner} ${styles.alertDanger}`} role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-center" style={{ height: '40vh' }} role="status" aria-label="กำลังโหลดโครงการ">
          <Loader2 className="animate-spin" color="var(--color-primary)" size={28} aria-hidden="true" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<Layers size={22} aria-hidden="true" />}
          title="ยังไม่มีโครงการในระบบ"
          description="เพิ่มโครงการแรกเพื่อเชื่อมต่อ LINE OA และ LIFF Portal"
          action={
            <Button variant="primary" onClick={openCreateModal} leftIcon={<Plus size={16} aria-hidden="true" />}>
              เพิ่มโครงการใหม่
            </Button>
          }
        />
      ) : (
        <div className={styles.projectsGrid}>
          {projects.map((proj) => {
            const webhookUrl = `${origin}/api/line/webhook/${proj.slug}`;
            const portalUrl = `${origin}/portal${proj.is_default ? '' : `?project=${proj.slug}`}`;
            const accentColor = proj.primary_color || '#1d4ed8';

            return (
              <Card
                key={proj.id}
                className={styles.projectCard}
                style={{ borderTop: `3px solid ${accentColor}` }}
              >
                <CardHeader
                  actions={
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openEditModal(proj)}
                      leftIcon={<Edit3 size={14} aria-hidden="true" />}
                    >
                      แก้ไข
                    </Button>
                  }
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    <span
                      className={styles.projectCodeBadge}
                      style={{
                        background: 'var(--color-surface-subtle)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {proj.code}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <h2
                          style={{
                            fontSize: 'var(--text-md)',
                            fontWeight: 'var(--weight-bold)',
                            color: 'var(--color-text)',
                            lineHeight: 'var(--leading-tight)',
                          }}
                        >
                          {proj.name}
                        </h2>
                        {proj.is_default && (
                          <Badge variant="success" size="sm">
                            DEFAULT
                          </Badge>
                        )}
                        {!proj.is_active && (
                          <Badge variant="neutral" size="sm">
                            ปิดใช้งาน
                          </Badge>
                        )}
                      </div>
                      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                        slug: <code className="mono">{proj.slug}</code> • {proj.organization_label} • เจ้าหน้าที่{' '}
                        <span className="tabular-nums">{proj.member_count}</span> คน
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardBody compact className={styles.stackMd}>
                  {/* Connection Badges */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                    <Badge variant={proj.has_line_secret ? 'success' : 'warning'} size="sm" dot>
                      {proj.has_line_secret ? 'Channel Secret พร้อม' : 'ใช้ Secret กลาง'}
                    </Badge>
                    <Badge variant={proj.has_line_token ? 'success' : 'warning'} size="sm" dot>
                      {proj.has_line_token ? 'Access Token พร้อม' : 'ใช้ Token กลาง'}
                    </Badge>
                    <Badge variant={proj.line_liff_id ? 'info' : 'neutral'} size="sm">
                      <span className="mono">LIFF: {proj.line_liff_id || 'ค่าเริ่มต้น (.env)'}</span>
                    </Badge>
                  </div>

                  {/* Copyable Webhook & Portal URLs */}
                  <div className={styles.stackSm}>
                    <div className={styles.urlBox}>
                      <div className={styles.urlContent}>
                        <span className={styles.urlLabel}>Webhook</span>
                        <span className={styles.urlValue} title={webhookUrl}>
                          {webhookUrl}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(`wh-${proj.id}`, webhookUrl)}
                        aria-label={`คัดลอก Webhook URL ของ ${proj.name}`}
                        leftIcon={
                          copiedKey === `wh-${proj.id}` ? (
                            <Check size={14} color="var(--color-success)" aria-hidden="true" />
                          ) : (
                            <Copy size={14} aria-hidden="true" />
                          )
                        }
                      >
                        {copiedKey === `wh-${proj.id}` ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </Button>
                    </div>

                    <div className={styles.urlBox}>
                      <div className={styles.urlContent}>
                        <span className={styles.urlLabel}>Portal LIFF</span>
                        <span className={styles.urlValue} title={portalUrl}>
                          {portalUrl}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(`pt-${proj.id}`, portalUrl)}
                        aria-label={`คัดลอก Portal URL ของ ${proj.name}`}
                        leftIcon={
                          copiedKey === `pt-${proj.id}` ? (
                            <Check size={14} color="var(--color-success)" aria-hidden="true" />
                          ) : (
                            <Copy size={14} aria-hidden="true" />
                          )
                        }
                      >
                        {copiedKey === `pt-${proj.id}` ? 'คัดลอกแล้ว' : 'คัดลอก'}
                      </Button>
                    </div>
                  </div>

                  {/* Quota & Staff Group Action */}
                  <div className={styles.projectCardFooter}>
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      <MessageSquare size={14} aria-hidden="true" />
                      {proj.notify_on_customer_message
                        ? 'แจ้งกลุ่ม LINE ทุกแชต'
                        : 'แจ้งเฉพาะใบงานใหม่/ส่งต่อ (ประหยัดโควต้า)'}
                    </span>

                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleTestGroup(proj)}
                      loading={testingGroupId === proj.id}
                      disabled={!proj.line_staff_group_id}
                      leftIcon={<Send size={13} aria-hidden="true" />}
                    >
                      ทดสอบกลุ่ม LINE
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? 'แก้ไขการตั้งค่าโครงการ' : 'เพิ่มโครงการ & เชื่อมต่อ LINE OA ใหม่'}
        description="กำหนดรหัสโครงการ Slug และคีย์เชื่อมต่อ LINE Official Account แยกอิสระ"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" form="project-settings-form" variant="primary" loading={submitting}>
              บันทึกการตั้งค่าโครงการ
            </Button>
          </>
        }
      >
        <form id="project-settings-form" onSubmit={handleSave} className={styles.stackMd}>
          <div className={styles.formGridProjectTop}>
            <Input
              label="ชื่อโครงการ"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="เช่น NeoHos Hospital System"
            />
            <Input
              label="ตัวย่อ (Code)"
              required
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="NEO"
              className="mono"
            />
          </div>

          <div className={styles.formGridProjectSlug}>
            <Input
              label="URL Slug"
              required
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
              placeholder="neohos"
              className="mono"
            />
            <Input
              label="คำเรียกองค์กรฝั่งลูกค้า"
              value={form.organization_label}
              onChange={(e) => setForm({ ...form, organization_label: e.target.value })}
              placeholder="เช่น โรงพยาบาล / บริษัท / สาขา"
            />
            <div className={styles.stackSm}>
              <label
                htmlFor={colorInputId}
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 'var(--weight-semibold)',
                  color: 'var(--color-text)',
                }}
              >
                สีป้าย
              </label>
              <input
                id={colorInputId}
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                style={{
                  width: '100%',
                  height: 'var(--control-md)',
                  padding: '3px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border-strong)',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>

          <div
            style={{
              paddingTop: 'var(--space-3)',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-3)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-bold)',
                color: 'var(--color-primary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              ตั้งค่า LINE Official Account ประจำโครงการ
            </p>

            <div className={styles.formGrid2}>
              <Input
                label="LINE LIFF ID"
                value={form.line_liff_id}
                onChange={(e) => setForm({ ...form, line_liff_id: e.target.value })}
                placeholder="2009xxxxxx-xxxxxxxx"
                className="mono"
              />
              <Input
                label="LINE Login Channel ID (ไม่บังคับ)"
                value={form.line_channel_id}
                onChange={(e) => setForm({ ...form, line_channel_id: e.target.value })}
                placeholder="ใช้เลขหน้า - ของ LIFF ID อัตโนมัติ"
                className="mono"
              />
            </div>

            <div className={styles.formGrid2}>
              <Input
                label="LINE Bot Basic ID"
                value={form.line_bot_id}
                onChange={(e) => setForm({ ...form, line_bot_id: e.target.value })}
                placeholder="@myproject"
                className="mono"
              />
              <Input
                label="LINE Staff Group ID (สำหรับแจ้งเตือนทีม)"
                value={form.line_staff_group_id}
                onChange={(e) => setForm({ ...form, line_staff_group_id: e.target.value })}
                placeholder="C86378841bdd..."
                className="mono"
              />
            </div>

            <Input
              type="password"
              label={`LINE Messaging API Channel Secret ${form.id ? '(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)' : ''}`}
              value={form.line_channel_secret}
              onChange={(e) => setForm({ ...form, line_channel_secret: e.target.value })}
              placeholder={form.id ? '•••••••• (ค่าเดิมถูกบันทึกไว้อย่างปลอดภัย)' : 'ใส่ Channel Secret'}
              className="mono"
            />

            <Textarea
              rows={2}
              label={`LINE Messaging API Channel Access Token ${form.id ? '(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)' : ''}`}
              value={form.line_channel_access_token}
              onChange={(e) => setForm({ ...form, line_channel_access_token: e.target.value })}
              placeholder={form.id ? '•••••••• (ค่าเดิมถูกบันทึกไว้อย่างปลอดภัย)' : 'ใส่ Long-lived Channel Access Token'}
              className="mono"
            />

            <label
              htmlFor={notifyCheckboxId}
              className={`${styles.checkboxPill} ${form.notify_on_customer_message ? styles.checkboxPillChecked : ''}`}
              style={{ width: '100%', padding: 'var(--space-3)' }}
            >
              <input
                id={notifyCheckboxId}
                type="checkbox"
                className={styles.checkboxInput}
                checked={form.notify_on_customer_message}
                onChange={(e) => setForm({ ...form, notify_on_customer_message: e.target.checked })}
              />
              <span style={{ fontWeight: 'var(--weight-medium)', lineHeight: 'var(--leading-normal)' }}>
                แจ้งเตือนเข้ากลุ่ม LINE ทุกครั้งที่ลูกค้าพิมพ์ข้อความแชตย่อย (ปิดไว้เป็นค่าเริ่มต้นเพื่อประหยัดโควต้า LINE Push 60–70%)
              </span>
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
