'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button, Modal, Select, Textarea } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import styles from './inbox.module.css';

interface ResolveTicketModalTicket {
  ticket_no: string | null;
}

interface ResolveTicketModalProps {
  open: boolean;
  currentTicket: ResolveTicketModalTicket | null;
  availableModules: string[];
  availableIssueTypes: string[];
  personalResTemplates: string[];
  resSummary: string;
  selectedModule: string;
  selectedIssueType: string;
  sending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onChangeSummary: (value: string) => void;
  onChangeModule: (value: string) => void;
  onChangeIssueType: (value: string) => void;
  isChatActive?: boolean;
}

export function ResolveTicketModal({
  open,
  currentTicket,
  availableModules,
  availableIssueTypes,
  personalResTemplates,
  resSummary,
  selectedModule,
  selectedIssueType,
  sending,
  onClose,
  onConfirm,
  onChangeSummary,
  onChangeModule,
  onChangeIssueType,
  isChatActive = false,
}: ResolveTicketModalProps) {
  const { t } = useStaffLocale();
  void isChatActive;

  const isDisabled =
    sending || !resSummary.trim() || !selectedModule || !selectedIssueType;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="md"
      title={t('inbox.resolveModal.title').replace('{ticketNo}', currentTicket?.ticket_no || '')}
      description={t('inbox.resolveModal.subtitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            {t('inbox.resolveModal.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={onConfirm}
            disabled={isDisabled}
            loading={sending}
            leftIcon={<CheckCircle size={16} aria-hidden="true" />}
          >
            {t('inbox.resolveModal.confirm')}
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <Select
          label={t('inbox.resolveModal.module')}
          required
          value={selectedModule}
          onChange={(event) => onChangeModule(event.target.value)}
        >
          <option value="">{t('inbox.resolveModal.selectModule')}</option>
          {availableModules.map((moduleName) => (
            <option key={moduleName} value={moduleName}>
              {moduleName}
            </option>
          ))}
        </Select>

        <Select
          label={t('inbox.resolveModal.issueType')}
          required
          value={selectedIssueType}
          onChange={(event) => onChangeIssueType(event.target.value)}
        >
          <option value="">{t('inbox.resolveModal.selectIssueType')}</option>
          {availableIssueTypes.map((issueType) => (
            <option key={issueType} value={issueType}>
              {issueType}
            </option>
          ))}
        </Select>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--color-text)',
              }}
            >
              {t('inbox.resolveModal.templates')}
            </span>
            <a
              href="/settings/profile"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--color-primary)',
                textDecoration: 'underline',
              }}
            >
              {t('inbox.resolveModal.manageTemplates')}
            </a>
          </div>

          {personalResTemplates.length > 0 ? (
            <div className={styles.templateGrid}>
              {personalResTemplates.map((template) => (
                <button
                  key={template}
                  type="button"
                  onClick={() => onChangeSummary(template)}
                  className={styles.templateChip}
                >
                  {template.length > 32 ? `${template.slice(0, 32)}...` : template}
                </button>
              ))}
            </div>
          ) : (
            <div className={styles.templateEmpty}>
              <p style={{ margin: '0 0 6px' }}>{t('inbox.noTemplatesFound')}</p>
              <a
                href="/settings/profile"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--color-primary)', fontWeight: 600 }}
              >
                + {t('inbox.setupTemplates')}
              </a>
            </div>
          )}
        </div>

        <Textarea
          label={t('inbox.resolveModal.summary')}
          required
          rows={4}
          value={resSummary}
          onChange={(event) => onChangeSummary(event.target.value)}
          placeholder={t('inbox.resolveModal.summaryPlaceholder')}
        />
      </div>
    </Modal>
  );
}
