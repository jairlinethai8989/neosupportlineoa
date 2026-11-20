'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { useLiff } from '@/hooks/useLiff';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  Loader2,
  SendHorizontal,
  AlertCircle,
  Camera,
  CheckCircle,
  X,
} from 'lucide-react';
import { compressImage } from '@/lib/utils/imageCompression';
import { createPortalTicketAction } from '@/app/actions/portalActions';
import styles from '../portal.module.css';

const ChatAttachmentModal = React.lazy(() => import('@/components/chat/ChatAttachmentModal'));

export default function CreateTicketPage() {
  const router = useRouter();
  const { profile, getIdToken, isReady, projectConfig, projectSubjectTypes } = useLiff();
  const projectQuery =
    projectConfig && !projectConfig.is_default && projectConfig.slug
      ? `?project=${encodeURIComponent(projectConfig.slug)}`
      : '';
  const realProjectId =
    projectConfig?.id && projectConfig.id !== 'default-env-fallback' ? projectConfig.id : null;

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [subjectTypes, setSubjectTypes] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isAttachOpen, setIsAttachOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [customerData, setCustomerData] = useState<any>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!profile?.userId || !projectConfig) return;

    async function checkCustomer() {
      let custQuery = supabase
        .from('customers')
        .select('*, organizations(name, abbreviation)')
        .eq('line_user_id', profile?.userId);
      if (realProjectId) {
        custQuery = custQuery.eq('project_id', realProjectId);
      }

      const { data: customer } = await custQuery.limit(1).maybeSingle();

      if (!customer || !customer.organization_id) {
        router.push(`/portal${projectQuery}`);
      } else {
        setCustomerData(customer);
        const subjects = projectSubjectTypes || [];
        setSubjectTypes(subjects.length > 0 ? subjects : ['ลบ', 'แก้ไขออเดอร์', 'แจ้ง error', 'เรื่องอื่นๆ']);
      }
      setChecking(false);
    }
    checkCustomer();
  }, [profile?.userId, projectConfig, projectQuery, projectSubjectTypes, realProjectId, router]);

  const accentStyle = projectConfig?.primary_color
    ? ({ '--portal-accent': projectConfig.primary_color } as React.CSSProperties)
    : undefined;

  if (!isReady || checking) {
    return (
      <div className={styles.loadingCenter} style={accentStyle} role="status" aria-label="กำลังตรวจสอบข้อมูล">
        <Loader2 className={styles.spin} size={32} aria-hidden="true" />
      </div>
    );
  }

  if (!customerData) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!subject.trim()) {
      setError('กรุณาเลือกหัวข้อปัญหา');
      return;
    }
    if (!description.trim()) {
      setError('กรุณาระบุรายละเอียดเพิ่มเติม');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let attachmentUrl: string | null = null;
      if (file) {
        let fileToUpload: File | Blob = file;
        let contentType = file.type;
        let ext = file.name.split('.').pop() || 'jpg';

        if (contentType.startsWith('image/')) {
          try {
            const compressed = await compressImage(file, { quality: 0.8 });
            fileToUpload = compressed;
            contentType = 'image/webp';
            ext = 'webp';
          } catch (err) {
            console.error('Portal create compression failed:', err);
          }
        }

        const fileName = `portal_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(fileName, fileToUpload, { contentType });
        if (!uploadError) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('chat_media').getPublicUrl(fileName);
          attachmentUrl = publicUrl;
        }
      }

      const { ticket: createdTicket } = await createPortalTicketAction({
        lineUserId: profile?.userId || null,
        idToken: getIdToken(),
        projectId: realProjectId,
        projectSlug: projectConfig?.slug || null,
        subject: subject.trim(),
        description: description.trim(),
        attachmentUrl,
      });

      router.replace(`/portal/tickets/${createdTicket.id}${projectQuery}`);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  const subjectInvalid = Boolean(error) && !subject.trim();
  const descriptionInvalid = Boolean(error) && Boolean(subject.trim()) && !description.trim();

  return (
    <div className={styles.root} style={accentStyle}>
      <div className={styles.pageBar}>
        <button
          type="button"
          onClick={() => router.push(`/portal${projectQuery}`)}
          className={styles.iconBtn}
          aria-label="กลับหน้าหลัก"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <h1 className={styles.pageBarTitle}>แจ้งปัญหา / เปิดใบงานใหม่</h1>
        <span aria-hidden="true" />
      </div>

      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        {error && (
          <div className={clsx(styles.notice, styles.noticeError)} role="alert">
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <section className={styles.card} aria-labelledby="step-subject-title">
          <div className={styles.formStepHead}>
            <span className={styles.formStepNo} aria-hidden="true">
              1
            </span>
            <h2 id="step-subject-title" className={styles.formStepTitle}>
              เลือกหัวข้อปัญหา
            </h2>
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-subject" className={styles.label}>
              หัวข้อที่ต้องการแจ้ง<span className={styles.required}>*</span>
            </label>
            <select
              id="ticket-subject"
              name="subject"
              value={subject}
              onChange={(e) => {
                setSubject(e.target.value);
                if (error) setError('');
              }}
              aria-invalid={subjectInvalid}
              className={clsx(styles.select, subjectInvalid && styles.invalid)}
              required
            >
              <option value="">เลือกหัวข้อ...</option>
              {subjectTypes.map((t, idx) => (
                <option key={idx} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="step-detail-title">
          <div className={styles.formStepHead}>
            <span className={styles.formStepNo} aria-hidden="true">
              2
            </span>
            <h2 id="step-detail-title" className={styles.formStepTitle}>
              ระบุรายละเอียดของปัญหา
            </h2>
          </div>

          <div className={styles.field}>
            <label htmlFor="ticket-description" className={styles.label}>
              รายละเอียดเพิ่มเติม<span className={styles.required}>*</span>
            </label>
            <textarea
              id="ticket-description"
              name="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError('');
              }}
              placeholder="แจ้งรายละเอียดของปัญหา ขั้นตอนที่พบ หรือข้อความแจ้งเตือน..."
              aria-invalid={descriptionInvalid}
              className={clsx(styles.textarea, descriptionInvalid && styles.invalid)}
              required
            />
          </div>
        </section>

        <section className={styles.card} aria-labelledby="step-attach-title">
          <div className={styles.formStepHead}>
            <span className={styles.formStepNo} aria-hidden="true">
              3
            </span>
            <h2 id="step-attach-title" className={styles.formStepTitle}>
              แนบรูปภาพหรือไฟล์ประกอบ (ถ้ามี)
            </h2>
          </div>

          <div className={styles.field}>
            <button
              type="button"
              onClick={() => setIsAttachOpen(true)}
              className={clsx(styles.attachBtn, file && styles.attachBtnDone)}
            >
              {file ? <CheckCircle size={20} aria-hidden="true" /> : <Camera size={20} aria-hidden="true" />}
              <span>{file ? `แนบหลักฐานแล้ว: ${file.name}` : 'ถ่ายรูป หรือ แนบไฟล์ประกอบ'}</span>
            </button>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className={clsx(styles.btn, styles.btnSecondary)}
              >
                <X size={18} aria-hidden="true" />
                ลบไฟล์ที่แนบ
              </button>
            )}
          </div>
        </section>

        <button
          type="submit"
          disabled={submitting}
          className={clsx(styles.btn, styles.btnPrimary, styles.btnBlock)}
        >
          {submitting ? (
            <>
              <Loader2 className={styles.spin} size={20} aria-hidden="true" />
              กำลังส่งใบแจ้งงาน...
            </>
          ) : (
            <>
              <SendHorizontal size={20} aria-hidden="true" />
              ส่งใบแจ้งงาน
            </>
          )}
        </button>
      </form>

      <React.Suspense fallback={null}>
        <ChatAttachmentModal
          isOpen={isAttachOpen}
          onClose={() => setIsAttachOpen(false)}
          onConfirm={(f) => {
            setFile(f);
            setIsAttachOpen(false);
          }}
          onImageSelect={(dataUrl) => {
            fetch(dataUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const f = new File([blob], `cam_${Date.now()}.jpg`, { type: 'image/jpeg' });
                setFile(f);
                setIsAttachOpen(false);
              });
          }}
        />
      </React.Suspense>
    </div>
  );
}
