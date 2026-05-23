'use client';

import React from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

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

  if (!open) return null;

  const isDisabled =
    sending || !resSummary.trim() || !selectedModule || !selectedIssueType;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.8)',
        padding: '20px',
      }}
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '480px',
          padding: '40px',
          borderRadius: '32px',
          border: '1px solid var(--border)',
          background: 'var(--bg-card)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.4)',
          animation: 'scaleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          maxHeight: '95vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(0, 255, 127, 0.1)',
              color: 'var(--success)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <CheckCircle size={28} />
          </div>
          <h3
            style={{
              fontSize: '22px',
              fontWeight: '900',
              color: 'var(--text-main)',
              marginBottom: '8px',
            }}
          >
            {t('inbox.resolveModal.title').replace('{ticketNo}', currentTicket?.ticket_no || '')}
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {t('inbox.resolveModal.subtitle')}
          </p>
        </div>

        {isChatActive && (
          <div 
            style={{ 
              marginBottom: '28px', 
              padding: '14px 20px', 
              background: 'var(--danger)', 
              borderRadius: '14px',
              color: 'white',
              fontSize: '14px',
              fontWeight: '900',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              boxShadow: '0 8px 16px rgba(239, 68, 68, 0.4)',
              animation: 'pulse 2s infinite',
              border: '2px solid rgba(255,255,255,0.2)'
            }}
          >
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span>ต้องกด &ldquo;จบการสนทนา&rdquo; ที่หน้าหลักก่อนถึงจะปิดใบงานได้</span>
          </div>
        )}

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--primary)',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '1px',
            }}
          >
            {t('inbox.resolveModal.module')} <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedModule}
              onChange={(event) => onChangeModule(event.target.value)}
              style={{
                width: '100%',
                padding: '12px 40px 12px 16px',
                borderRadius: '10px',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                border: '1px solid var(--border)',
                fontSize: '14px',
                fontWeight: '800',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage:
                  'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px',
              }}
            >
              <option value="">{t('inbox.resolveModal.selectModule')}</option>
              {availableModules.map((moduleName) => (
                <option key={moduleName} value={moduleName}>
                  {moduleName}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--primary)',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '1px',
            }}
          >
            {t('inbox.resolveModal.issueType')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <div style={{ position: 'relative' }}>
            <select
              value={selectedIssueType}
              onChange={(event) => onChangeIssueType(event.target.value)}
              style={{
                width: '100%',
                padding: '12px 40px 12px 16px',
                borderRadius: '10px',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-main)',
                fontSize: '14px',
                fontWeight: '700',
                outline: 'none',
                appearance: 'none',
                cursor: 'pointer',
                backgroundImage:
                  'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
                backgroundSize: '16px',
              }}
            >
              <option value="">{t('inbox.resolveModal.selectIssueType')}</option>
              {availableIssueTypes.map((issueType) => (
                <option key={issueType} value={issueType}>
                  {issueType}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <label
              style={{
                fontSize: '11px',
                fontWeight: '800',
                color: 'var(--primary)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {t('inbox.resolveModal.templates')}
            </label>
            <a
              href="/settings/profile"
              target="_blank"
              rel="noreferrer"
              style={{
                fontSize: '10px',
                color: 'var(--text-muted)',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              {t('inbox.resolveModal.manageTemplates')}
            </a>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {personalResTemplates.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => onChangeSummary(template)}
                className="glass-interactive"
                style={{
                  padding: '10px 18px',
                  borderRadius: '14px',
                  border: '1px solid rgba(0, 242, 254, 0.3)',
                  background: 'rgba(0, 242, 254, 0.05)',
                  fontSize: '13px',
                  fontWeight: '700',
                  color: 'var(--primary)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                {template.length > 25 ? template.slice(0, 25) + '...' : template}
              </button>
            ))}
            {personalResTemplates.length === 0 && (
              <div 
                style={{ 
                  width: '100%', 
                  padding: '24px', 
                  borderRadius: '16px', 
                  border: '1px dashed var(--border)', 
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {t('inbox.noTemplatesFound') || 'No resolution templates available.'}
                </p>
                <a
                  href="/settings/profile"
                  target="_blank"
                  rel="noreferrer"
                  style={{ 
                    fontSize: '12px', 
                    color: 'var(--primary)', 
                    fontWeight: '800', 
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <span>+</span> {t('inbox.setupTemplates') || 'Set up your templates here'}
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--primary)',
              textTransform: 'uppercase',
              marginBottom: '8px',
              letterSpacing: '1px',
            }}
          >
            {t('inbox.resolveModal.summary')} <span style={{ color: 'var(--danger)' }}>*</span>
          </label>
          <textarea
            value={resSummary}
            onChange={(event) => onChangeSummary(event.target.value)}
            placeholder={t('inbox.resolveModal.summaryPlaceholder')}
            style={{
              width: '100%',
              height: '100px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              padding: '12px',
              color: 'var(--text-main)',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              transition: 'all 0.3s',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'var(--bg-input)',
              color: 'var(--text-muted)',
              fontWeight: '800',
              cursor: 'pointer',
            }}
          >
            {t('inbox.resolveModal.cancel')}
          </button>
          <button
            onClick={onConfirm}
            disabled={isDisabled}
            style={{
              flex: 1.5,
              padding: '14px',
              borderRadius: '12px',
              border: 'none',
              background: isDisabled ? 'var(--border)' : 'var(--success)',
              color: isDisabled ? 'var(--text-muted)' : 'black',
              fontWeight: '900',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            {sending ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <CheckCircle size={18} /> {t('inbox.resolveModal.confirm')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
