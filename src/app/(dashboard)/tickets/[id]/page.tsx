/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import dynamic from 'next/dynamic';
const ImageEditorModal = dynamic(() => import('@/components/modals/ImageEditorModal'));
const ImageViewerModal = dynamic(() => import('@/components/modals/ImageViewerModal'));
const SummaryExportModal = dynamic(() => import('@/components/modals/SummaryExportModal'));
const ResolveTicketModal = dynamic(() => import('@/components/inbox/ResolveTicketModal').then(mod => mod.ResolveTicketModal));
import { ticketService } from '@/lib/services/ticketService';
import { TicketHeader } from '@/components/tickets/TicketHeader';
import { TicketChat } from '@/components/tickets/TicketChat';
import { TicketSidebar, getTicketDuration } from '@/components/tickets/TicketSidebar';
import Link from 'next/link';
import Image from 'next/image';
import { AlertTriangle, ChevronRight, ClipboardCheck, Clock, ExternalLink, FileText, Paperclip, User } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, Button, Card, CardBody, Modal, Textarea } from '@/components/ui';
import styles from '../tickets-workspace.module.css';
import { deleteMessageAction, closeConversationAction } from '@/app/actions/messageActions';
import { compressImage } from '@/lib/utils/imageCompression';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useAppContext } from '@/contexts/AppContext';
import {
  getTicketDetailActionFailedToast,
  getTicketDetailChatMustEndToast,
  confirmTicketDetailDeleteMessage,
  confirmTicketDetailEndChat,
  getTicketDetailResolvedToast,
  getTicketDetailSystemResolveMessage,
  getTicketDetailValidationToast,
} from '@/lib/tickets/detailFeedback';
import {
  appendMessageIfMissing,
  isMessageRelatedToThread,
  removeMessageById,
  replaceMessageById,
  ticketDetailMessageSelect,
} from '@/lib/tickets/detailRealtime';
import { isActiveConversationStatus } from '@/lib/tickets/detailState';
import type {
  TicketDetailLog,
  TicketDetailMessage,
  TicketDetailTicket,
  TicketDetailUser,
} from '@/types/tickets';

const DEFAULT_MODULES = [
  'Doctor Office',
  'Nurse Station',
  'Inpatient Pharmacy',
  'Medical Records',
  'Operating Room',
  'Anesthesia',
  'Consultation',
  'All',
];

const loadingContainerStyle: React.CSSProperties = { height: '70vh' };
const ticketDetailSelect = `
  id,
  ticket_no,
  customer_id,
  status,
  subject,
  description,
  priority,
  module,
  issue_type,
  created_at,
  resolved_at,
  assigned_agent_id,
  current_department_id,
  organization_id,
  escalation_token,
  resolution_summary,
  ai_analysis,
  customers:customers!tickets_customer_id_fkey (
    id,
    display_name,
    full_name,
    line_username,
    organizations:organizations(id, name)
  ),
  assigned_agent:profiles!assigned_agent_id (
    id,
    display_name:full_name
  ),
  department_data:departments!current_department_id(id, name)
`;
const ticketDetailLogSelect = 'id, created_at, action_type, to_status, note, performer_id';

type PdfDeps = {
  html2canvas: (typeof import('html2canvas'))['default'];
  jsPDF: (typeof import('jspdf'))['jsPDF'];
};

let pdfDepsPromise: Promise<PdfDeps> | null = null;

function loadPdfDeps(): Promise<PdfDeps> {
  if (!pdfDepsPromise) {
    pdfDepsPromise = Promise.all([import('html2canvas'), import('jspdf')]).then(
      ([html2canvasModule, jsPdfModule]) => ({
        html2canvas: html2canvasModule.default,
        jsPDF: jsPdfModule.jsPDF,
      })
    );
  }
  return pdfDepsPromise;
}

function normalizeRouteId(rawId: string | string[] | undefined): string | null {
  if (!rawId) return null;
  return Array.isArray(rawId) ? rawId[0] : rawId;
}

interface ExternalReport {
  receiverName: string;
  timestamp: string;
  status: string;
  details: string;
  attachments: string[];
}

function parseLatestExternalReport(summary: string | null | undefined): ExternalReport | null {
  if (!summary) return null;

  const marker = '[External Report by ';
  const index = summary.lastIndexOf(marker);
  if (index === -1) return null;

  const reportBlock = summary.substring(index);
  const lines = reportBlock.split('\n');
  if (lines.length === 0) return null;

  const headerLine = lines[0];
  const endBracketIndex = headerLine.indexOf(']');
  if (endBracketIndex === -1) return null;

  const receiverName = headerLine.substring(marker.length, endBracketIndex).trim();

  let timestamp = '';
  const dashIndex = headerLine.indexOf(' - ', endBracketIndex);
  if (dashIndex !== -1) {
    timestamp = headerLine.substring(dashIndex + 3).trim();
  }

  let status = 'In Progress';
  const detailsLines: string[] = [];
  let attachments: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Status:')) {
      status = line.substring(7).trim();
    } else if (line.startsWith('Attachments:')) {
      const urlsText = line.substring(12).trim();
      attachments = urlsText.split(',').map((u) => u.trim()).filter(Boolean);
    } else if (line.startsWith('Details:')) {
      detailsLines.push(line.substring(8).trim());
    } else {
      detailsLines.push(line);
    }
  }

  return {
    receiverName,
    timestamp,
    status,
    details: detailsLines.join('\n').trim(),
    attachments,
  };
}

export default function StaffTicketDetailPage() {
  const params = useParams();
  const ticketId = normalizeRouteId(params.id);
  const { addToast } = useNotificationContext();
  const {
    authUserId,
    userProfile: appProfile,
    companySettings: appSettings,
    departments: appDepartments,
    ensureDepartments,
  } = useAppContext();
  const adminFileRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const staticMetaLoadedRef = useRef(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<TicketDetailTicket | null>(null);
  const [user, setUser] = useState<TicketDetailUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [logs, setLogs] = useState<TicketDetailLog[]>([]);
  const [messages, setMessages] = useState<TicketDetailMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatActive, setIsChatActive] = useState(false);
  const [resolverProfile, setResolverProfile] = useState<{
    full_name?: string | null;
    signature_url?: string | null;
  } | null>(null);

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<Array<{ label: string; value: string }>>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [resSummary, setResSummary] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCardExpanded, setAiCardExpanded] = useState(true);

  const handleGenerateAISummary = async () => {
    if (!ticketId) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/ai-summary`, { method: 'POST' });
      if (!res.ok) throw new Error('API Error');
      const data = await res.json();
      setTicket(prev => prev ? { ...prev, ai_analysis: data } as any : prev);
      addToast({ id: 'ai-ok', type: 'ticket', title: 'วิเคราะห์ AI สำเร็จ', body: 'บันทึกบทสรุปเรียบร้อยแล้ว' });
    } catch (err) {
      addToast({ id: 'ai-err', type: 'sla', title: 'การวิเคราะห์ล้มเหลว', body: 'โปรดลองอีกครั้ง' });
    } finally {
      setAiLoading(false);
    }
  };

  const renderAICard = () => {
    const currentStatus = (status || '').trim().toLowerCase();
    if (currentStatus !== 'resolved' && currentStatus !== 'closed') return null;
    const aiData = (ticket as any)?.ai_analysis;

    if (!aiData) return null;

    return (
      <Card style={{ borderColor: 'var(--color-success-border)', background: 'var(--color-success-soft)' }}>
        <CardBody>
          <button
            type="button"
            aria-expanded={aiCardExpanded}
            onClick={() => setAiCardExpanded(!aiCardExpanded)}
            className={styles.aiToggleBtn}
          >
            <span style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-primary)' }}>
              ✨ AI Post-Mortem Analysis
            </span>
            <Badge size="sm" variant="success">
              {aiCardExpanded ? 'ย่อข้อมูล ▲' : 'ขยายข้อมูล ▼'}
            </Badge>
          </button>

          {aiCardExpanded && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '14px',
                borderTop: '1px solid var(--color-success-border)',
                paddingTop: '14px',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-success-text)', fontSize: 'var(--text-xs)' }}>
                  ปัญหาที่แท้จริง (Root Cause):
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                  {aiData.rootCause}
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--color-info-text)', fontSize: 'var(--text-xs)' }}>
                  วิธีแก้ไขที่ใช้ (Resolution):
                </strong>
                <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', lineHeight: 1.5 }}>
                  {aiData.resolution}
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--color-warning-text)', fontSize: 'var(--text-xs)' }}>
                  ข้อเสนอแนะเพื่อป้องกัน (Preventive Recommendations):
                </strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                  {aiData.preventiveRecommendations?.map((r: string, i: number) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  const externalReport = parseLatestExternalReport(ticket?.resolution_summary);

  const renderWorkReportCard = () => {
    if (!externalReport) return null;

    const currentStatus = (status || '').trim().toLowerCase();
    const isFixCompleted = currentStatus === 'fix completed';
    const isResolved = currentStatus === 'resolved';

    const borderColor = isFixCompleted
      ? 'var(--color-success)'
      : isResolved
        ? 'var(--color-primary)'
        : 'var(--color-warning)';
    const statusBadgeVariant = isFixCompleted ? 'success' : isResolved ? 'primary' : 'warning';

    return (
      <Card style={{ borderLeft: `3px solid ${borderColor}` }}>
        <CardBody style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--color-border)',
              paddingBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ClipboardCheck size={18} color={borderColor} aria-hidden="true" />
              <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, margin: 0 }}>
                รายงานผลการดำเนินงาน
              </h3>
            </div>
            <Badge size="sm" variant={statusBadgeVariant}>
              {externalReport.status.toUpperCase()}
            </Badge>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              background: 'var(--color-surface-subtle)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div>
              <span className={styles.timerLabel} style={{ display: 'block', marginBottom: '2px' }}>
                ผู้บันทึกผลงาน
              </span>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {externalReport.receiverName}
              </span>
            </div>
            <div>
              <span className={styles.timerLabel} style={{ display: 'block', marginBottom: '2px' }}>
                เวลาส่งรายงาน
              </span>
              <span className="tabular-nums" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                {externalReport.timestamp ? `${externalReport.timestamp} UTC` : '-'}
              </span>
            </div>
          </div>

          <div>
            <span className={styles.timerLabel} style={{ display: 'block', marginBottom: '6px' }}>
              รายละเอียดการปฏิบัติงาน
            </span>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                lineHeight: 1.6,
                background: 'var(--color-surface-subtle)',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {externalReport.details || 'ไม่มีรายละเอียดการปฏิบัติงาน'}
            </div>
          </div>

          {externalReport.attachments.length > 0 && (
            <div>
              <span className={styles.timerLabel} style={{ display: 'block', marginBottom: '6px' }}>
                เอกสารแนบปฏิบัติงาน ({externalReport.attachments.length})
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {externalReport.attachments.map((url, idx) => {
                  const fileName = url.substring(url.lastIndexOf('/') + 1) || `attachment-${idx + 1}`;
                  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(url);
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.iconLinkBtn}
                      style={{
                        width: 'auto',
                        padding: '0 10px',
                        gap: '6px',
                        maxWidth: '240px',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 600,
                      }}
                    >
                      {isImage ? (
                        <FileText size={14} color="var(--color-primary)" aria-hidden="true" />
                      ) : (
                        <Paperclip size={14} color="var(--color-primary)" aria-hidden="true" />
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {fileName}
                      </span>
                      <ExternalLink size={12} color="var(--color-text-muted)" aria-hidden="true" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    );
  };

  // Sync static metadata (user, modules, issue types, templates, departments) from AppContext — avoids 6 redundant DB queries per ticket visit
  useEffect(() => {
    void ensureDepartments();
  }, [ensureDepartments]);

  useEffect(() => {
    if (appDepartments.length > 0) {
      const orgDepts = appDepartments.filter(
        (d) =>
          (d.dept_type === undefined || d.dept_type === 'organization') &&
          d.is_active !== false
      );
      setAvailableDepts(
        orgDepts.map((department) => ({
          label: String(department.name || ''),
          value: String(department.id || ''),
        }))
      );
    }
  }, [appDepartments]);

  useEffect(() => {
    if (appSettings) {
      setAvailableModules(
        appSettings.modules && appSettings.modules.length > 0
          ? appSettings.modules
          : DEFAULT_MODULES
      );
      setAvailableIssueTypes(
        appSettings.issue_types && appSettings.issue_types.length > 0
          ? appSettings.issue_types
          : []
      );
    }

    const companyTemplates = ((appSettings?.resolution_templates as unknown[]) || []).map((t) =>
      typeof t === 'string' ? t : String((t as Record<string, unknown>)?.content || t)
    );

    if (appProfile) {
      setUser({
        id: String(appProfile.id || authUserId || ''),
        display_name: (appProfile.display_name as string | null) || appProfile.full_name || null,
        role: appProfile.role || null,
      });
      setPersonalQuickReplies(appProfile.quick_replies || []);
      if (appProfile.resolution_templates && appProfile.resolution_templates.length > 0) {
        setPersonalResTemplates(appProfile.resolution_templates);
      } else if (companyTemplates.length > 0) {
        setPersonalResTemplates(companyTemplates);
      }
      staticMetaLoadedRef.current = true;
    } else if (authUserId) {
      setUser({ id: authUserId });
      if (companyTemplates.length > 0) {
        setPersonalResTemplates(companyTemplates);
      }
    }
  }, [appProfile, appSettings, authUserId]);

  const fetchStaticMeta = useCallback(async () => {
    if (staticMetaLoadedRef.current || appProfile || appSettings) return;
    await ensureDepartments();
  }, [appProfile, appSettings, ensureDepartments]);

  const resolveConversationForTicket = useCallback(async (customerId: string | null) => {
    if (!ticketId) return null;

    const { data: convByTicket } = await supabase
      .from('conversations')
      .select('id, status')
      .eq('current_ticket_id', ticketId)
      .maybeSingle();

    if (convByTicket && isActiveConversationStatus(convByTicket.status)) {
      return convByTicket.id;
    }

    if (!customerId) return null;

    const { data: convByCustomer } = await supabase
      .from('conversations')
      .select('id, status')
      .eq('customer_id', customerId)
      .eq('status', 'active')
      .maybeSingle();

    if (convByCustomer && isActiveConversationStatus(convByCustomer.status)) {
      return convByCustomer.id;
    }

    return null;
  }, [ticketId]);

  const fetchData = useCallback(async () => {
    if (!ticketId) return;

    try {
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .select(ticketDetailSelect)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (ticketData) {
        const normalizedTicket = ticketData as unknown as TicketDetailTicket;
        setTicket(normalizedTicket);
        setStatus(normalizedTicket.status || '');
        setPriority(normalizedTicket.priority || '');
        setSelectedDept(normalizedTicket.current_department_id || '');
        setSelectedModule(normalizedTicket.module || '');

        const [logResult, conversationIdResult] = await Promise.all([
          supabase
            .from('ticket_logs')
            .select(ticketDetailLogSelect)
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: false }),
          resolveConversationForTicket(normalizedTicket.customer_id),
        ]);

        if (logResult.data) {
          setLogs(logResult.data as TicketDetailLog[]);

          // Find resolver profile only when needed.
          const resolveLog = logResult.data.find((log) => log.action_type === 'resolve');
          if (resolveLog?.performer_id) {
            const { data: resolver } = await supabase
              .from('profiles')
              .select('full_name, signature_url')
              .eq('id', resolveLog.performer_id)
              .single();
            setResolverProfile(resolver || null);
          } else {
            setResolverProfile(null);
          }
        }

        setConversationId(conversationIdResult);
        conversationIdRef.current = conversationIdResult;
        setIsChatActive(Boolean(conversationIdResult));

        const messageQuery = conversationIdResult
          ? supabase
              .from('messages')
              .select(ticketDetailMessageSelect)
              .or(`ticket_id.eq.${ticketId},conversation_id.eq.${conversationIdResult}`)
          : supabase
              .from('messages')
              .select(ticketDetailMessageSelect)
              .eq('ticket_id', ticketId);

        const { data: messageData } = await messageQuery.order('created_at', { ascending: true });
        setMessages((messageData || []) as TicketDetailMessage[]);
      }

      await fetchStaticMeta();
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('update ticket', error));
    } finally {
      setLoading(false);
    }
  }, [addToast, fetchStaticMeta, resolveConversationForTicket, ticketId]);

  useEffect(() => {
    void fetchData();
    if (!ticketId) return;

    const ticketMessageChannel = supabase
      .channel(`staff-ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const message = payload.new as unknown as TicketDetailMessage;
          setMessages((prev) => appendMessageIfMissing(prev, message));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          const updatedMessage = payload.new as unknown as TicketDetailMessage;
          setMessages((prev) => replaceMessageById(prev, updatedMessage));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `ticket_id=eq.${ticketId}` },
        (payload) => {
          setMessages((prev) => removeMessageById(prev, String(payload.old.id || '')));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${ticketId}` },
        (payload) => {
          const updatedTicket = payload.new as unknown as Partial<TicketDetailTicket>;
          setTicket((prev) => (prev ? { ...prev, ...updatedTicket } : prev));
          if (typeof updatedTicket.status === 'string') {
            setStatus(updatedTicket.status);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ticketMessageChannel);
      conversationIdRef.current = null;
    };
  }, [fetchData, ticketId]);

  useEffect(() => {
    if (!ticketId || !conversationId) return;

    const conversationMessageChannel = supabase
      .channel(`staff-ticket-conversation-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as unknown as TicketDetailMessage;
          if (!isMessageRelatedToThread(message, ticketId, conversationIdRef.current)) return;
          setMessages((prev) => appendMessageIfMissing(prev, message));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const message = payload.new as unknown as TicketDetailMessage;
          if (!isMessageRelatedToThread(message, ticketId, conversationIdRef.current)) return;
          setMessages((prev) => replaceMessageById(prev, message));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => removeMessageById(prev, String(payload.old.id || '')));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationMessageChannel);
    };
  }, [conversationId, ticketId]);
  const openImageInEditor = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      setEditingImage(result);
      setShowEditor(true);
      setShowViewer(false);
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!ticketId) return;

      const imageItem = Array.from(event.clipboardData?.items || []).find((item) =>
        item.type.startsWith('image/')
      );

      if (!imageItem) return;

      const file = imageItem.getAsFile();
      if (!file) return;

      event.preventDefault();
      openImageInEditor(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [openImageInEditor, ticketId]);

  const updateTicketField = useCallback(
    async (field: 'status' | 'priority' | 'department' | 'module', value: string) => {
      if (!ticketId) return;

      const dbField = field === 'department' ? 'current_department_id' : field;

      try {
        if (field === 'status') {
          await ticketService.updateStatus(ticketId, value);
        } else {
          await supabase.from('tickets').update({ [dbField]: value }).eq('id', ticketId);
        }

        addToast({
          id: `update-${field}-${Date.now()}`,
          type: 'ticket',
          title: 'อัปเดตข้อมูลสำเร็จ',
          body: `เปลี่ยน ${field} เป็น ${value} เรียบร้อยแล้ว`
        });
      } catch (error) {
        addToast(getTicketDetailActionFailedToast('update ticket', error));
      }
    },
    [addToast, ticketId]
  );

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() || !ticketId) return;

    const content = newMessage;
    const optimisticMessage: TicketDetailMessage = {
      id: `temp-${Date.now()}`,
      content,
      sender_type: 'agent',
      staff_id: user?.id || null,
      ticket_id: ticketId,
      conversation_id: conversationId,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setSending(true);

    try {
      const { error } = await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          ticket_id: ticketId,
          sender_type: 'agent',
          staff_id: user?.id,
          message_type: 'text',
          content,
        },
      ]);
      if (error) throw error;
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== optimisticMessage.id));
      setNewMessage(content);
      addToast(getTicketDetailActionFailedToast('send message', error));
    } finally {
      setSending(false);
    }
  }, [addToast, conversationId, newMessage, ticketId, user?.id]);



  const handleAdminFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!ticketId || !event.target.files?.length) return;

    const file = event.target.files[0];
    setSending(true);
    try {
      let fileToUpload: File | Blob = file;
      let contentType = file.type;
      let ext = file.name.split('.').pop() || 'dat';

      if (contentType.startsWith('image/')) {
        try {
          const compressed = await compressImage(file, { quality: 1.0 });
          fileToUpload = compressed;
          contentType = 'image/webp';
          ext = 'webp';
        } catch (err) {
          console.error('Staff detail file compression failed:', err);
        }
      }

      const fileName = `admin_${ticketId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, fileToUpload, { contentType });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(fileName);

      await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          ticket_id: ticketId,
          sender_type: 'agent',
          staff_id: user?.id,
          message_type: contentType.startsWith('image/') ? 'image' : 'file',
          content: publicUrl,
        },
      ]);
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('upload file', error));
    } finally {
      setSending(false);
      if (adminFileRef.current) adminFileRef.current.value = '';
    }
  }, [addToast, conversationId, ticketId, user?.id]);



  const handleEditorSave = useCallback(async (blob: Blob) => {
    if (!ticketId || !conversationId) return;

    setSending(true);
    try {
      // 1. Convert Blob to File object
      let fileToUpload: File | Blob = new File([blob], `edited_${ticketId}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      let contentType = 'image/jpeg';
      let ext = 'jpg';

      // 2. Compress to WebP 100%
      try {
        const compressed = await compressImage(fileToUpload as File, { quality: 1.0 });
        fileToUpload = compressed;
        contentType = 'image/webp';
        ext = 'webp';
      } catch (err) {
        console.error('Staff detail editor compression failed:', err);
      }
      
      const fileName = `edited_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${ext}`;
      
      // 3. Upload the new File object
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, fileToUpload, {
        cacheControl: '3600',
        upsert: false,
        contentType
      });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('chat_media').getPublicUrl(fileName);

      // 3. Insert message only after confirmed upload
      const { error: messageError } = await supabase.from('messages').insert([
        {
          conversation_id: conversationId,
          ticket_id: ticketId,
          sender_type: 'agent',
          staff_id: user?.id,
          message_type: 'image',
          content: publicUrl,
        },
      ]);
      
      if (messageError) throw messageError;

      // 4. Close modal only after success
      setShowEditor(false);
      setEditingImage(null);
    } catch (error) {
      console.error('Editor save failed:', error);
      addToast(getTicketDetailActionFailedToast('save edited image', error));
    } finally {
      setSending(false);
    }
  }, [addToast, conversationId, ticketId, user?.id]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!confirmTicketDetailDeleteMessage()) return;
    try {
      await deleteMessageAction(messageId);
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('delete message', error));
    }
  }, [addToast]);

  const handleEndChat = useCallback(async () => {
    if (!conversationId) return;
    if (!confirmTicketDetailEndChat()) return;

    setUpdating(true);
    try {
      await closeConversationAction(conversationId);
      setIsChatActive(false);
      setConversationId(null);
      conversationIdRef.current = null;
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('end chat', error));
    } finally {
      setUpdating(false);
    }
  }, [addToast, conversationId]);

  const handleResolve = useCallback(async () => {
    if (!ticketId || !ticket || !user?.id) return;
    if (!resSummary.trim() || !selectedModule || !selectedIssueType) {
      addToast(getTicketDetailValidationToast());
      return;
    }

    setUpdating(true);
    try {
      const updatedTicket = await ticketService.resolve(ticketId, user.id, resSummary, selectedModule, selectedIssueType);
      const newStatus = updatedTicket?.status || 'Resolved';

      if (conversationId) {
        const surveyLink = `${window.location.origin}/survey/${ticketId}`;
        await supabase.from('messages').insert([
          {
            conversation_id: conversationId,
            ticket_id: ticketId,
            sender_type: 'system',
            staff_id: user.id,
            content: getTicketDetailSystemResolveMessage(resSummary, selectedModule, surveyLink),
          },
        ]);
      }
      addToast(getTicketDetailResolvedToast(ticket.ticket_no, newStatus === 'Fix Completed'));
      setShowResolveModal(false);
      setTicket((prev) => (prev ? { ...prev, ...updatedTicket } : prev));
      setStatus(newStatus);
      void fetchData();
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('resolve ticket', error));
    } finally {
      setUpdating(false);
    }
  }, [
    addToast,
    conversationId,
    fetchData,
    isChatActive,
    resSummary,
    selectedIssueType,
    selectedModule,
    ticket,
    ticketId,
    user?.id,
  ]);

  const handleRejectFixCompleted = useCallback(async (note: string) => {
    if (!ticketId || !ticket || !user?.id) return;

    setUpdating(true);
    try {
      const updatedTicket = await ticketService.reviewFixCompleted(ticketId, 'reject', note);
      const newStatus = updatedTicket?.status || 'In Progress';
      
      setTicket((prev) => (prev ? { ...prev, status: newStatus } : prev));
      setStatus(newStatus);
      addToast({
        id: `ticket-fix-rejected-${Date.now()}`,
        type: 'ticket',
        title: 'ส่งกลับแก้ไขแล้ว',
        body: `ใบงาน #${ticket.ticket_no || ticketId} ถูกส่งกลับไปยังสถานะ ${newStatus}`,
      });
      setShowRejectModal(false);
      setRejectNote('');
      await fetchData();
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('update ticket', error));
    } finally {
      setUpdating(false);
    }
  }, [addToast, fetchData, ticket, ticketId, user?.id]);

  const handleExportSummary = async () => {
    if (!ticket || !reportRef.current) {
      addToast({
        id: `pdf-invalid-${Date.now()}`,
        type: 'sla',
        title: 'ข้อมูลไม่พร้อมใช้งาน',
        body: 'ไม่สามารถดึงข้อมูลใบงานมาสร้างรายงานได้ในขณะนี้'
      });
      return;
    }

    setUpdating(true);
    try {
      addToast({
        id: `pdf-prep-${Date.now()}`,
        type: 'ticket',
        title: 'กำลังเตรียมไฟล์ PDF...',
        body: 'ระบบกำลังประมวลผลรายงาน'
      });

      const { html2canvas, jsPDF } = await loadPdfDeps();
      
      // Render the hidden template to canvas
      const canvas = await html2canvas(reportRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const fileName = `Service_Report_${ticket.ticket_no || ticket.id}.pdf`;
      pdf.save(fileName);
      
      addToast({
        id: `pdf-success-${Date.now()}`,
        type: 'ticket',
        title: 'ส่งออกใบงานสำเร็จ',
        body: `ดาวน์โหลดไฟล์รายงาน #${ticket.ticket_no} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('PDF Export Error:', error);
      addToast({
        id: `pdf-error-${Date.now()}`,
        type: 'sla',
        title: 'ไม่สามารถส่งออกใบงานได้',
        body: 'เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กรุณาลองใหม่อีกครั้ง'
      });
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintSummary = async () => {
    if (!ticket || !reportRef.current) return;

    setUpdating(true);
    try {
      const { html2canvas, jsPDF } = await loadPdfDeps();
      
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      const blobUrl = pdf.output('bloburl');
      const printWindow = window.open(blobUrl, '_blank');
      
      if (!printWindow) {
        addToast({
          id: `pdf-print-popup-${Date.now()}`,
          type: 'sla',
          title: 'ไม่สามารถเปิดหน้าต่างพิมพ์ได้',
          body: 'กรุณาอนุญาต pop-up แล้วลองใหม่อีกครั้ง'
        });
        return;
      }

      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    } catch (error) {
      console.error('PDF Print Error:', error);
      addToast({
        id: `pdf-print-error-${Date.now()}`,
        type: 'sla',
        title: 'ไม่สามารถพิมพ์รายงานได้',
        body: 'เกิดข้อผิดพลาดระหว่างเตรียมเอกสารสำหรับพิมพ์'
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={loadingContainerStyle}>
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex-center" style={loadingContainerStyle}>
        <h2>Ticket Not Found</h2>
      </div>
    );
  }

  return (
    <>
      <div className={styles.detailPage}>
        <TicketHeader
          ticket={ticket}
          status={status}
          user={user}
          updating={updating}
          isChatActive={isChatActive}
          onUpdate={() => {
            void fetchData();
          }}
          onResolveClick={() => {
            setShowResolveModal(true);
            setResSummary('');
          }}
          onRejectFixCompleted={() => {
            setShowRejectModal(true);
          }}
          onExportClick={() => setShowExportModal(true)}
          onAiSummaryClick={handleGenerateAISummary}
          aiLoading={aiLoading}
        />

        <Card>
          <CardBody compact>
            <div className={styles.summaryStrip}>
              <div className={styles.summaryCustomer}>
                <div className={styles.summaryAvatar} aria-hidden="true">
                  {ticket.customers?.avatar_url ? (
                    <Image
                      src={ticket.customers.avatar_url}
                      alt="avatar"
                      width={40}
                      height={40}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <User size={18} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4
                    style={{
                      margin: 0,
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ticket.customers?.display_name || 'Customer'}
                  </h4>
                  <Link
                    href={`/tickets?customerId=${ticket.customer_id}`}
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--color-primary)',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    View History <ChevronRight size={12} aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className={styles.summaryTimers}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--color-primary)" aria-hidden="true" />
                  <span className={styles.timerLabel}>Time Tracking</span>
                </div>

                <div className={styles.timerBlock}>
                  <span className={styles.timerLabel}>REPORTED</span>
                  <p className={clsx(styles.timerValue, 'tabular-nums')}>
                    {ticket.created_at
                      ? new Date(ticket.created_at).toLocaleString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </p>
                </div>

                {ticket.resolved_at ? (
                  <>
                    <div className={styles.timerBlock}>
                      <span className={styles.timerLabel}>RESOLVED</span>
                      <p className={clsx(styles.timerValue, 'tabular-nums')} style={{ color: 'var(--color-primary)' }}>
                        {new Date(ticket.resolved_at).toLocaleString('th-TH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <div className={styles.timerBlock} style={{ paddingLeft: '16px', borderLeft: '1px solid var(--color-border)' }}>
                      <span className={styles.timerLabel} style={{ color: 'var(--color-primary)' }}>DURATION</span>
                      <p className={clsx(styles.timerHighlight, 'tabular-nums')}>
                        {getTicketDuration(ticket.created_at || '', ticket.resolved_at)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className={styles.timerBlock} style={{ paddingLeft: '16px', borderLeft: '1px solid var(--color-border)' }}>
                    <span className={styles.timerLabel} style={{ color: 'var(--color-warning-text)' }}>PENDING</span>
                    <p className={clsx(styles.timerHighlight, 'tabular-nums')}>
                      {getTicketDuration(ticket.created_at || '')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <div className={styles.detailGrid}>
          <div className={styles.detailMainCol}>
            <TicketChat
              messages={messages}
              ticket={ticket}
              user={user}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              sending={sending}
              onSendMessage={handleSendMessage}
              onAttachFile={() => adminFileRef.current?.click()}
              onEditImage={(url) => {
                setViewingImage(url);
                setShowViewer(true);
              }}
              onDeleteMessage={handleDeleteMessage}
              onEndChat={handleEndChat}
              isChatActive={isChatActive}
              quickReplies={personalQuickReplies}
              isReadOnly={true}
            />
          </div>

          <div className={styles.detailSideCol}>
            {renderAICard()}
            {renderWorkReportCard()}
            <TicketSidebar
              ticket={ticket}
              user={user}
              status={status}
              setStatus={(value) => {
                setStatus(value);
                void updateTicketField('status', value);
              }}
              priority={priority}
              setPriority={(value) => {
                setPriority(value);
                void updateTicketField('priority', value);
              }}
              selectedDept={selectedDept}
              setSelectedDept={(value) => {
                setSelectedDept(value);
                void updateTicketField('department', value);
              }}
              selectedModule={selectedModule}
              setSelectedModule={(value) => {
                setSelectedModule(value);
                void updateTicketField('module', value);
              }}
              availableDepts={availableDepts}
              availableModules={availableModules}
              logs={logs}
              showActivity={true}
              showProfile={false}
            />
          </div>
        </div>
      </div>

      <ResolveTicketModal
        open={showResolveModal}
        currentTicket={ticket}
        availableModules={availableModules}
        availableIssueTypes={availableIssueTypes}
        personalResTemplates={personalResTemplates}
        resSummary={resSummary}
        selectedModule={selectedModule}
        selectedIssueType={selectedIssueType}
        sending={updating}
        onClose={() => setShowResolveModal(false)}
        onConfirm={handleResolve}
        onChangeSummary={setResSummary}
        onChangeModule={setSelectedModule}
        onChangeIssueType={setSelectedIssueType}
        isChatActive={isChatActive}
      />

      <input type="file" ref={adminFileRef} onChange={handleAdminFile} style={{ display: 'none' }} />

      {showViewer && viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage}
          onClose={() => {
            setShowViewer(false);
            setViewingImage(null);
          }}
          onEdit={(imageUrl: string) => {
            setEditingImage(imageUrl);
            setShowEditor(true);
          }}
        />
      )}

      {showEditor && editingImage && (
        <ImageEditorModal
          imageUrl={editingImage}
          onClose={() => {
            setShowEditor(false);
            setEditingImage(null);
          }}
          onSave={handleEditorSave}
        />
      )}



      <SummaryExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={async (format: string) => {
          if (format === 'pdf') {
            await handleExportSummary();
          } else {
            // Future XLSX implementation if needed
            addToast({
              id: `pdf-xlsx-future-${Date.now()}`,
              type: 'ticket',
              title: 'ฟังก์ชัน Excel ยังไม่พร้อมใช้งาน',
              body: 'ปัจจุบันระบบรองรับการส่งออกเป็น PDF เท่านั้น'
            });
          }
        }}
        onPrint={handlePrintSummary}
        ticketNo={ticket?.ticket_no || ''}
      />

      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setRejectNote('');
        }}
        size="sm"
        title={
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle color="var(--color-warning)" size={18} aria-hidden="true" />
            ส่งกลับเพื่อแก้ไขต่อ
          </span>
        }
        description="กรุณาระบุรายละเอียดและคำวิจารณ์เพื่อแจ้งแก่ผู้ปฏิบัติงานภายนอก"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false);
                setRejectNote('');
              }}
            >
              ยกเลิก
            </Button>
            <Button
              variant="warning"
              loading={updating}
              disabled={!rejectNote.trim() || updating}
              onClick={() => void handleRejectFixCompleted(rejectNote.trim())}
            >
              ยืนยันการส่งกลับ
            </Button>
          </>
        }
      >
        <Textarea
          label="เหตุผลที่ส่งกลับแก้ไข"
          required
          rows={4}
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="ระบุเหตุผลที่ส่งกลับแก้ไข..."
        />
      </Modal>

      {/* Hidden Report Template (for PDF Export) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={reportRef} style={{ 
          width: '800px', 
          padding: '60px', 
          background: 'white', 
          color: 'black', 
          fontFamily: 'var(--font-sans)',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #3699FF', paddingBottom: '24px', marginBottom: '40px' }}>
             <div>
                <h1 style={{ color: '#3699FF', margin: 0, fontSize: '32px', fontWeight: '900', letterSpacing: '1px' }}>NEO SUPPORT</h1>
                <p style={{ color: '#5e6278', margin: '4px 0 0 0', fontSize: '14px', fontWeight: '600' }}>Service Report & Technical Summary</p>
             </div>
             <div style={{ textAlign: 'right' }}>
                <p style={{ margin: 0, fontWeight: '800', fontSize: '18px' }}>Ticket: {ticket?.ticket_no}</p>
                <p style={{ margin: '4px 0 0 0', color: '#5e6278', fontSize: '14px' }}>Date: {new Date().toLocaleDateString('th-TH')}</p>
             </div>
          </div>

          {/* Info Boxes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
             <div style={{ background: '#f5f8fa', padding: '24px', borderRadius: '12px', border: '1px solid #e1e3ea' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', color: '#181c32', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e1e3ea', paddingBottom: '10px' }}>CLIENT INFO</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                   <p style={{ margin: 0 }}><strong>Organization:</strong> {ticket?.customers?.organizations?.name || '-'}</p>
                   <p style={{ margin: 0 }}><strong>Department:</strong> {ticket?.department_data?.name || '-'}</p>
                   <p style={{ margin: 0 }}><strong>Reporter:</strong> {ticket?.customers?.display_name || '-'}</p>
                </div>
             </div>
             <div style={{ background: '#f5f8fa', padding: '24px', borderRadius: '12px', border: '1px solid #e1e3ea' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '13px', fontWeight: '800', color: '#181c32', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e1e3ea', paddingBottom: '10px' }}>ISSUE DETAILS</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
                   <p style={{ margin: 0 }}><strong>Type:</strong> {ticket?.issue_type || '-'}</p>
                   <p style={{ margin: 0 }}><strong>Module:</strong> {ticket?.module || '-'}</p>
                   <p style={{ margin: 0 }}><strong>Status:</strong> {ticket?.status || '-'}</p>
                </div>
             </div>
          </div>

          {/* Content Sections */}
          <div style={{ marginBottom: '32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '20px', background: '#3699FF', borderRadius: '2px' }}></div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#3699FF', textTransform: 'uppercase' }}>PROBLEM DESCRIPTION</h3>
             </div>
             <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e1e3ea', minHeight: '100px', fontSize: '14px', lineHeight: '1.6', background: 'white' }}>
                {ticket?.subject || ticket?.description || '-'}
             </div>
          </div>

          <div style={{ marginBottom: '32px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '20px', background: '#28C76F', borderRadius: '2px' }}></div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#28C76F', textTransform: 'uppercase' }}>RESOLUTION & NOTES</h3>
             </div>
             <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #c3ebce', background: '#f0fff4', minHeight: '120px', fontSize: '14px', lineHeight: '1.6' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '8px' }}>วิธีแก้ไข:</p>
                {ticket?.resolution_summary || '-'}
             </div>
          </div>

          <div style={{ marginBottom: '80px' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <div style={{ width: '4px', height: '20px', background: '#3699FF', borderRadius: '2px' }}></div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#3699FF', textTransform: 'uppercase' }}>AI POST-MORTEM ANALYSIS</h3>
             </div>
             <div style={{ padding: '20px', borderRadius: '12px', border: '1px solid #e1e3ea', fontSize: '14px', color: '#181c32', background: '#f8f9fa' }}>
                {(ticket as any)?.ai_analysis ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div><strong style={{ color: '#28C76F' }}>Root Cause:</strong><br/>{(ticket as any).ai_analysis.rootCause}</div>
                    <div><strong style={{ color: '#3699FF' }}>Resolution:</strong><br/>{(ticket as any).ai_analysis.resolution}</div>
                    <div><strong style={{ color: '#FF9F43' }}>Preventive Recommendations:</strong>
                      <ul style={{ margin: '4px 0 0', paddingLeft: '20px' }}>
                        {(ticket as any).ai_analysis.preventiveRecommendations?.map((r: string, i: number) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: '#5e6278', fontStyle: 'italic' }}>N/A</span>
                )}
             </div>
          </div>

          {/* Footer Signature */}
          {ticket?.status === 'Resolved' && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'auto' }}>
               <div style={{ width: '280px', textAlign: 'center' }}>
                  <div style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                    {resolverProfile?.signature_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={resolverProfile.signature_url} 
                        style={{ maxHeight: '70px', maxWidth: '200px' }} 
                        alt="Signature" 
                      />
                    ) : (
                      <div style={{ height: '40px' }}></div>
                    )}
                  </div>
                  <div style={{ borderBottom: '1px solid #181c32', marginBottom: '8px' }}></div>
                  <p style={{ margin: 0, fontSize: '15px', fontWeight: '800' }}>
                    {resolverProfile?.full_name || user?.display_name || 'Engineer'}
                  </p>
               </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
