'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  Copy,
  Check,
  Edit3,
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';

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
  primary_color: '#0066ff',
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
      primary_color: project.primary_color || '#0066ff',
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
      <div className="glass" style={{ padding: '48px', textAlign: 'center', marginTop: '40px' }}>
        <ShieldCheck size={40} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
        <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '8px' }}>
          เฉพาะผู้ดูแลระบบ (Administrator) เท่านั้น
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          หน้าจัดการโครงการและคีย์เชื่อมต่อ LINE OA จำกัดสิทธิ์เฉพาะผู้ดูแลระบบระดับสูง
        </p>
      </div>
    );
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://neoworkspace.vercel.app';

  return (
    <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '28px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/" style={{ color: 'var(--text-muted)' }}>
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', lineHeight: '1.15' }}>
              จัดการโครงการ & ช่องทาง LINE OA
            </h1>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              รองรับแยก LINE OA, LIFF Portal, กลุ่มแจ้งเตือนทีมงาน และคำเรียกองค์กรแยกอิสระต่อโครงการ
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="glass-interactive"
          style={{
            padding: '12px 20px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--primary)',
            color: '#0a0e14',
            fontWeight: '800',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
          }}
        >
          <Plus size={18} />
          เพิ่มโครงการใหม่
        </button>
      </div>

      {error && (
        <div
          className="glass"
          style={{
            padding: '16px',
            marginBottom: '20px',
            border: '1px solid var(--danger)',
            color: 'var(--danger)',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex-center" style={{ height: '40vh' }}>
          <Loader2 className="animate-spin" color="var(--primary)" />
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
            gap: '20px',
          }}
        >
          {projects.map((proj) => {
            const webhookUrl = `${origin}/api/line/webhook/${proj.slug}`;
            const portalUrl = `${origin}/portal${proj.is_default ? '' : `?project=${proj.slug}`}`;

            return (
              <div
                key={proj.id}
                className="glass"
                style={{
                  padding: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  borderTop: `4px solid ${proj.primary_color || '#0066ff'}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '12px',
                        background: `${proj.primary_color || '#0066ff'}20`,
                        color: proj.primary_color || '#0066ff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '900',
                        fontSize: '13px',
                      }}
                    >
                      {proj.code}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ fontSize: '17px', fontWeight: '800' }}>{proj.name}</h3>
                        {proj.is_default && (
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: '800',
                              padding: '2px 8px',
                              borderRadius: '20px',
                              background: 'rgba(16, 185, 129, 0.12)',
                              color: '#10b981',
                            }}
                          >
                            DEFAULT
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        slug: <code>{proj.slug}</code> • คำเรียกองค์กร: {proj.organization_label} • เจ้าหน้าที่ {proj.member_count} คน
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openEditModal(proj)}
                    className="glass-interactive"
                    style={{
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'var(--text-main)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '12px',
                      fontWeight: '700',
                    }}
                  >
                    <Edit3 size={14} /> แก้ไข
                  </button>
                </div>

                {/* Connection Badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: proj.has_line_secret ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: proj.has_line_secret ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {proj.has_line_secret ? '✓ Channel Secret' : '○ ใช้ Secret กลาง'}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: proj.has_line_token ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      color: proj.has_line_token ? '#10b981' : '#f59e0b',
                    }}
                  >
                    {proj.has_line_token ? '✓ Access Token' : '○ ใช้ Token กลาง'}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      background: proj.line_liff_id ? 'rgba(0,102,255,0.12)' : 'rgba(148,163,184,0.15)',
                      color: proj.line_liff_id ? '#0066ff' : 'var(--text-muted)',
                    }}
                  >
                    LIFF: {proj.line_liff_id || 'ค่าเริ่มต้น (.env)'}
                  </span>
                </div>

                {/* Webhook & Portal URLs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '6px' }}>WEBHOOK:</strong>
                      <span>{webhookUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(`wh-${proj.id}`, webhookUrl)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                      title="คัดลอก Webhook URL"
                    >
                      {copiedKey === `wh-${proj.id}` ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <strong style={{ fontSize: '10px', color: 'var(--text-muted)', marginRight: '6px' }}>PORTAL LIFF:</strong>
                      <span>{portalUrl}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(`pt-${proj.id}`, portalUrl)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                      title="คัดลอก Portal URL"
                    >
                      {copiedKey === `pt-${proj.id}` ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>

                {/* Quota & Staff Group Action */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '10px',
                    borderTop: '1px solid var(--border)',
                    gap: '10px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={14} />
                    {proj.notify_on_customer_message
                      ? 'แจ้งกลุ่ม LINE ทุกแชต'
                      : 'แจ้งเฉพาะใบงานใหม่/ส่งต่อ (ประหยัดโควต้า)'}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleTestGroup(proj)}
                    disabled={testingGroupId === proj.id || !proj.line_staff_group_id}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: proj.line_staff_group_id ? 'var(--primary)' : 'var(--text-muted)',
                      fontWeight: '700',
                      fontSize: '11px',
                      cursor: proj.line_staff_group_id ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      opacity: proj.line_staff_group_id ? 1 : 0.5,
                    }}
                  >
                    {testingGroupId === proj.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    ทดสอบกลุ่ม LINE
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Project Modal */}
      {modalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            className="glass"
            style={{
              width: '100%',
              maxWidth: '640px',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              borderRadius: '20px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layers size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '19px', fontWeight: '800' }}>
                  {form.id ? 'แก้ไขการตั้งค่าโครงการ' : 'เพิ่มโครงการ & เชื่อมต่อ LINE OA ใหม่'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <XCircle size={22} />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    ชื่อโครงการ *
                  </label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="เช่น NeoHos Hospital System"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    ตัวย่อ (Code) *
                  </label>
                  <input
                    required
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="NEO"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 90px', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    URL Slug (ใช้ใน Webhook/Portal) *
                  </label>
                  <input
                    required
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    placeholder="neohos"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    คำเรียกองค์กรฝั่งลูกค้า
                  </label>
                  <input
                    value={form.organization_label}
                    onChange={(e) => setForm({ ...form, organization_label: e.target.value })}
                    placeholder="เช่น โรงพยาบาล / บริษัท / สาขา"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    สีป้าย
                  </label>
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    style={{ width: '100%', height: '42px', padding: '4px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer' }}
                  />
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '6px 0' }} />
              <p style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>
                ตั้งค่า LINE Official Account ประจำโครงการ
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    LINE LIFF ID
                  </label>
                  <input
                    value={form.line_liff_id}
                    onChange={(e) => setForm({ ...form, line_liff_id: e.target.value })}
                    placeholder="2009xxxxxx-xxxxxxxx"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    LINE Login Channel ID (ไม่บังคับ)
                  </label>
                  <input
                    value={form.line_channel_id}
                    onChange={(e) => setForm({ ...form, line_channel_id: e.target.value })}
                    placeholder="ใช้เลขหน้าเครื่องหมาย - ของ LIFF ID อัตโนมัติ"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    LINE Bot Basic ID (เช่น @neohos)
                  </label>
                  <input
                    value={form.line_bot_id}
                    onChange={(e) => setForm({ ...form, line_bot_id: e.target.value })}
                    placeholder="@myproject"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                    LINE Staff Group ID (สำหรับแจ้งเตือนทีม)
                  </label>
                  <input
                    value={form.line_staff_group_id}
                    onChange={(e) => setForm({ ...form, line_staff_group_id: e.target.value })}
                    placeholder="C86378841bdd..."
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                  LINE Messaging API Channel Secret {form.id ? '(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)' : ''}
                </label>
                <input
                  type="password"
                  value={form.line_channel_secret}
                  onChange={(e) => setForm({ ...form, line_channel_secret: e.target.value })}
                  placeholder={form.id ? '•••••••• (ค่าเดิมถูกบันทึกไว้อย่างปลอดภัย)' : 'ใส่ Channel Secret'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', marginBottom: '4px', color: 'var(--text-muted)' }}>
                  LINE Messaging API Channel Access Token {form.id ? '(เว้นว่างไว้หากไม่ต้องการเปลี่ยน)' : ''}
                </label>
                <textarea
                  rows={2}
                  value={form.line_channel_access_token}
                  onChange={(e) => setForm({ ...form, line_channel_access_token: e.target.value })}
                  placeholder={form.id ? '•••••••• (ค่าเดิมถูกบันทึกไว้อย่างปลอดภัย)' : 'ใส่ Long-lived Channel Access Token'}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '10px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-main)', resize: 'vertical' }}
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.notify_on_customer_message}
                  onChange={(e) => setForm({ ...form, notify_on_customer_message: e.target.checked })}
                />
                <span>
                  แจ้งเตือนเข้ากลุ่ม LINE ทุกครั้งที่ลูกค้าพิมพ์ข้อความแชตย่อย (ปิดไว้เป็นค่าเริ่มต้นเพื่อประหยัดโควต้า LINE Push 60–70%)
                </span>
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '700' }}
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', background: 'var(--primary)', border: 'none', color: '#0a0e14', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : 'บันทึกการตั้งค่าโครงการ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
