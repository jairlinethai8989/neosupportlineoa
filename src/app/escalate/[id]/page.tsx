'use client';

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
} from '@/app/actions/escalationActions';
import { supabase } from '@/lib/supabase';

type ExternalReportStatus = 'In Progress' | 'Pending';

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
  hospitals?: {
    name?: string | null;
  } | null;
  logs?: TicketLog[] | null;
};

const STATUS_OPTIONS: Array<{ value: ExternalReportStatus; label: string }> = [
  { value: 'In Progress', label: 'Return to owner for review (In Progress)' },
  { value: 'Pending', label: 'Blocked (Pending)' },
];

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
      setSuccess('Ticket claimed. You can now submit progress back to owner.');
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

      setSuccess('Escalation report submitted. Owner needs to review and resolve ticket.');
      setNotes('');
      setAttachments([]);
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
        <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '8px' }}>Escalation Access</h2>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '24px' }}>
          Enter the 4-digit PIN to open escalation ticket details.
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
            placeholder="4-digit PIN"
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
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><Unlock size={18} /> Unlock Ticket</>}
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
        }}
      >
        <h2 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '16px', textAlign: 'center' }}>
          Claim Escalation Ticket
        </h2>
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', marginBottom: '24px' }}>
          Identify the external receiver before submitting escalation work for #{ticketData?.ticket_no || '-'}.
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
              Receiver name
            </label>
            <input
              type="text"
              value={receiverName}
              onChange={(event) => setReceiverName(event.target.value)}
              placeholder="Enter receiver name..."
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
            {loading ? <Loader2 className="animate-spin" size={18} /> : <><ClipboardCheck size={18} /> Claim Job</>}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div
        className="glass"
        style={{ padding: '24px', background: '#ffffff', borderRadius: '24px', border: '1px solid #e2e8f0' }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
          }}
        >
          <div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Ticket No.
            </p>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: 'var(--primary)' }}>
              #{ticketData?.ticket_no || '-'}
            </h2>
          </div>
          <span
            style={{
              ...statusBadgeStyle(ticketData?.status),
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 800,
            }}
          >
            {ticketData?.status || 'Unknown'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '10px', color: '#64748b' }}>
              <User size={16} />
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                Customer
              </p>
              <p style={{ fontSize: '14px', fontWeight: 700 }}>
                {ticketData?.customers?.display_name || 'N/A'}
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: '#f1f5f9', borderRadius: '10px', color: '#64748b' }}>
              <Building2 size={16} />
            </div>
            <div>
              <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase' }}>
                Hospital
              </p>
              <p style={{ fontSize: '14px', fontWeight: 700 }}>{ticketData?.hospitals?.name || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
            Subject
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
            Original Description
          </p>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: '#334155', whiteSpace: 'pre-wrap' }}>
            {ticketData?.description || 'No description'}
          </p>
        </div>
      </div>

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
            <History size={18} color="var(--primary)" /> Escalation History
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
          <FileText size={18} color="var(--primary)" /> External Report
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
                Return status
              </label>
              <select
                value={newStatus}
                onChange={(event) => setNewStatus(event.target.value as ExternalReportStatus)}
                disabled={loading || Boolean(success)}
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
                Receiver
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
              disabled={loading || Boolean(success)}
              placeholder="Describe what has been done or what is blocked..."
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
              {!success && (
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
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>Upload</span>
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
            disabled={loading || Boolean(success)}
            style={{
              background: success ? '#94a3b8' : '#10b981',
              color: 'white',
              border: 'none',
              padding: '16px',
              borderRadius: '12px',
              fontWeight: 800,
              cursor: loading || Boolean(success) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: success ? 'none' : '0 8px 24px rgba(16, 185, 129, 0.25)',
              transition: 'all 0.3s',
            }}
          >
            {loading ? (
              <Loader2 className="animate-spin" size={18} />
            ) : success ? (
              <>
                <CheckCircle size={18} />
                Report submitted
              </>
            ) : (
              <>
                <Send size={18} />
                Submit report to owner
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

