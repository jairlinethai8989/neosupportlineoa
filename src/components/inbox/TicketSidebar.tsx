'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  CheckCircle2,
  Copy,
  History,
  Hourglass,
  Info,
  Layout,
  Loader2,
  User,
  X,
} from 'lucide-react';
import type { InboxAgent, InboxConversation, InboxTicket, InboxViewMode } from '@/types/inbox';
import { ticketService } from '@/lib/services/ticketService';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

interface TicketSidebarProps {
  selectedChat: InboxConversation;
  currentTicket: InboxTicket | null;
  agent: InboxAgent | null;
  viewMode: InboxViewMode;
  setViewMode: (mode: InboxViewMode) => void;
  onFetchGlobalHistory: () => void;
  onResolve: () => void;
  onTransfer: () => void;
  onCloseSession: () => void;
  onCopySurvey: () => void;
  onWarn: (title: string, body: string) => void;
}

export const TicketSidebar: React.FC<TicketSidebarProps> = ({
  selectedChat,
  currentTicket,
  agent,
  viewMode,
  setViewMode,
  onFetchGlobalHistory,
  onResolve,
  onTransfer,
  onCloseSession,
  onCopySurvey,
  onWarn,
}) => {
  const { t } = useStaffLocale();
  void onTransfer;

  const statusLower = currentTicket?.status?.toLowerCase();
  const isResolved =
    statusLower === 'resolved' ||
    statusLower === 'closed' ||
    statusLower === 'fix completed';
  const isOwner = currentTicket?.assigned_agent_id === agent?.id;
  const isAdmin = agent?.role === 'Administrator';
  const isSessionActive = !isResolved && !!(selectedChat.status === 'active' || selectedChat.is_active);
  const isEscalatedOrPending = currentTicket?.status === 'Escalated' || currentTicket?.status === 'Pending';

  const [copied, setCopied] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showPendingConfirm, setShowPendingConfirm] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');
  const customer = selectedChat.customers;
  const hasCustomerIdentity = Boolean(customer?.display_name || customer?.avatar_url || customer?.line_user_id);
  const hasCustomerProfileMeta = Boolean(customer?.hospitals?.name || customer?.departments?.name || customer?.positions?.name);
  const shouldShowCustomerMetaSkeleton = !hasCustomerIdentity && !hasCustomerProfileMeta;

  const activeMagicLink =
    magicLink || (currentTicket?.escalation_token ? `${window.location.origin}/escalate/${currentTicket.escalation_token}` : null);

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePendingConfirm = async () => {
    if (!currentTicket?.id) return;
    setShowPendingConfirm(false);
    setIsProcessing(true);
      try {
        const randomToken = `P-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        await ticketService.updateStatus(currentTicket.id, 'Pending', undefined, undefined, randomToken);
        setMagicLink(`${window.location.origin}/escalate/${randomToken}`);
      } catch (err: unknown) {
        onWarn(t('common.messages.error'), err instanceof Error ? err.message : 'Unknown error');
      } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className={`glass inbox-details-panel ${viewMode !== 'details' ? 'hidden-mobile' : ''}`}
      style={{ width: '460px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={16} color="var(--primary)" />
          <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {t('inbox.customerMeta')}
          </h3>
        </div>
        <button onClick={() => setViewMode('chat')} className="show-mobile glass-interactive flex-center" style={{ padding: '8px', borderRadius: '8px', border: 'none' }}>
          <X size={18} />
        </button>
      </div>

      <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
        {shouldShowCustomerMetaSkeleton ? (
          <div style={{ display: 'grid', gap: '14px' }}>
            <div style={{ height: '96px', borderRadius: '18px', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: '14px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: '14px', borderRadius: '8px', width: '85%', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.4s ease-in-out infinite' }} />
            <div style={{ height: '14px', borderRadius: '8px', width: '72%', background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.4s ease-in-out infinite' }} />
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '20px',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', flex: '0 0 140px', marginInline: 'auto' }}>
              {customer?.avatar_url ? (
                <Image
                  src={customer.avatar_url}
                  alt={customer?.display_name || 'LINE customer'}
                  width={80}
                  height={80}
                  style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '24px',
                    objectFit: 'cover',
                    border: '2px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 8px 24px rgba(0,242,254,0.25)',
                  }}
                />
              ) : (
                <div style={{ width: '80px', height: '80px', borderRadius: '24px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(0,242,254,0.3)' }}>
                  <User size={40} color="#0a0e14" />
                </div>
              )}
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: '800', fontSize: '18px', marginBottom: '4px' }}>{customer?.display_name || t('inbox.lineUser')}</p>
                <code style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px' }}>
                  ID: {customer?.line_user_id?.substring(0, 16)}...
                </code>
              </div>
            </div>
            <div style={{ display: 'grid', gap: '10px', alignContent: 'center', flex: '1 1 180px', minWidth: '0' }}>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>
                {t('inbox.hospital')}: <strong>{customer?.hospitals?.name || '-'}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>
                {t('inbox.department')}: <strong>{customer?.departments?.name || '-'}</strong>
              </p>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-main)' }}>
                {t('inbox.position')}: <strong>{customer?.positions?.name || '-'}</strong>
              </p>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layout size={16} color="var(--primary)" />
        <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{t('inbox.ticketInfo')}</h3>
      </div>

      <div className="glass" style={{ padding: '20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
        {currentTicket ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>{t('inbox.ticketId')}</p>
                <p style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>#{currentTicket.ticket_no}</p>
              </div>
              <span style={{ fontSize: '10px', padding: '4px 10px', borderRadius: '6px', background: currentTicket.status === 'Resolved' ? 'var(--success)' : 'var(--primary)', color: 'black', fontWeight: '800' }}>
                {currentTicket.status}
              </span>
            </div>
            <div>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '800', marginBottom: '4px' }}>{t('inbox.subject')}</p>
              <p style={{ fontSize: '14px', fontWeight: '600', lineHeight: '1.4' }}>{currentTicket.subject}</p>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '30px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px' }}>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '600' }}>{t('inbox.noTicketInChat')}</p>
          </div>
        )}
      </div>

      {currentTicket && isResolved && (
        <button
          onClick={onCopySurvey}
          className="glass-interactive"
          style={{
            width: '100%',
            height: '44px',
            borderRadius: '12px',
            border: '1px solid var(--primary)',
            background: 'rgba(14,165,233,0.08)',
            color: 'var(--primary)',
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          {t('inbox.sendSurvey')}
        </button>
      )}

      {currentTicket && !isResolved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: '900', marginBottom: '4px', textTransform: 'uppercase' }}>{t('inbox.ticketHandoff')}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              onClick={() => setShowEscalateModal(true)}
              disabled={isProcessing || (isEscalatedOrPending && !!activeMagicLink)}
              className="glass-interactive"
              style={{ flex: '1 1 120px', height: '50px', borderRadius: '16px', border: '1px solid #8b5cf6', background: currentTicket.status === 'Escalated' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.08)', color: '#8b5cf6', fontWeight: '900', fontSize: '12px', cursor: (isProcessing || (isEscalatedOrPending && !!activeMagicLink)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(139, 92, 246, 0.15)', opacity: (isProcessing || (isEscalatedOrPending && !!activeMagicLink)) ? 0.6 : 1 }}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><AlertTriangle size={16} /> {t('inbox.escalate')}</>}
            </button>

            <button
              onClick={() => setShowPendingConfirm(true)}
              disabled={isProcessing || (isEscalatedOrPending && !!activeMagicLink)}
              className="glass-interactive"
              style={{ flex: '1 1 120px', height: '50px', borderRadius: '16px', border: '1px solid #ef4444', background: currentTicket.status === 'Pending' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: '900', fontSize: '12px', cursor: (isProcessing || (isEscalatedOrPending && !!activeMagicLink)) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 15px rgba(239, 68, 68, 0.15)', opacity: (isProcessing || (isEscalatedOrPending && !!activeMagicLink)) ? 0.6 : 1 }}
            >
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <><Hourglass size={16} /> {t('inbox.pending')}</>}
            </button>
          </div>

          {activeMagicLink && (
            <div className="animate-fade-in" style={{ marginTop: '12px', padding: '16px', background: 'var(--bg-input)', borderRadius: '16px', border: '1px dashed var(--primary)' }}>
              <p style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '900', marginBottom: '8px', textTransform: 'uppercase' }}>{t('inbox.magicLinkReady')}</p>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input readOnly value={activeMagicLink} style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '11px', outline: 'none' }} />
                <button onClick={() => handleCopyLink(activeMagicLink)} style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer' }}>
                  {copied ? <CheckCircle2 size={14} color="#000" /> : <Copy size={14} color="#000" />}
                </button>
              </div>
              <p style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                <Info size={10} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                {t('inbox.pinCode')}: 1234
              </p>
            </div>
          )}
        </div>
      )}

      <button onClick={onFetchGlobalHistory} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', cursor: 'pointer', justifyContent: 'center' }}>
        <History size={14} /> <u>{t('inbox.viewFullHistory')}</u>
      </button>

      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {isSessionActive && (
          <button onClick={onCloseSession} className="glass-interactive" style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #06b6d4', background: 'rgba(6, 182, 212, 0.1)', color: '#06b6d4', fontWeight: '800', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <X size={18} /> {t('inbox.endChat')}
          </button>
        )}

        {currentTicket && !isResolved && (isOwner || isAdmin) && (
          <button
            onClick={() => {
              if (isSessionActive) {
                onWarn(t('inbox.resolveWarningTitle'), t('inbox.resolveWarningBody'));
                return;
              }
              onResolve();
            }}
            className={isSessionActive ? '' : 'glass-interactive'}
            style={{ width: '100%', padding: '16px', borderRadius: '16px', border: 'none', background: isSessionActive ? 'rgba(255,255,255,0.05)' : '#22c55e', color: isSessionActive ? 'var(--text-muted)' : 'white', fontWeight: '900', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', boxShadow: isSessionActive ? 'none' : '0 8px 24px rgba(34, 197, 94, 0.3)', opacity: isSessionActive ? 0.7 : 1 }}
          >
            <CheckCircle size={18} /> {t('inbox.resolveTicket')}
          </button>
        )}
      </div>

      {showEscalateModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass animate-in zoom-in" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <AlertCircle color="var(--danger)" /> {t('inbox.escalateTitle')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>{t('inbox.escalateSubtitle')}</p>
            <textarea value={escalationNote} onChange={(e) => setEscalationNote(e.target.value)} placeholder={t('inbox.escalatePlaceholder')} style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '14px', marginBottom: '20px', outline: 'none', resize: 'none' }} />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowEscalateModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>{t('common.cancel')}</button>
              <button
                disabled={!escalationNote.trim() || isProcessing}
                onClick={async () => {
                  if (!currentTicket?.id) return;
                  setIsProcessing(true);
                  try {
                    const randomToken = `E-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                    await ticketService.updateStatus(currentTicket.id, 'Escalated', undefined, `[ESCALATION INSTRUCTIONS]: ${escalationNote}`, randomToken);
                    const link = `${window.location.origin}/escalate/${randomToken}`;
                    setMagicLink(link);
                    handleCopyLink(link);
                    setShowEscalateModal(false);
                    setEscalationNote('');
                  } catch (err: unknown) {
                    onWarn(t('common.messages.error'), err instanceof Error ? err.message : 'Unknown error');
                  } finally {
                    setIsProcessing(false);
                  }
                }}
                style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: 'var(--secondary)', color: 'white', fontWeight: '800', cursor: 'pointer', opacity: (!escalationNote.trim() || isProcessing) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : t('inbox.confirmEscalate')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPendingConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass animate-in zoom-in" style={{ width: '100%', maxWidth: '420px', background: 'var(--bg-card)', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px', color: 'var(--text-main)' }}>{t('inbox.confirmPendingTitle')}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
              {t('inbox.confirmPendingBody')}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowPendingConfirm(false)} style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>
                {t('common.cancel')}
              </button>
              <button onClick={handlePendingConfirm} style={{ padding: '10px 14px', borderRadius: '12px', border: 'none', background: '#ef4444', color: '#fff', fontWeight: '800', cursor: 'pointer' }}>
                {t('inbox.confirmPendingButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
