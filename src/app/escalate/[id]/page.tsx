'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */

import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  Building2,
  Calendar,
  Camera,
  CheckCircle,
  ClipboardCheck,
  FileText,
  History,
  Loader2,
  Lock,
  MessageSquare,
  Send,
  Trash2,
  Unlock,
  User,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import {
  claimEscalatedTicket,
  updateEscalatedTicketStatus,
  verifyEscalationPin,
  regenerateEscalationLink,
} from '@/app/actions/escalationActions';
import { supabase } from '@/lib/supabase';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketStatus } from '@/lib/i18n/staff';
import styles from './escalate.module.css';

type ExternalReportStatus = 'In Progress' | 'Pending' | 'Fix Completed';

type TicketLog = {
  action_type?: string | null;
  note?: string | null;
  created_at: string;
};

type TicketData = {
  id: string;
  ticket_no?: string | null;
  status?: string | null;
  subject?: string | null;
  description?: string | null;
  customers?: {
    display_name?: string | null;
  } | null;
  organizations?: {
    name?: string | null;
  } | null;
  logs?: TicketLog[] | null;
  messages?: any[] | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('th-TH');
}

function statusBadgeClass(status: string | null | undefined): string {
  if (status === 'Resolved') {
    return styles.badgeSuccess;
  }
  if (status === 'Fix Completed') {
    return styles.badgeInfo;
  }
  return styles.badgeWarning;
}

export default function EscalationPortalPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [pin, setPin] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [handoff, setHandoff] = useState<any | null>(null);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [newHandoffData, setNewHandoffData] = useState<{ token: string; pin: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { t, locale, toggleLocale } = useStaffLocale();

  const STATUS_OPTIONS: Array<{ value: ExternalReportStatus; label: string }> = [
    { value: 'In Progress', label: t('escalation.returnStatusInProgress') },
    { value: 'Pending', label: t('escalation.returnStatusPending') },
    { value: 'Fix Completed', label: t('escalation.returnStatusFixed') },
  ];

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [newStatus, setNewStatus] = useState<ExternalReportStatus>('In Progress');
  const [notes, setNotes] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  async function handleUnlock(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await verifyEscalationPin(ticketId, pin);
      if (response.error) {
        setError(response.error);
        return;
      }

      const nextTicket = response.data as TicketData;
      setTicketData(nextTicket);
      const hData = (response.data as any).handoff;
      setHandoff(hData);
      setVerifications((response.data as any).verifications || []);
      setReports((response.data as any).reports || []);

      if (hData && (hData.status === 'Claimed' || hData.status === 'Completed' || hData.status === 'Rejected')) {
        setIsClaimed(true);
        if (hData.assigned_to_external) {
          setReceiverName(hData.assigned_to_external);
        }
      }

      setNewStatus(nextTicket?.status === 'Pending' ? 'Pending' : 'In Progress');
      setIsUnlocked(true);
    } catch (err: any) {
      setError(`Unable to verify PIN: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim(event: FormEvent) {
    event.preventDefault();
    if (!receiverName.trim()) {
      setError('Please provide receiver name');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const response = await claimEscalatedTicket(ticketId, pin, receiverName.trim());
      if (response.error) {
        setError(response.error);
        return;
      }

      setIsClaimed(true);
      setSuccess(t('escalation.reportSubmitted') || 'Ticket claimed. You can now submit progress back to owner.');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(`Unable to claim ticket: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      const uploadedUrls: string[] = [];
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const extension = file.name.split('.').pop() || 'jpg';
        const fileName = `${ticketId}_ext_${Date.now()}_${index}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(fileName, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data } = supabase.storage.from('chat_media').getPublicUrl(fileName);
        uploadedUrls.push(data.publicUrl);
      }

      setAttachments((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setError(`File upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  function removeAttachment(url: string) {
    setAttachments((prev) => prev.filter((item) => item !== url));
  }

  function handleCopyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRegenerateLink() {
    setError('');
    setLoading(true);
    try {
      const response = await regenerateEscalationLink(ticketId, pin);
      if (response.error) {
        setError(response.error);
        return;
      }
      if (response.success && response.token && response.pin) {
        setNewHandoffData({ token: response.token, pin: response.pin });
        setSuccess('สร้างลิงก์เวิร์กสเปซใหม่สำเร็จแล้ว!');
      }
    } catch (err: any) {
      setError(`ไม่สามารถสร้างลิงก์ใหม่ได้: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await updateEscalatedTicketStatus(
        ticketId,
        pin,
        newStatus,
        notes.trim(),
        receiverName,
        attachments
      );

      if (response.error) {
        setError(response.error);
        return;
      }

      setSuccess(t('escalation.reportSubmitted') || 'Escalation report submitted.');
      setNotes('');
      setAttachments([]);

      // Reload data to reflect update immediately
      const verifyRes = await verifyEscalationPin(ticketId, pin);
      if (!verifyRes.error && verifyRes.data) {
        const nextTicket = verifyRes.data as TicketData;
        setTicketData(nextTicket);
        const hData = (verifyRes.data as any).handoff;
        setHandoff(hData);
        setVerifications((verifyRes.data as any).verifications || []);
        setReports((verifyRes.data as any).reports || []);
      }
    } catch (err: any) {
      setError(`Unable to submit report: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  const localeToggle = (
    <div className={styles.toolbar}>
      <button
        type="button"
        onClick={toggleLocale}
        className={styles.localeBtn}
        aria-label={locale === 'th' ? 'Switch language to English' : 'เปลี่ยนภาษาเป็นไทย'}
      >
        {locale === 'th' ? 'EN' : 'TH'}
      </button>
    </div>
  );

  if (!isUnlocked) {
    return (
      <div className={`${styles.page} ${styles.narrow}`}>
        {localeToggle}
        <div className={`${styles.card} ${styles.cardCenter}`}>
          <div className={styles.iconCircle} aria-hidden="true">
            <Lock size={28} />
          </div>
          <h2 className={styles.heading}>{t('escalation.unlockTicket')}</h2>
          <p className={styles.lede}>{t('escalation.unlockDesc')}</p>

          {error && (
            <div className={`${styles.alert} ${styles.alertDanger} ${styles.mb16}`} role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="escalation-pin" className={styles.visuallyHidden}>
                {t('escalation.unlockTicket')} PIN
              </label>
              <input
                id="escalation-pin"
                type="password"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('escalation.pinPlaceholder')}
                className={`${styles.input} ${styles.pinInput}`}
                disabled={loading}
              />
            </div>
            <button
              disabled={loading || pin.length < 4}
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
            >
              {loading ? (
                <Loader2 className={styles.spin} size={18} aria-hidden="true" />
              ) : (
                <>
                  <Unlock size={18} aria-hidden="true" /> {t('escalation.unlockTicket')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!isClaimed) {
    return (
      <div className={`${styles.page} ${styles.narrow}`}>
        {localeToggle}
        <div className={styles.card}>
          <h2 className={`${styles.heading} ${styles.cardCenter}`}>{t('escalation.claimTitle')}</h2>
          <p className={`${styles.lede} ${styles.cardCenter}`}>
            {t('escalation.claimDesc')} <span className={styles.tabular}>#{ticketData?.ticket_no || '-'}</span>
          </p>

          <form onSubmit={handleClaim} className={styles.form}>
            <div className={styles.field}>
              <label htmlFor="escalation-claim-name" className={styles.label}>
                {t('escalation.receiverName')}
              </label>
              <input
                id="escalation-claim-name"
                type="text"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                placeholder={t('escalation.receiverPlaceholder')}
                className={styles.input}
              />
            </div>

            {error && (
              <div className={`${styles.alert} ${styles.alertDanger}`} role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              disabled={loading || !receiverName.trim()}
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
            >
              {loading ? (
                <Loader2 className={styles.spin} size={18} aria-hidden="true" />
              ) : (
                <>
                  <ClipboardCheck size={18} aria-hidden="true" /> {t('escalation.claimJob')}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const isHandoffExpired = Boolean(
    handoff?.status === 'Expired' || (handoff?.expires_at && new Date(handoff.expires_at) < new Date())
  );
  const rejectionVerifications = verifications.filter((v) => v.decision === 'Rejected');
  const formLocked = loading || Boolean(success) || isHandoffExpired;

  return (
    <div className={styles.page}>
      {localeToggle}

      {/* 1. Expired Magic Link Alert Banner */}
      {isHandoffExpired && (
        <section className={`${styles.banner} ${styles.bannerDanger}`} role="alert">
          <div className={styles.bannerHead}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <AlertCircle size={22} />
            </span>
            <div>
              <h3 className={styles.bannerTitle}>ลิงก์เข้าสู่เวิร์กสเปซหมดอายุแล้ว (Workspace Link Expired)</h3>
              <p className={styles.bannerText}>
                ลิงก์การส่งต่อนี้หมดอายุแล้ว คุณยังคงสามารถดูประวัติงานและแชทเดิมได้ แต่จะไม่สามารถบันทึกหรือส่งรายงานความคืบหน้าใหม่ได้
              </p>
            </div>
          </div>

          {!newHandoffData ? (
            <button
              type="button"
              onClick={handleRegenerateLink}
              disabled={loading}
              className={`${styles.btn} ${styles.btnDanger}`}
            >
              {loading ? (
                <Loader2 className={styles.spin} size={16} aria-hidden="true" />
              ) : (
                <Unlock size={16} aria-hidden="true" />
              )}
              สร้างลิงก์ส่งงานใหม่ (Regenerate Magic Link)
            </button>
          ) : (
            <div className={`${styles.banner} ${styles.bannerSuccess}`}>
              <div>
                <h4 className={styles.successTitle}>สร้างลิงก์เวิร์กสเปซใหม่สำเร็จ!</h4>
                <p className={styles.bannerText}>กรุณาคัดลอกลิงก์และรหัส PIN ใหม่เพื่อใช้เข้าทำงานต่อ:</p>
                <div className={styles.copyRow}>
                  <label htmlFor="escalation-new-link" className={styles.visuallyHidden}>
                    ลิงก์เวิร์กสเปซใหม่
                  </label>
                  <input
                    id="escalation-new-link"
                    readOnly
                    value={`${window.location.origin}/escalate/${newHandoffData.token}`}
                    className={`${styles.input} ${styles.mono}`}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyLink(`${window.location.origin}/escalate/${newHandoffData.token}`)}
                    className={`${styles.btn} ${styles.btnSuccess}`}
                  >
                    {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                  </button>
                </div>
                <div className={styles.pinLine}>
                  PIN รหัสเข้างานใหม่:{' '}
                  <span className={`${styles.pinValue} ${styles.mono}`}>{newHandoffData.pin}</span>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Rework Alert Banner (QA Rejection History) */}
      {rejectionVerifications.length > 0 && (
        <section className={`${styles.banner} ${styles.bannerWarning}`} aria-labelledby="escalation-rework-title">
          <div className={styles.bannerHead}>
            <span className={styles.bannerIcon} aria-hidden="true">
              <AlertCircle size={22} />
            </span>
            <div>
              <h3 id="escalation-rework-title" className={styles.bannerTitle}>
                งานถูกส่งกลับแก้ไขเพิ่มเติม (Rework Requested)
              </h3>
              <p className={styles.bannerText}>
                ผู้มอบหมายงานได้ตรวจสอบและส่งกลับให้แก้ไขเพิ่ม กรุณาดูรายละเอียดประวัติความคิดเห็นด้านล่างนี้
              </p>
            </div>
          </div>

          <div>
            <p className={styles.reworkLabel}>ประวัติความคิดเห็นที่ให้แก้ไข ({rejectionVerifications.length})</p>
            <ul className={styles.reworkList}>
              {rejectionVerifications.map((verification, idx) => (
                <li key={idx} className={styles.reworkItem}>
                  <div className={styles.reworkMeta}>
                    <span>รอบแก้ไขที่ {rejectionVerifications.length - idx}</span>
                    <span className={styles.tabular}>{formatDateTime(verification.created_at)}</span>
                  </div>
                  <p className={styles.reworkNote}>{verification.feedback_notes || 'ไม่ได้ระบุเหตุผลการปฏิเสธ'}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Main Grid Content */}
      <div className={styles.grid}>
        {/* Left Column */}
        <div className={styles.col}>
          <section className={styles.card} aria-label={t('escalation.serviceTicket')}>
            <div className={styles.summaryHead}>
              <div className={styles.ticketId}>
                <span className={styles.ticketIcon} aria-hidden="true">
                  <ClipboardCheck size={20} />
                </span>
                <div>
                  <p className={styles.eyebrow}>{t('escalation.serviceTicket')}</p>
                  <h2 className={`${styles.ticketNo} ${styles.mono}`}>#{ticketData?.ticket_no || '-'}</h2>
                </div>
              </div>
              <span className={`${styles.badge} ${statusBadgeClass(ticketData?.status)}`}>
                {translateTicketStatus(ticketData?.status || 'New', locale)}
              </span>
            </div>

            <div className={styles.meta}>
              <div className={styles.metaItem}>
                <User size={14} aria-hidden="true" />
                <span>{ticketData?.customers?.display_name || 'N/A'}</span>
              </div>
              <div className={styles.metaItem}>
                <Building2 size={14} aria-hidden="true" />
                <span>{ticketData?.organizations?.name || 'N/A'}</span>
              </div>
            </div>

            <div className={styles.subjectBlock}>
              <p className={styles.eyebrow}>{t('escalation.subject')}</p>
              <p className={styles.subject}>{ticketData?.subject || '-'}</p>
            </div>

            <div className={styles.descBox}>
              <p className={styles.eyebrow}>{t('escalation.originalDescription')}</p>
              <p className={styles.descText}>{ticketData?.description || 'No description'}</p>
            </div>
          </section>

          {ticketData?.messages && ticketData.messages.length > 0 && (
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>
                <MessageSquare size={18} aria-hidden="true" /> {t('escalation.chatWorkspace')}
              </h3>
              <div className={styles.chat}>
                {ticketData.messages.map((msg, index) => {
                  const isStaff = msg.sender_type === 'staff' || msg.sender_type === 'agent' || msg.sender_type === 'system';
                  const isSystem = msg.sender_type === 'system';

                  if (isSystem) {
                    return (
                      <div key={index} className={styles.sysMsg}>
                        <span className={styles.sysMsgText}>{msg.content}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className={`${styles.msg} ${isStaff ? styles.msgStaff : ''}`}>
                      <div className={`${styles.bubble} ${isStaff ? styles.bubbleStaff : ''}`}>
                        {(() => {
                          const mediaUrl = typeof msg.media_path === 'string' && msg.media_path ? msg.media_path : msg.content;
                          const hasHttpMedia = typeof mediaUrl === 'string' && mediaUrl.startsWith('http');
                          if (hasHttpMedia && msg.message_type === 'image') {
                            return (
                              <button
                                type="button"
                                className={styles.thumbBtn}
                                onClick={() => window.open(mediaUrl, '_blank')}
                                aria-label="Open image attachment in new tab"
                              >
                                <img src={mediaUrl} className={styles.chatImg} alt="Image attachment from conversation" />
                              </button>
                            );
                          }
                          if (hasHttpMedia && ['file', 'video', 'audio'].includes(msg.message_type)) {
                            return (
                              <a href={mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
                                เปิดไฟล์แนบ ({msg.message_type})
                              </a>
                            );
                          }
                          return msg.content;
                        })()}
                      </div>
                      <span className={styles.msgMeta}>
                        {isStaff ? 'SUPPORT TEAM' : ticketData.customers?.display_name || 'CUSTOMER'} •{' '}
                        {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Right Column */}
        <div className={styles.col}>
          {ticketData?.logs && ticketData.logs.length > 0 && (
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>
                <History size={18} aria-hidden="true" /> {t('escalation.history')}
              </h3>
              <ol className={styles.timeline}>
                {ticketData.logs.map((log, index) => (
                  <li key={`${log.created_at}-${index}`} className={styles.tlItem}>
                    <span
                      className={`${styles.tlDot} ${log.action_type === 'claim' ? styles.tlDotClaim : ''}`}
                      aria-hidden="true"
                    />
                    <div>
                      <p className={styles.tlNote}>{log.note || '-'}</p>
                      <p className={styles.tlTime}>
                        <Calendar size={12} aria-hidden="true" /> {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {reports && reports.length > 0 && (
            <section className={styles.card}>
              <h3 className={styles.cardTitle}>
                <FileText size={18} aria-hidden="true" /> ประวัติการรายงานความคืบหน้า ({reports.length})
              </h3>
              <ul className={styles.reports}>
                {reports.map((rep, idx) => (
                  <li key={rep.id || idx} className={styles.report}>
                    <div className={styles.reportHead}>
                      <span className={`${styles.badge} ${statusBadgeClass(rep.status)}`}>{rep.status}</span>
                      <span className={styles.reportBy}>โดย {rep.reporter_name}</span>
                    </div>
                    <p className={styles.reportNote}>{rep.notes || 'ไม่มีบันทึกรายละเอียด'}</p>

                    {rep.attachments && rep.attachments.length > 0 && (
                      <div className={styles.thumbs}>
                        {rep.attachments.map((url: string, aIdx: number) => (
                          <button
                            type="button"
                            key={`${url}-${aIdx}`}
                            className={`${styles.thumb} ${styles.thumbBtn}`}
                            onClick={() => window.open(url, '_blank')}
                            aria-label={`Open attachment ${aIdx + 1} in new tab`}
                          >
                            <img src={url} alt={`Report attachment ${aIdx + 1}`} className={styles.thumbImg} />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={`${styles.tlTime} ${styles.mt8}`}>
                      <Calendar size={12} aria-hidden="true" /> {formatDateTime(rep.created_at)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className={styles.card}>
            <h3 className={styles.cardTitle}>
              <FileText size={18} aria-hidden="true" /> {t('escalation.externalReport')}
            </h3>

            {success && (
              <div className={`${styles.alert} ${styles.alertSuccess} ${styles.mb16}`} role="status">
                <CheckCircle size={16} aria-hidden="true" /> <span>{success}</span>
              </div>
            )}

            {error && (
              <div className={`${styles.alert} ${styles.alertDanger} ${styles.mb16}`} role="alert">
                <AlertCircle size={16} aria-hidden="true" /> <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleUpdate} className={styles.form}>
              <div className={styles.formGrid}>
                <div className={styles.field}>
                  <label htmlFor="escalation-status" className={styles.label}>
                    {t('escalation.returnStatus')}
                  </label>
                  <select
                    id="escalation-status"
                    value={newStatus}
                    onChange={(event) => setNewStatus(event.target.value as ExternalReportStatus)}
                    disabled={formLocked}
                    className={styles.select}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="escalation-receiver" className={styles.label}>
                    {t('escalation.receiver')}
                  </label>
                  <input
                    id="escalation-receiver"
                    type="text"
                    value={receiverName}
                    disabled
                    readOnly
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="escalation-notes" className={styles.label}>
                  Work log
                </label>
                <textarea
                  id="escalation-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={formLocked}
                  placeholder={
                    isHandoffExpired
                      ? 'ไม่สามารถเขียนบันทึกความคืบหน้าได้เนื่องจากลิงก์หมดอายุ'
                      : 'Describe what has been done or what is blocked...'
                  }
                  className={styles.textarea}
                />
              </div>

              <div className={styles.field}>
                <span className={styles.label} id="escalation-attachments-label">
                  Attachments
                </span>
                <div className={styles.thumbs} role="group" aria-labelledby="escalation-attachments-label">
                  {attachments.map((url, index) => (
                    <div key={`${url}-${index}`} className={`${styles.thumb} ${styles.thumbLarge}`}>
                      <img src={url} alt={`Pending attachment ${index + 1}`} className={styles.thumbImg} />
                      {!success && (
                        <button
                          type="button"
                          onClick={() => removeAttachment(url)}
                          className={styles.removeBtn}
                          aria-label={`Remove attachment ${index + 1}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                  {!success && !isHandoffExpired && (
                    <label
                      htmlFor="escalation-file-upload"
                      className={`${styles.uploadTile} ${uploading ? styles.uploadTileBusy : ''}`}
                    >
                      {uploading ? (
                        <Loader2 className={styles.spin} size={20} aria-hidden="true" />
                      ) : (
                        <>
                          <Camera size={20} aria-hidden="true" />
                          <span>{t('escalation.upload')}</span>
                        </>
                      )}
                      <input
                        id="escalation-file-upload"
                        type="file"
                        multiple
                        accept="image/*"
                        className={styles.visuallyHidden}
                        onChange={handleFileUpload}
                        disabled={uploading}
                        aria-label={t('escalation.upload')}
                      />
                    </label>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={formLocked}
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}
              >
                {loading ? (
                  <Loader2 className={styles.spin} size={18} aria-hidden="true" />
                ) : success ? (
                  <>
                    <CheckCircle size={18} aria-hidden="true" />
                    {t('escalation.reportSubmitted')}
                  </>
                ) : isHandoffExpired ? (
                  <>
                    <AlertCircle size={18} aria-hidden="true" />
                    ลิงก์หมดอายุแล้ว
                  </>
                ) : (
                  <>
                    <Send size={18} aria-hidden="true" />
                    {t('escalation.submitReport')}
                  </>
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
