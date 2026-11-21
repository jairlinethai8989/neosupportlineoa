'use client';

import React, { useEffect, useState } from 'react';
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
  User,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, Button, EmptyState, Modal, Select, Skeleton, Textarea } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { translateTicketPriority } from '@/lib/i18n/staff';
import { ticketService } from '@/lib/services/ticketService';
import { supabase } from '@/lib/supabase';
import type { InboxAgent, InboxConversation, InboxTicket, InboxViewMode } from '@/types/inbox';
import styles from './inbox.module.css';

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

function getSlaProgress(slaDueAt?: string | null, createdAt?: string | null) {
  if (!slaDueAt) return null;
  const dueMs = new Date(slaDueAt).getTime();
  if (Number.isNaN(dueMs)) return null;

  const nowMs = Date.now();
  const remainingMins = Math.round((dueMs - nowMs) / 60000);
  const startMs = createdAt ? new Date(createdAt).getTime() : dueMs - 4 * 60 * 60 * 1000;
  const totalMs = Math.max(dueMs - startMs, 60000);
  const elapsedPct = Math.min(100, Math.max(4, Math.round(((nowMs - startMs) / totalMs) * 100)));

  const tone: 'danger' | 'warning' | 'success' =
    remainingMins < 0 ? 'danger' : remainingMins <= 60 ? 'warning' : 'success';

  return { remainingMins, elapsedPct, tone };
}

export const TicketSidebar: React.FC<TicketSidebarProps> = React.memo(function TicketSidebar({
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
}: TicketSidebarProps) {
  const { locale, t } = useStaffLocale();
  void onTransfer;

  const statusLower = currentTicket?.status?.toLowerCase();
  const isResolved =
    statusLower === 'resolved' ||
    statusLower === 'closed' ||
    statusLower === 'fix completed';
  const isOwner = currentTicket?.assigned_agent_id === agent?.id;
  const isAdmin = agent?.role === 'Administrator';
  const isSessionActive =
    !isResolved && !!(selectedChat.status === 'active' || selectedChat.is_active);
  const isEscalatedOrPending =
    currentTicket?.status === 'Escalated' || currentTicket?.status === 'Pending';

  const [copied, setCopied] = useState(false);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showEscalateModal, setShowEscalateModal] = useState(false);
  const [showPendingConfirm, setShowPendingConfirm] = useState(false);
  const [escalationNote, setEscalationNote] = useState('');
  const [expiryHours, setExpiryHours] = useState(72);
  const [activeHandoff, setActiveHandoff] = useState<{
    secure_pin: string;
    token: string;
    expires_at: string;
  } | null>(null);

  useEffect(() => {
    const shouldCheckHandoff = Boolean(
      currentTicket?.id &&
        (currentTicket.escalation_token ||
          statusLower === 'escalated' ||
          statusLower === 'pending')
    );
    if (!shouldCheckHandoff || !currentTicket?.id) {
      setActiveHandoff(null);
      return;
    }

    let cancelled = false;
    const fetchInspectorMeta = async () => {
      const { data: handoffData } = await supabase
        .from('ticket_handoffs')
        .select('secure_pin, token, expires_at')
        .eq('ticket_id', currentTicket.id)
        .in('status', ['Active', 'Claimed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      setActiveHandoff(handoffData || null);
    };

    void fetchInspectorMeta();
    return () => {
      cancelled = true;
    };
  }, [currentTicket?.id, currentTicket?.escalation_token, statusLower]);

  const customer = selectedChat.customers;
  const hasCustomerIdentity = Boolean(
    customer?.display_name || customer?.avatar_url || customer?.line_user_id
  );
  const hasCustomerProfileMeta = Boolean(
    customer?.organizations?.name || customer?.departments?.name || customer?.positions?.name
  );
  const shouldShowCustomerMetaSkeleton = !hasCustomerIdentity && !hasCustomerProfileMeta;

  const activeMagicLink =
    magicLink ||
    (activeHandoff?.token ? `${window.location.origin}/escalate/${activeHandoff.token}` : null);

  const slaInfo = getSlaProgress(currentTicket?.sla_due_at, currentTicket?.created_at);

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
      const result = await ticketService.updateStatus(
        currentTicket.id,
        'Pending',
        undefined,
        undefined,
        randomToken,
        expiryHours
      );
      if (result && 'escalation_token' in result) {
        const genToken = result.escalation_token as string;
        const genPin = (result as { escalation_pin?: string }).escalation_pin as string;
        setMagicLink(`${window.location.origin}/escalate/${genToken}`);
        setActiveHandoff({
          token: genToken,
          secure_pin: genPin,
          expires_at: new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString(),
        });
      } else {
        setMagicLink(`${window.location.origin}/escalate/${randomToken}`);
      }
    } catch (err: unknown) {
      onWarn(t('common.messages.error'), err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsProcessing(false);
    }
  };

  const priorityLower = String(currentTicket?.priority || '').toLowerCase();
  const priorityVariant =
    priorityLower === 'critical' || priorityLower === 'วิกฤต'
      ? 'danger'
      : priorityLower === 'high' || priorityLower === 'สูง'
        ? 'warning'
        : priorityLower === 'medium' || priorityLower === 'ปกติ'
          ? 'info'
          : 'neutral';

  return (
    <aside
      aria-label={t('inbox.ticketInfo')}
      className={clsx(styles.inspectorPane, viewMode !== 'details' && styles.hiddenMobile)}
    >
      <div className={styles.inspectorHeader}>
        <h3 className={styles.inspectorSectionTitle}>
          <User size={14} aria-hidden="true" />
          <span>{t('inbox.customerInfo')}</span>
        </h3>
        <Button
          size="sm"
          variant="ghost"
          iconOnly
          onClick={() => setViewMode('chat')}
          aria-label={locale === 'th' ? 'กลับไปหน้าแชท' : 'Back to chat'}
          className={styles.mobileOnly}
        >
          <X size={16} aria-hidden="true" />
        </Button>
      </div>

      <div className={styles.hairlineCard}>
        {shouldShowCustomerMetaSkeleton ? (
          <div style={{ display: 'grid', gap: '10px' }}>
            <Skeleton width="100%" height={56} borderRadius={8} />
            <Skeleton width="80%" height={14} borderRadius={6} />
            <Skeleton width="65%" height={14} borderRadius={6} />
          </div>
        ) : (
          <>
            <div className={styles.customerProfileRow}>
              {customer?.avatar_url ? (
                <Image
                  src={customer.avatar_url}
                  alt={customer?.display_name || 'LINE customer'}
                  width={48}
                  height={48}
                  className={styles.customerAvatar}
                />
              ) : (
                <div className={styles.customerAvatar} aria-hidden="true">
                  <User size={22} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p className={styles.customerName}>
                  {customer?.display_name || t('inbox.lineUser')}
                </p>
                {customer?.line_user_id && (
                  <code className={clsx(styles.lineIdChip, 'mono')}>
                    {customer.line_user_id.substring(0, 14)}...
                  </code>
                )}
              </div>
            </div>

            <div className={styles.kvList}>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{t('inbox.organization')}</span>
                <span className={styles.kvValue}>
                  {selectedChat.ticket_data?.organizations?.name || '-'}
                </span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{t('inbox.department')}</span>
                <span className={styles.kvValue}>{customer?.departments?.name || '-'}</span>
              </div>
              <div className={styles.kvRow}>
                <span className={styles.kvLabel}>{t('inbox.position')}</span>
                <span className={styles.kvValue}>{customer?.positions?.name || '-'}</span>
              </div>
            </div>
          </>
        )}
      </div>

      <h3 className={styles.inspectorSectionTitle}>
        <Layout size={14} aria-hidden="true" />
        <span>{t('inbox.ticketInfo')}</span>
      </h3>

      <div className={styles.hairlineCard}>
        {currentTicket ? (
          <>
            <div className={styles.kvRow} style={{ alignItems: 'center' }}>
              <span className={clsx(styles.ticketIdLarge, 'mono tabular-nums')}>
                #{currentTicket.ticket_no}
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {currentTicket?.priority && (
                  <Badge size="sm" variant={priorityVariant}>
                    {translateTicketPriority(currentTicket.priority, locale)}
                  </Badge>
                )}
                <Badge size="sm" variant={isResolved ? 'success' : 'primary'}>
                  {currentTicket.status}
                </Badge>
              </div>
            </div>

            <p className={styles.ticketSubject}>{currentTicket.subject}</p>

            {slaInfo && !isResolved && (
              <div className={styles.slaBlock}>
                <div className={styles.slaHeader}>
                  <span style={{ color: 'var(--color-text-muted)' }}>SLA</span>
                  <span
                    className="tabular-nums"
                    style={{
                      color:
                        slaInfo.tone === 'danger'
                          ? 'var(--color-danger-text)'
                          : slaInfo.tone === 'warning'
                            ? 'var(--color-warning-text)'
                            : 'var(--color-success-text)',
                    }}
                  >
                    {slaInfo.remainingMins < 0
                      ? `${locale === 'th' ? 'เกิน' : 'Over'} ${Math.abs(slaInfo.remainingMins)}m`
                      : `${slaInfo.remainingMins}m ${locale === 'th' ? 'เหลือ' : 'left'}`}
                  </span>
                </div>
                <div
                  className={styles.slaTrack}
                  role="progressbar"
                  aria-valuenow={slaInfo.elapsedPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="SLA progress"
                >
                  <div
                    className={styles.slaFill}
                    style={{
                      width: `${slaInfo.elapsedPct}%`,
                      background:
                        slaInfo.tone === 'danger'
                          ? 'var(--color-danger)'
                          : slaInfo.tone === 'warning'
                            ? 'var(--color-warning)'
                            : 'var(--color-success)',
                    }}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <EmptyState compact title={t('inbox.noTicketInChat')} />
        )}
      </div>

      {currentTicket && isResolved && (
        <Button variant="secondary" fullWidth onClick={onCopySurvey}>
          {t('inbox.sendSurvey')}
        </Button>
      )}

      {currentTicket && !isResolved && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <h3 className={styles.inspectorSectionTitle}>{t('inbox.ticketHandoff')}</h3>
          <div className={styles.handoffGrid}>
            <Button
              size="sm"
              variant="secondary"
              loading={isProcessing}
              disabled={isProcessing || (isEscalatedOrPending && !!activeMagicLink)}
              onClick={() => setShowEscalateModal(true)}
              leftIcon={<AlertTriangle size={14} aria-hidden="true" />}
            >
              {t('inbox.escalate')}
            </Button>

            <Button
              size="sm"
              variant="warning"
              loading={isProcessing}
              disabled={isProcessing || (isEscalatedOrPending && !!activeMagicLink)}
              onClick={() => setShowPendingConfirm(true)}
              leftIcon={<Hourglass size={14} aria-hidden="true" />}
            >
              {t('inbox.pending')}
            </Button>
          </div>

          {activeMagicLink && (
            <div className={styles.magicLinkBox}>
              <span className={styles.magicLinkLabel}>{t('inbox.magicLinkReady')}</span>
              <div className={styles.magicLinkInputRow}>
                <input
                  readOnly
                  value={activeMagicLink}
                  aria-label={t('inbox.magicLinkReady')}
                  className={clsx(styles.magicLinkInput, 'mono')}
                />
                <Button
                  size="sm"
                  variant="primary"
                  iconOnly
                  onClick={() => handleCopyLink(activeMagicLink)}
                  aria-label={locale === 'th' ? 'คัดลอกลิงก์ส่งงาน' : 'Copy magic link'}
                >
                  {copied ? (
                    <CheckCircle2 size={14} aria-hidden="true" />
                  ) : (
                    <Copy size={14} aria-hidden="true" />
                  )}
                </Button>
              </div>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--color-text-muted)' }}>
                <Info size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} aria-hidden="true" />
                {t('inbox.pinCode')}:{' '}
                <strong className="mono tabular-nums">{activeHandoff?.secure_pin || '1234'}</strong>
              </p>
            </div>
          )}
        </div>
      )}

      <Button
        size="sm"
        variant="ghost"
        fullWidth
        onClick={onFetchGlobalHistory}
        leftIcon={<History size={14} aria-hidden="true" />}
      >
        {t('inbox.viewFullHistory')}
      </Button>

      <div className={styles.inspectorFooter}>
        {isSessionActive && (
          <Button
            variant="secondary"
            fullWidth
            onClick={onCloseSession}
            leftIcon={<X size={16} aria-hidden="true" />}
          >
            {t('inbox.endChat')}
          </Button>
        )}

        {currentTicket && !isResolved && (isOwner || isAdmin) && (
          <Button
            variant={isSessionActive ? 'secondary' : 'primary'}
            fullWidth
            onClick={() => {
              if (isSessionActive) {
                onWarn(t('inbox.resolveWarningTitle'), t('inbox.resolveWarningBody'));
                return;
              }
              onResolve();
            }}
            leftIcon={<CheckCircle size={16} aria-hidden="true" />}
          >
            {t('inbox.resolveTicket')}
          </Button>
        )}
      </div>

      {/* Escalate Modal */}
      <Modal
        isOpen={showEscalateModal}
        onClose={() => setShowEscalateModal(false)}
        size="sm"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={18} color="var(--color-danger)" aria-hidden="true" />
            {t('inbox.escalateTitle')}
          </span>
        }
        description={t('inbox.escalateSubtitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowEscalateModal(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              loading={isProcessing}
              disabled={!escalationNote.trim() || isProcessing}
              onClick={async () => {
                if (!currentTicket?.id) return;
                setIsProcessing(true);
                try {
                  const randomToken = `E-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
                  const result = await ticketService.updateStatus(
                    currentTicket.id,
                    'Escalated',
                    undefined,
                    `[ESCALATION INSTRUCTIONS]: ${escalationNote}`,
                    randomToken,
                    expiryHours
                  );
                  if (result && 'escalation_token' in result) {
                    const genToken = result.escalation_token as string;
                    const genPin = (result as { escalation_pin?: string }).escalation_pin as string;
                    setMagicLink(`${window.location.origin}/escalate/${genToken}`);
                    setActiveHandoff({
                      token: genToken,
                      secure_pin: genPin,
                      expires_at: new Date(
                        Date.now() + expiryHours * 60 * 60 * 1000
                      ).toISOString(),
                    });
                  } else {
                    const link = `${window.location.origin}/escalate/${randomToken}`;
                    setMagicLink(link);
                    handleCopyLink(link);
                  }
                  setShowEscalateModal(false);
                  setEscalationNote('');
                } catch (err: unknown) {
                  onWarn(
                    t('common.messages.error'),
                    err instanceof Error ? err.message : 'Unknown error'
                  );
                } finally {
                  setIsProcessing(false);
                }
              }}
            >
              {t('inbox.confirmEscalate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Textarea
            label={t('inbox.escalateTitle')}
            required
            rows={4}
            value={escalationNote}
            onChange={(e) => setEscalationNote(e.target.value)}
            placeholder={t('inbox.escalatePlaceholder')}
          />
          <Select
            label={locale === 'th' ? 'กำหนดอายุลิงก์ส่งงาน (Link Expiry)' : 'Link Expiry'}
            value={expiryHours}
            onChange={(e) => setExpiryHours(Number(e.target.value))}
          >
            <option value={24}>{locale === 'th' ? '24 ชั่วโมง (1 วัน)' : '24 hours (1 day)'}</option>
            <option value={72}>{locale === 'th' ? '72 ชั่วโมง (3 วัน)' : '72 hours (3 days)'}</option>
            <option value={168}>{locale === 'th' ? '168 ชั่วโมง (7 วัน)' : '168 hours (7 days)'}</option>
            <option value={720}>{locale === 'th' ? '720 ชั่วโมง (30 วัน)' : '720 hours (30 days)'}</option>
          </Select>
        </div>
      </Modal>

      {/* Pending Confirm Modal */}
      <Modal
        isOpen={showPendingConfirm}
        onClose={() => setShowPendingConfirm(false)}
        size="sm"
        title={t('inbox.confirmPendingTitle')}
        description={t('inbox.confirmPendingBody')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPendingConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" onClick={handlePendingConfirm}>
              {t('inbox.confirmPendingButton')}
            </Button>
          </>
        }
      >
        <Select
          label={locale === 'th' ? 'กำหนดอายุลิงก์ส่งงาน (Link Expiry)' : 'Link Expiry'}
          value={expiryHours}
          onChange={(e) => setExpiryHours(Number(e.target.value))}
        >
          <option value={24}>{locale === 'th' ? '24 ชั่วโมง (1 วัน)' : '24 hours (1 day)'}</option>
          <option value={72}>{locale === 'th' ? '72 ชั่วโมง (3 วัน)' : '72 hours (3 days)'}</option>
          <option value={168}>{locale === 'th' ? '168 ชั่วโมง (7 วัน)' : '168 hours (7 days)'}</option>
          <option value={720}>{locale === 'th' ? '720 ชั่วโมง (30 วัน)' : '720 hours (30 days)'}</option>
        </Select>
      </Modal>
    </aside>
  );
});
