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

function statusBadgeStyle(status: string | null | undefined): React.CSSProperties {
  if (status === 'Resolved') {
    return {
      background: '#d1fae5',
      color: '#065f46',
    };
  }
  if (status === 'Fix Completed') {
    return {
      background: '#e0f7fa',
      color: '#006064',
    };
  }
  return {
    background: '#fef3c7',
    color: '#92400e',
  };
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

  if (!isUnlocked) {
    return (
      <div
        className="glass"
        style={{
          marginTop: '10vh',
          padding: '32px',
          borderRadius: '24px',
          textAlign: 'center',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <button
            type="button"
            onClick={toggleLocale}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              fontWeight: 800,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            {locale === 'th' ? 'EN' : 'TH'}
          </button>
        </div>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(8, 145, 178, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
            color: 'var(--primary)',
          }}
        >
          <Lock size={32} />
        </div>
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>{t('escalation.unlockTicket')}</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          {t('escalation.unlockDesc')}
        </p>

        {error && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUnlock} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input
            type="password"
            maxLength={4}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, ''))}
            placeholder={t('escalation.pinPlaceholder')}
            style={{
              padding: '16px',
              borderRadius: '12px',
              border: '2px solid #e2e8f0',
              textAlign: 'center',
              fontSize: '24px',
              letterSpacing: '8px',
              fontWeight: 800,
              outline: 'none',
            }}
            disabled={loading}
          />
          <button
            disabled={loading || pin.length < 4}
            type="submit"
            style={{
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> {t('escalation.unlockTicket')}</>}
          </button>
        </form>
      </div>
    );
  }

  if (!isClaimed) {
    return (
      <div
        className="glass"
        style={{
          padding: '32px',
          borderRadius: '24px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
          position: 'relative'
        }}
      >
        <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
          <button
            type="button"
            onClick={toggleLocale}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              fontWeight: 800,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            {locale === 'th' ? 'EN' : 'TH'}
          </button>
        </div>

        <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>
          {t('escalation.claimTitle')}
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>
          {t('escalation.claimDesc')} #{ticketData?.ticket_no || '-'}
        </p>

        <form onSubmit={handleClaim} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 800,
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              {t('escalation.receiverName')}
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(event) => setReceiverName(event.target.value)}
              placeholder={t('escalation.receiverPlaceholder')}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '15px',
                fontWeight: 700,
                outline: 'none',
              }}
            />
          </div>

          {error && (
            <div
              style={{
                padding: '12px',
                background: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                borderRadius: '12px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            disabled={loading || !receiverName.trim()}
            type="submit"
            style={{
              background: '#0891b2',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(8, 145, 178, 0.2)',
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><ClipboardCheck size={18} /> {t('escalation.claimJob')}</>}
          </button>
        </form>
      </div>
    );
  }

  const isHandoffExpired = handoff?.status === 'Expired' || (handoff?.expires_at && new Date(handoff.expires_at) < new Date());
  const rejectionVerifications = verifications.filter((v) => v.decision === 'Rejected');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%', maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
      
      {/* 1. Expired Magic Link Alert Banner */}
      {isHandoffExpired && (
        <div
          className="glass"
          style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            backdropFilter: 'blur(16px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.15)', borderRadius: '12px', color: '#ef4444' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>ลิงก์เข้าสู่เวิร์กสเปซหมดอายุแล้ว (Workspace Link Expired)</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                ลิงก์การส่งต่อนี้หมดอายุแล้ว คุณยังคงสามารถดูประวัติงานและแชทเดิมได้ แต่จะไม่สามารถบันทึกหรือส่งรายงานความคืบหน้าใหม่ได้
              </p>
            </div>
          </div>
          
          {!newHandoffData ? (
            <button
              onClick={handleRegenerateLink}
              disabled={loading}
              style={{
                alignSelf: 'flex-start',
                background: '#ef4444',
                color: 'white',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '12px',
                fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                transition: 'all 0.2s'
              }}
            >
              {loading ? <Loader2 className="animate-spin" size={16} /> : <Unlock size={16} />}
              สร้างลิงก์ส่งงานใหม่ (Regenerate Magic Link)
            </button>
          ) : (
            <div style={{ padding: '16px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '12px', width: '100%' }}>
              <h4 style={{ fontWeight: 800, color: '#10b981', fontSize: '14px', marginBottom: '8px' }}>สร้างลิงก์เวิร์กสเปซใหม่สำเร็จ!</h4>
              <p style={{ fontSize: '13px', color: '#475569', marginBottom: '12px' }}>กรุณาคัดลอกลิงก์และรหัส PIN ใหม่เพื่อใช้เข้าทำงานต่อ:</p>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <input readOnly value={`${window.location.origin}/escalate/${newHandoffData.token}`} style={{ flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#f8fafc', outline: 'none' }} />
                <button onClick={() => handleCopyLink(`${window.location.origin}/escalate/${newHandoffData.token}`)} style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontWeight: 800, fontSize: '12px' }}>
                  {copied ? 'คัดลอกแล้ว' : 'คัดลอกลิงก์'}
                </button>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                PIN รหัสเข้างานใหม่: <span style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', marginLeft: '6px', fontFamily: 'monospace', fontSize: '14px' }}>{newHandoffData.pin}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Glassmorphic Rework Alert Banner (QA Rejection History) */}
      {rejectionVerifications.length > 0 && (
        <div
          className="glass"
          style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(239, 68, 68, 0.08) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 10px 30px rgba(245, 158, 11, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '12px', color: '#f59e0b' }}>
              <AlertCircle size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>งานถูกส่งกลับแก้ไขเพิ่มเติม (Rework Requested)</h3>
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                ผู้มอบหมายงานได้ตรวจสอบและส่งกลับให้แก้ไขเพิ่ม กรุณาดูรายละเอียดประวัติความคิดเห็นด้านล่างนี้
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255, 255, 255, 0.5)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(245, 158, 11, 0.1)' }}>
            <p style={{ fontSize: '12px', fontWeight: 800, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              ประวัติความคิดเห็นที่ให้แก้ไข ({rejectionVerifications.length})
            </p>
            {rejectionVerifications.map((verification, idx) => (
              <div key={idx} style={{ 
                padding: '12px', 
                background: 'rgba(255, 255, 255, 0.8)', 
                borderLeft: '4px solid #ef4444', 
                borderRadius: '8px', 
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                fontSize: '13px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '11px', marginBottom: '6px', fontWeight: 700 }}>
                  <span>รอบแก้ไขที่ {rejectionVerifications.length - idx}</span>
                  <span>{formatDateTime(verification.created_at)}</span>
                </div>
                <p style={{ color: '#1e293b', fontWeight: 600, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {verification.feedback_notes || 'ไม่ได้ระบุเหตุผลการปฏิเสธ'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid Content */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 450px), 1fr))', 
        gap: '24px', 
        alignItems: 'start',
        width: '100%'
      }}>
        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div
          className="glass"
          style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0', position: 'relative' }}
        >
        <div style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10 }}>
          <button
            type="button"
            onClick={toggleLocale}
            style={{
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              fontSize: '12px',
              fontWeight: 800,
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            {locale === 'th' ? 'EN' : 'TH'}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '16px',
            borderBottom: '1px solid #f1f5f9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ padding: '8px', background: 'var(--primary-transparent)', borderRadius: '12px', color: 'var(--primary)' }}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('escalation.serviceTicket')}
              </p>
              <h2 style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main)' }}>

                #{ticketData?.ticket_no || '-'}
              </h2>
            </div>
          </div>
          <span
            style={{
              ...statusBadgeStyle(ticketData?.status),
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: 900,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            {translateTicketStatus(ticketData?.status || 'New', locale)}
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={14} color="#94a3b8" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
              {ticketData?.customers?.display_name || 'N/A'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={14} color="#94a3b8" />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
              {ticketData?.organizations?.name || 'N/A'}
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
            {t('escalation.subject')}
          </p>
          <p style={{ fontSize: '16px', fontWeight: 800, lineHeight: 1.5 }}>{ticketData?.subject || '-'}</p>
        </div>

        <div style={{ padding: '20px', background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <p
            style={{
              fontSize: '11px',
              color: '#64748b',
              fontWeight: 800,
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            {t('escalation.originalDescription')}
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {ticketData?.description || 'No description'}
          </p>
        </div>
      </div>

      {ticketData?.messages && ticketData.messages.length > 0 && (
        <div
          className="glass"
          style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 800,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <MessageSquare size={18} color="var(--primary)" /> {t('escalation.chatWorkspace')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
            {ticketData.messages.map((msg, index) => {
              const isStaff = msg.sender_type === 'staff' || msg.sender_type === 'agent' || msg.sender_type === 'system';
              const isSystem = msg.sender_type === 'system';
              
              if (isSystem) {
                return (
                  <div key={index} style={{ textAlign: 'center', margin: '8px 0' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8', background: '#f8fafc', padding: '4px 12px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div 
                  key={index} 
                  style={{ 
                    alignSelf: isStaff ? 'flex-end' : 'flex-start',
                    maxWidth: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: isStaff ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '20px',
                    borderBottomLeftRadius: isStaff ? '20px' : '4px',
                    borderBottomRightRadius: isStaff ? '20px' : '20px',
                    background: isStaff ? 'var(--primary-transparent)' : '#f1f5f9',
                    border: isStaff ? '1px solid var(--primary-dim)' : '1px solid #e2e8f0',
                    color: isStaff ? 'var(--primary)' : '#1e293b',
                    fontSize: '14px',
                    fontWeight: 600,
                    lineHeight: 1.5,
                  }}>
                    {(() => {
                      const mediaUrl = typeof msg.media_path === 'string' && msg.media_path ? msg.media_path : msg.content;
                      const hasHttpMedia = typeof mediaUrl === 'string' && mediaUrl.startsWith('http');
                      if (hasHttpMedia && msg.message_type === 'image') {
                        return (
                          <div style={{ cursor: 'pointer' }} onClick={() => window.open(mediaUrl, '_blank')}>
                            <img src={mediaUrl} style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '12px' }} alt="attachment" />
                          </div>
                        );
                      }
                      if (hasHttpMedia && ['file', 'video', 'audio'].includes(msg.message_type)) {
                        return (
                          <a href={mediaUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', fontWeight: 700 }}>
                            เปิดไฟล์แนบ ({msg.message_type})
                          </a>
                        );
                      }
                      return msg.content;
                    })()}
                  </div>
                  <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px', fontWeight: 700, textTransform: 'uppercase' }}>
                    {isStaff ? 'SUPPORT TEAM' : (ticketData.customers?.display_name || 'CUSTOMER')} • {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>

      {/* Right Column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {ticketData?.logs && ticketData.logs.length > 0 && (
          <div
          className="glass"
          style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 800,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <History size={18} color="var(--primary)" /> {t('escalation.history')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {ticketData.logs.map((log, index) => (
              <div key={`${log.created_at}-${index}`} style={{ display: 'flex', gap: '12px' }}>
                <div
                  style={{
                    marginTop: '4px',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: log.action_type === 'claim' ? '#0891b2' : '#10b981',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{log.note || '-'}</p>
                  <p
                    style={{
                      fontSize: '11px',
                      color: '#94a3b8',
                      marginTop: '2px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Calendar size={12} /> {formatDateTime(log.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {reports && reports.length > 0 && (
        <div
          className="glass"
          style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 800,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FileText size={18} color="var(--primary)" /> ประวัติการรายงานความคืบหน้า ({reports.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {reports.map((rep, idx) => (
              <div key={rep.id || idx} style={{ borderBottom: idx < reports.length - 1 ? '1px solid #f1f5f9' : 'none', paddingBottom: idx < reports.length - 1 ? '16px' : '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ 
                    fontSize: '11px', 
                    fontWeight: 900, 
                    padding: '4px 8px', 
                    borderRadius: '12px', 
                    ...statusBadgeStyle(rep.status)
                  }}>
                    {rep.status}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>
                    โดย {rep.reporter_name}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#334155', fontWeight: 600, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {rep.notes || 'ไม่มีบันทึกรายละเอียด'}
                </p>
                
                {rep.attachments && rep.attachments.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                    {rep.attachments.map((url: string, aIdx: number) => (
                      <div 
                        key={`${url}-${aIdx}`} 
                        style={{ width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', cursor: 'pointer' }}
                        onClick={() => window.open(url, '_blank')}
                      >
                        <img src={url} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}>
                  <Calendar size={12} /> {formatDateTime(rep.created_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="glass"
        style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}
      >
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 800,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileText size={18} color="var(--primary)" /> {t('escalation.externalReport')}
        </h3>

        {success && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#10b981',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <CheckCircle size={16} /> {success}
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '12px',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: '12px',
              marginBottom: '20px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#64748b',
                  marginBottom: '8px',
                }}
              >
                {t('escalation.returnStatus')}
              </label>
              <select
              value={newStatus}
              onChange={(event) => setNewStatus(event.target.value as ExternalReportStatus)}
              disabled={loading || Boolean(success) || isHandoffExpired}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  fontSize: '14px',
                  fontWeight: 700,
                  outline: 'none',
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#64748b',
                  marginBottom: '8px',
                }}
              >
                {t('escalation.receiver')}
              </label>
              <input
                type="text"
                value={receiverName}
                disabled
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#f1f5f9',
                  fontSize: '14px',
                  fontWeight: 700,
                  outline: 'none',
                  color: '#94a3b8',
                }}
              />
            </div>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 800,
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Work log
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={loading || Boolean(success) || isHandoffExpired}
              placeholder={isHandoffExpired ? "ไม่สามารถเขียนบันทึกความคืบหน้าได้เนื่องจากลิงก์หมดอายุ" : "Describe what has been done or what is blocked..."}
              style={{
                width: '100%',
                minHeight: '90px',
                padding: '14px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 800,
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Attachments
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {attachments.map((url, index) => (
                <div
                  key={`${url}-${index}`}
                  style={{
                    position: 'relative',
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <img src={url} alt="attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {!success && (
                    <button
                      type="button"
                      onClick={() => removeAttachment(url)}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'rgba(239, 68, 68, 0.8)',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '2px',
                        cursor: 'pointer',
                        color: 'white',
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              {!success && !isHandoffExpired && (
                <label
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '12px',
                    border: '2px dashed #cbd5e1',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: uploading ? 'not-allowed' : 'pointer',
                    background: '#f8fafc',
                    gap: '4px',
                  }}
                >
                  {uploading ? (
                    <Loader2 className="animate-spin" size={20} color="#94a3b8" />
                  ) : (
                    <>
                      <Camera size={20} color="#94a3b8" />
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>{t('escalation.upload')}</span>
                    </>
                  )}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    hidden
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              )}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || Boolean(success) || isHandoffExpired}
            style={{
              background: success ? '#94a3b8' : isHandoffExpired ? '#cbd5e1' : '#10b981',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: loading || Boolean(success) || isHandoffExpired ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: (success || isHandoffExpired) ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.3s',
            }}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : success ? (
              <>
                <CheckCircle size={18} />
                {t('escalation.reportSubmitted')}
              </>
            ) : isHandoffExpired ? (
              <>
                <AlertCircle size={18} />
                ลิงก์หมดอายุแล้ว
              </>
            ) : (
              <>
                <Send size={18} />
                {t('escalation.submitReport')}
              </>
            )}
          </button>
        </form>
      </div>
      </div>
      </div>
    </div>
  );
}

