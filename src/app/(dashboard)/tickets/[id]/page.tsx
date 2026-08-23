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
import { User, Clock, ChevronRight, ClipboardCheck, FileText, Paperclip, ExternalLink, AlertTriangle } from 'lucide-react';
import { deleteMessageAction, closeConversationAction } from '@/app/actions/messageActions';
import { compressImage } from '@/lib/utils/imageCompression';
import { useNotificationContext } from '@/contexts/NotificationContext';
import {
  getTicketDetailActionFailedToast,
  getTicketDetailChatMustEndToast,
  confirmTicketDetailDeleteMessage,
  confirmTicketDetailEndChat,
  getTicketDetailResolvedToast,
  getTicketDetailValidationToast,
} from '@/lib/tickets/detailFeedback';
import { createStaffChatMediaUrl, PRIVATE_CHAT_MEDIA_BUCKET } from '@/lib/media/chatMediaPath';
import {
  getTicketDetailAction,
  getTicketDetailStaticMetaAction,
  createTicketDetailAttachmentUploadAction,
  sendTicketDetailAttachmentAction,
  sendTicketDetailMessageAction,
  updateTicketDetailFieldAction,
} from '@/app/actions/ticketActions';
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

function withStaffMediaUrl(message: TicketDetailMessage): TicketDetailMessage {
  if (message.message_type !== 'image' && message.message_type !== 'file') return message;

  const rawMedia = message.media_path || message.content;
  const mediaUrl = createStaffChatMediaUrl(rawMedia);
  if (!mediaUrl) return message;

  return {
    ...message,
    media_path: mediaUrl,
    content: message.media_path ? message.content : mediaUrl,
  };
}

const pageGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6.5fr 3.5fr',
  gap: '24px',
  alignItems: 'start',
  marginBottom: '24px',
};

const loadingContainerStyle: React.CSSProperties = { height: '70vh' };
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
  const adminFileRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);
  const staticMetaLoadedRef = useRef(false);
  const refreshInFlightRef = useRef(false);
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
      <div className="glass" style={{ padding: '20px 24px', borderRadius: '16px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', marginBottom: '24px', transition: 'all 0.3s' }}>
        {/* Card Header (Clickable to Toggle) */}
        <div 
          onClick={() => setAiCardExpanded(!aiCardExpanded)}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>✨ AI Post-Mortem Analysis</span>
          </h3>
          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--primary)', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '4px' }}>
            {aiCardExpanded ? 'ย่อข้อมูล ▲' : 'ขยายข้อมูล ▼'}
          </span>
        </div>

        {/* Card Content (Collapsible) */}
        {aiCardExpanded && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '16px' }}>
            <div>
              <strong style={{ color: '#10b981', fontSize: '12px' }}>ปัญหาที่แท้จริง (Root Cause):</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: '1.5' }}>{aiData.rootCause}</p>
            </div>
            <div>
              <strong style={{ color: '#0ea5e9', fontSize: '12px' }}>วิธีแก้ไขที่ใช้ (Resolution):</strong>
              <p style={{ margin: '4px 0 0', fontSize: '13px', lineHeight: '1.5' }}>{aiData.resolution}</p>
            </div>
            <div>
              <strong style={{ color: '#f59e0b', fontSize: '12px' }}>ข้อเสนอแนะเพื่อป้องกัน (Preventive Recommendations):</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: '20px', fontSize: '13px', lineHeight: '1.6' }}>
                {aiData.preventiveRecommendations?.map((r: string, i: number) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  const externalReport = parseLatestExternalReport(ticket?.resolution_summary);

  const renderWorkReportCard = () => {
    if (!externalReport) return null;

    const currentStatus = (status || '').trim().toLowerCase();
    const isFixCompleted = currentStatus === 'fix completed';
    const isResolved = currentStatus === 'resolved';
    
    // Choose theme colors based on state
    const borderColor = isFixCompleted ? '#10b981' : isResolved ? 'var(--primary)' : '#f59e0b';
    const statusBg = isFixCompleted ? 'rgba(16, 185, 129, 0.1)' : isResolved ? 'var(--primary-transparent)' : 'rgba(245, 158, 11, 0.1)';
    const statusColor = isFixCompleted ? '#10b981' : isResolved ? 'var(--primary)' : '#f59e0b';

    return (
      <div 
        className="glass" 
        style={{ 
          padding: '24px', 
          borderRadius: '16px', 
          borderLeft: `4px solid ${borderColor}`,
          background: 'rgba(255, 255, 255, 0.03)',
          boxShadow: isFixCompleted ? '0 8px 32px rgba(16, 185, 129, 0.08)' : '0 8px 32px rgba(0, 0, 0, 0.2)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden',
          marginBottom: '24px'
        }}
      >
        {/* Card Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ClipboardCheck size={20} color={borderColor} />
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: 'var(--text)', margin: 0 }}>
              รายงานผลการดำเนินงาน
            </h3>
          </div>
          <span 
            style={{ 
              padding: '4px 10px', 
              borderRadius: '6px', 
              fontSize: '11px', 
              fontWeight: '800', 
              background: statusBg,
              color: statusColor,
              letterSpacing: '0.5px'
            }}
          >
            {externalReport.status.toUpperCase()}
          </span>
        </div>

        {/* Card Body */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div>
              <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>ผู้บันทึกผลงาน</span>
              <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text)' }}>
                {externalReport.receiverName}
              </span>
            </div>
            <div>
              <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '2px' }}>เวลาส่งรายงาน</span>
              <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)' }}>
                {externalReport.timestamp ? `${externalReport.timestamp} UTC` : '-'}
              </span>
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>รายละเอียดการปฏิบัติงาน</span>
            <div 
              style={{ 
                fontSize: '14px', 
                lineHeight: '1.6', 
                color: 'var(--text)', 
                background: 'rgba(255,255,255,0.01)', 
                padding: '16px', 
                borderRadius: '12px', 
                border: '1px solid var(--border)',
                whiteSpace: 'pre-wrap'
              }}
            >
              {externalReport.details || 'ไม่มีรายละเอียดการปฏิบัติงาน'}
            </div>
          </div>

          {/* Attachments Section */}
          {externalReport.attachments.length > 0 && (
            <div>
              <span style={{ display: 'block', fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>เอกสารแนบปฏิบัติงาน ({externalReport.attachments.length})</span>
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
                      className="glass-interactive"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: '1px solid var(--border)',
                        textDecoration: 'none',
                        color: 'var(--text)',
                        fontSize: '12px',
                        fontWeight: '700',
                        transition: 'all 0.2s',
                        maxWidth: '260px'
                      }}
                    >
                      {isImage ? <FileText size={14} color="var(--primary)" /> : <Paperclip size={14} color="var(--primary)" />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {fileName}
                      </span>
                      <ExternalLink size={12} color="var(--text-muted)" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const fetchStaticMeta = useCallback(async () => {
    if (staticMetaLoadedRef.current) return;
    const meta = await getTicketDetailStaticMetaAction();
    setAvailableDepts(meta.departments);
    setAvailableModules(meta.modules.length > 0 ? meta.modules : DEFAULT_MODULES);
    setAvailableIssueTypes(meta.issueTypes);
    setUser(meta.user as TicketDetailUser);
    setPersonalQuickReplies(meta.quickReplies);
    setPersonalResTemplates(
      meta.personalResolutionTemplates.length > 0
        ? meta.personalResolutionTemplates
        : meta.companyResolutionTemplates
    );

    staticMetaLoadedRef.current = true;
  }, []);

  const fetchData = useCallback(async (syncFormState = true) => {
    if (!ticketId || refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;

    try {
      const result = await getTicketDetailAction(ticketId);
      if (result) {
        const normalizedTicket = result.ticket as unknown as TicketDetailTicket;
        setTicket(normalizedTicket);
        setStatus(normalizedTicket.status || '');
        if (syncFormState) {
          setPriority(normalizedTicket.priority || '');
          setSelectedDept(normalizedTicket.current_department_id || '');
          setSelectedModule(normalizedTicket.module || '');
        }

        setLogs(result.logs as TicketDetailLog[]);
        setResolverProfile(result.resolver || null);
        setConversationId(result.conversationId);
        conversationIdRef.current = result.conversationId;
        setIsChatActive(Boolean(result.conversationId));
        const serverMessages = (result.messages as TicketDetailMessage[]).map(withStaffMediaUrl);
        setMessages((previous) => {
          if (syncFormState) return serverMessages;
          const optimistic = previous.filter((message) => message.id.startsWith('temp-')).filter((message) =>
            !serverMessages.some((saved) =>
              saved.sender_type === message.sender_type &&
              saved.staff_id === message.staff_id &&
              (saved.content || '').trim() === (message.content || '').trim() &&
              Math.abs(Date.parse(saved.created_at) - Date.parse(message.created_at)) <= 30_000
            )
          );
          return [...serverMessages, ...optimistic]
            .sort((left, right) => Date.parse(left.created_at) - Date.parse(right.created_at));
        });
      }

      await fetchStaticMeta();
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('update ticket', error));
    } finally {
      refreshInFlightRef.current = false;
      setLoading(false);
    }
  }, [addToast, fetchStaticMeta, ticketId]);

  useEffect(() => {
    void fetchData(true);
    if (!ticketId) return;
    let poller: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      if (poller) clearInterval(poller);
      const intervalMs = document.visibilityState === 'visible' ? 5_000 : 30_000;
      poller = setInterval(() => { void fetchData(false); }, intervalMs);
    };
    const handleVisibilityChange = () => {
      startPolling();
      if (document.visibilityState === 'visible') void fetchData(false);
    };
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (poller) clearInterval(poller);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      conversationIdRef.current = null;
    };
  }, [fetchData, ticketId]);
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

      try {
        if (field === 'status') {
          await ticketService.updateStatus(ticketId, value);
        } else {
          await updateTicketDetailFieldAction(ticketId, field, value);
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
      await sendTicketDetailMessageAction(ticketId, { conversationId, content });
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

      const upload = await createTicketDetailAttachmentUploadAction(ticketId, {
        mimeType: contentType,
        extension: ext,
        size: fileToUpload.size,
      });
      const { error: uploadError } = await supabase.storage.from(PRIVATE_CHAT_MEDIA_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, fileToUpload, { contentType });
      if (uploadError) throw uploadError;
      await sendTicketDetailAttachmentAction(ticketId, { conversationId, path: upload.path });
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('upload file', error));
    } finally {
      setSending(false);
      if (adminFileRef.current) adminFileRef.current.value = '';
    }
  }, [addToast, conversationId, ticketId]);



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
      
      const upload = await createTicketDetailAttachmentUploadAction(ticketId, {
        mimeType: contentType,
        extension: ext,
        size: fileToUpload.size,
      });
      const { error: uploadError } = await supabase.storage.from(PRIVATE_CHAT_MEDIA_BUCKET)
        .uploadToSignedUrl(upload.path, upload.token, fileToUpload, { contentType });
      if (uploadError) throw uploadError;
      await sendTicketDetailAttachmentAction(ticketId, { conversationId, path: upload.path });

      // 4. Close modal only after success
      setShowEditor(false);
      setEditingImage(null);
    } catch (error) {
      console.error('Editor save failed:', error);
      addToast(getTicketDetailActionFailedToast('save edited image', error));
    } finally {
      setSending(false);
    }
  }, [addToast, conversationId, ticketId]);

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
      const updatedTicket = await ticketService.resolve(ticketId, user.id, resSummary, selectedModule, selectedIssueType, conversationId || undefined);
      const newStatus = updatedTicket?.status || 'Resolved';

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
    <div className="animate-page-in">
      <TicketHeader
        ticket={ticket}
        status={status}
        user={user}
        updating={updating}
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

      <div className="glass" style={{ padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) 1fr', gap: '40px', alignItems: 'center' }}>
          
          {/* Left: Customer Info Mini Card (Moved to Left) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingRight: '40px', borderRight: '2px solid var(--border)' }}>
             <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {ticket.customers?.avatar_url ? (
                   <Image 
                      src={ticket.customers.avatar_url} 
                      alt="avatar" 
                      width={44} 
                      height={44} 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                   />
                ) : (
                   <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                      <User size={20} />
                   </div>
                )}
             </div>
             <div style={{ flex: 1, minWidth: 0 }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                   {ticket.customers?.display_name || 'Customer'}
                </h4>
                <Link 
                   href={`/tickets?customerId=${ticket.customer_id}`} 
                   style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: '700', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '2px' }}
                >
                   View History <ChevronRight size={12} />
                </Link>
             </div>
          </div>

          {/* Right: Time Tracking (Moved to Right and Pushed to Edge) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px', justifyContent: 'flex-end' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Clock size={20} color="var(--primary)" />
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time Tracking</span>
             </div>

             <div style={{ display: 'flex', gap: '40px' }}>
                <div>
                  <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>REPORTED</label>
                  <p style={{ fontSize: '13px', fontWeight: '700' }}>
                    {ticket.created_at ? new Date(ticket.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>

                {ticket.resolved_at ? (
                  <>
                    <div>
                      <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>RESOLVED</label>
                      <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                        {new Date(ticket.resolved_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div style={{ paddingLeft: '24px', borderLeft: '1px solid var(--border)' }}>
                      <label style={{ fontSize: '9px', fontWeight: '800', color: 'var(--primary)', display: 'block', marginBottom: '4px' }}>DURATION</label>
                      <p style={{ fontSize: '18px', fontWeight: '900' }}>{getTicketDuration(ticket.created_at || '', ticket.resolved_at)}</p>
                    </div>
                  </>
                ) : (
                  <div style={{ paddingLeft: '24px', borderLeft: '1px solid var(--border)' }}>
                    <label style={{ fontSize: '9px', fontWeight: '800', color: 'orange', display: 'block', marginBottom: '4px' }}>PENDING</label>
                    <p style={{ fontSize: '18px', fontWeight: '900' }}>{getTicketDuration(ticket.created_at || '')}</p>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>

      <div style={pageGridStyle}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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

      {showRejectModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass animate-in zoom-in" style={{ width: '100%', maxWidth: '400px', background: 'var(--bg-card)', borderRadius: '24px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '900', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
              <AlertTriangle color="var(--warning)" size={18} /> ส่งกลับเพื่อแก้ไขต่อ
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              กรุณาระบุรายละเอียดและคำวิจารณ์เพื่อแจ้งแก่ผู้ปฏิบัติงานภายนอก
            </p>
            <textarea 
              value={rejectNote} 
              onChange={(e) => setRejectNote(e.target.value)} 
              placeholder="ระบุเหตุผลที่ส่งกลับแก้ไข..." 
              style={{ width: '100%', height: '120px', padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-main)', fontSize: '14px', marginBottom: '20px', outline: 'none', resize: 'none' }} 
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectNote('');
                }} 
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid var(--border)', background: 'none', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}
              >
                ยกเลิก
              </button>
              <button
                disabled={!rejectNote.trim() || updating}
                onClick={() => void handleRejectFixCompleted(rejectNote.trim())}
                style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', background: '#f59e0b', color: 'white', fontWeight: '800', cursor: 'pointer', opacity: (!rejectNote.trim() || updating) ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {updating ? <Loader2 size={16} className="animate-spin" /> : 'ยืนยันการส่งกลับ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Report Template (for PDF Export) */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
        <div ref={reportRef} style={{ 
          width: '800px', 
          padding: '60px', 
          background: 'white', 
          color: 'black', 
          fontFamily: "'Inter', 'Sarabun', sans-serif",
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
