'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft,
  ArrowDown,
  Clock,
  MessageCircle,
  Loader2,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  FileText,
  SendHorizontal,
  Paperclip,
  Star
} from 'lucide-react';
import { useLiff } from '@/hooks/useLiff';
import {
  getPortalTicketDetailAction,
  sendPortalMessageAction,
  submitSurveyAction,
} from '@/app/actions/portalActions';
import { compressImage } from '@/lib/utils/imageCompression';
import styles from './ticket.module.css';

const ChatAttachmentModal = React.lazy(() => import('@/components/chat/ChatAttachmentModal'));
const ImageEditorModal = React.lazy(() => import('@/components/modals/ImageEditorModal'));
const ImageViewerModal = React.lazy(() => import('@/components/modals/ImageViewerModal'));

const STATUS_LEVELS: Record<string, number> = {
  'new': 1,
  'pending': 1,
  'assigned': 2,
  'in progress': 2,
  'escalated': 3,
  'fix completed': 3,
  'resolved': 4,
  'closed': 4
};

const DEFAULT_ACCENT = '#1D4ED8';
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function isSurveyEligibleStatus(status: unknown) {
  const s = String(status || '').toLowerCase();
  return s === 'resolved' || s === 'closed';
}

function getToneType(status: unknown): 'success' | 'warning' | 'accent' {
  const s = String(status || '').toLowerCase();
  if (s === 'resolved' || s === 'closed') return 'success';
  if (s === 'pending') return 'warning';
  return 'accent';
}

// 1. Memoized Message Bubble to prevent massive DOM re-renders during chat scrolling
interface MessageBubbleProps {
  msg: any;
  onImageClick: (url: string) => void;
}

const MessageBubble = React.memo(function MessageBubble({ msg, onImageClick }: MessageBubbleProps) {
  const isCustomer = msg.sender_type === 'customer';
  const mediaUrl = typeof msg.media_path === 'string' && msg.media_path ? msg.media_path : msg.content;
  const hasHttpMedia = typeof mediaUrl === 'string' && mediaUrl.startsWith('http');
  const isImg = hasHttpMedia && (msg.message_type === 'image' || Boolean(mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i)));
  const isDoc = hasHttpMedia && (msg.message_type === 'file' || msg.message_type === 'video' || msg.message_type === 'audio' || msg.message_type !== 'text');

  return (
    <div className={`${styles.bubbleRow} ${isCustomer ? styles.bubbleRowOut : styles.bubbleRowIn}`}>
      <div className={`${styles.bubble} ${isCustomer ? styles.bubbleOut : styles.bubbleIn}`}>
        {isImg ? (
          <button
            type="button"
            className={styles.imageButton}
            onClick={() => onImageClick(mediaUrl)}
            aria-label="เปิดดูรูปภาพที่แนบขนาดใหญ่"
            title="คลิกเพื่อทำการขยายภาพ"
          >
            <img
              src={mediaUrl}
              className={styles.imageThumb}
              alt={isCustomer ? 'รูปภาพที่คุณส่ง' : 'รูปภาพจากเจ้าหน้าที่'}
              loading="lazy"
            />
          </button>
        ) : isDoc ? (
          <a href={mediaUrl} target="_blank" rel="noreferrer" className={styles.fileLink}>
            <Paperclip size={16} aria-hidden="true" />
            <span>ดูไฟล์แนบ</span>
          </a>
        ) : (
          <p className={styles.bubbleText}>{msg.content}</p>
        )}
        <time className={styles.bubbleTime} dateTime={msg.created_at}>
          {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </time>
      </div>
    </div>
  );
});

// 2. Memoized Ticket Status Stepper
interface TicketStatusStepperProps {
  currentLevel: number;
  status: string;
}

const STEPPER_STEPS = [
  { level: 1, label: 'รอดำเนินการ' },
  { level: 2, label: 'รับงานแล้ว' },
  { level: 3, label: 'ส่งต่อแก้ปัญหา' },
  { level: 4, label: 'ปิดงานแล้ว' }
];

const FILL_CLASSES = [
  styles.stepperFill0,
  styles.stepperFill1,
  styles.stepperFill2,
  styles.stepperFill3
];

const TicketStatusStepper = React.memo(function TicketStatusStepper({ currentLevel, status }: TicketStatusStepperProps) {
  const isPending = status.toLowerCase() === 'pending';
  const tone = getToneType(status);
  const toneClass =
    tone === 'success'
      ? styles.toneSuccess
      : tone === 'warning'
        ? styles.toneWarning
        : styles.toneAccent;
  const fillIdx = Math.max(0, Math.min(3, currentLevel - 1));

  return (
    <div className={`${styles.stepperTrack} ${toneClass}`}>
      <div className={styles.stepperTrackBg} aria-hidden="true" />
      <div className={`${styles.stepperTrackFill} ${FILL_CLASSES[fillIdx]}`} aria-hidden="true" />
      <ol className={styles.stepper} aria-label="ความคืบหน้าของใบงาน">
        {STEPPER_STEPS.map((step) => {
          const isActive = step.level === currentLevel;
          const isCompleted = step.level < currentLevel;
          const stateClass = isCompleted ? styles.stepDone : isActive ? styles.stepActive : '';

          return (
            <li
              key={step.level}
              className={`${styles.step} ${stateClass}`}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className={styles.stepNode} aria-hidden="true">
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : isActive && isPending ? (
                  <AlertTriangle size={14} />
                ) : (
                  step.level
                )}
              </span>
              <span className={styles.stepLabel}>{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
});

export default function TicketDetailPage() {
  const { id } = useParams();
  const ticketId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { isReady, profile, projectConfig, getIdToken, error: liffError, setMockLogin } = useLiff();
  const projectSlugParam =
    projectConfig && !projectConfig.is_default && projectConfig.slug
      ? `project=${encodeURIComponent(projectConfig.slug)}`
      : '';
  const portalHomeUrl = projectSlugParam ? `/portal?${projectSlugParam}` : '/portal';
  const buildSurveyRedirectUrl = (tid: string) =>
    projectSlugParam
      ? `/portal?${projectSlugParam}&survey_ticket_id=${tid}`
      : `/portal?survey_ticket_id=${tid}`;

  const accentColor =
    projectConfig?.primary_color && HEX_COLOR_PATTERN.test(projectConfig.primary_color.trim())
      ? projectConfig.primary_color.trim()
      : DEFAULT_ACCENT;
  const rootStyle = { '--portal-accent': accentColor } as React.CSSProperties;

  const [ticket, setTicket] = useState<any | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);
  const [isAttachModalOpen, setIsAttachModalOpen] = useState<boolean>(false);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [editingImage, setEditingImage] = useState<string>('');
  const [viewingImage, setViewingImage] = useState<string>('');
  const [, setConversationId] = useState<string | null>(null);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [showSurvey, setShowSurvey] = useState<boolean>(false);
  const [hasResponded, setHasResponded] = useState<boolean>(false);
  const [surveyScore, setSurveyScore] = useState<number>(0);
  const [surveyValue, setSurveyValue] = useState<number>(0);
  const [surveyHover, setSurveyHover] = useState<number>(0);
  const [surveyComment, setSurveyComment] = useState<string>('');
  const [submittingSurvey, setSubmittingSurvey] = useState<boolean>(false);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const hasRespondedRef = useRef(false);
  const ticketStatusRef = useRef<string | null>(null);
  const lastShowJumpRef = useRef(false);

  const scrollToLatest = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
  };

  // Throttled scroll listener to avoid layout recalculation on every pixel scroll
  const handleMessagesScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const shouldShow = distanceFromBottom > 120;
    if (shouldShow !== lastShowJumpRef.current) {
      lastShowJumpRef.current = shouldShow;
      setShowJumpToLatest(shouldShow);
    }
  };

  useEffect(() => {
    hasRespondedRef.current = hasResponded;
  }, [hasResponded]);

  useEffect(() => {
    ticketStatusRef.current = ticket?.status || null;
  }, [ticket?.status]);

  const loadSurveyState = useCallback(async () => {
    if (!ticketId) return null;

    const detail = await getPortalTicketDetailAction({
      ticketId,
      lineUserId: profile?.userId || null,
      idToken: getIdToken(),
    });
    const survey = detail.survey;

    if (survey.responded) {
      setHasResponded(true);
      if (survey.value) setSurveyScore(survey.value);
    }

    return survey;
  }, [ticketId, profile?.userId, getIdToken]);

  // 1. Fetch initial ticket data once isReady and ticketId are available
  useEffect(() => {
    if (!ticketId || !isReady) return;

    async function fetchTicketData() {
      if (!ticketId) return;
      setLoading(true);
      try {
        const detail = await getPortalTicketDetailAction({
          ticketId,
          lineUserId: profile?.userId || null,
          idToken: getIdToken(),
        });

        if (detail.forbidden || !detail.ticket) {
          if (detail.forbidden) {
            console.warn('Access denied: user does not own this ticket');
          }
          setTicket(null);
          setLoading(false);
          return;
        }

        const ticketData = detail.ticket as any;
        setTicket(ticketData);

        if (detail.conversationId) {
          setConversationId(detail.conversationId);
          conversationIdRef.current = detail.conversationId;
        }

        setMessages(detail.messages);
        setLogs(detail.logs);

        if (detail.survey.responded) {
          setHasResponded(true);
          if (detail.survey.value) setSurveyScore(detail.survey.value);
        } else if (isSurveyEligibleStatus(ticketData.status)) {
          router.push(buildSurveyRedirectUrl(ticketId));
        }
      } catch (err: any) {
        console.error('Error fetching ticket:', err);
      } finally {
        setLoading(false);
      }
    }

    void fetchTicketData();

    return () => {
      conversationIdRef.current = null;
      setConversationId(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, profile?.userId, ticketId, loadSurveyState]);

  // 2. Stable Supabase Realtime subscription — depends ONLY on ticketId
  // FIX #2 & #4: Channel is created once per ticketId and never torn down due to conversationId change.
  // All handlers read conversationIdRef.current for the latest conversation ID without needing conversationId in deps.
  useEffect(() => {
    if (!ticketId) return;

    console.log(`[Realtime] Initializing stable channel for ticket: ${ticketId}`);

    // Helper: fetch all messages for this ticket via Server Action (bypasses anon RLS)
    const refetchMessages = () => {
      void getPortalTicketDetailAction({
        ticketId,
        lineUserId: profile?.userId || null,
        idToken: getIdToken(),
      }).then((detail) => {
        if (detail.messages) setMessages(detail.messages);
        if (detail.ticket) setTicket(detail.ticket);
        if (detail.logs) setLogs(detail.logs);
      });
    };

    // Helper: deduplicated message insert handler
    const handleMessageInsert = (msg: any) => {
      if (msg?.is_internal) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        if (msg.sender_type === 'customer') {
          const tempIdx = prev.findIndex(
            m => m.id?.toString().startsWith('temp_') && m.content === msg.content
          );
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = msg;
            return next;
          }
        }
        return [...prev, msg];
      });
    };

    const channel = supabase
      .channel(`portal-ticket-stable-${ticketId}`)

      // A. Messages by ticket_id (covers all messages regardless of conversation)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${ticketId}`,
      }, (payload: any) => {
        console.log('[Realtime] Message INSERT (ticket_id)', payload.new?.id);
        handleMessageInsert(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `ticket_id=eq.${ticketId}`,
      }, (payload: any) => {
        console.log('[Realtime] Message UPDATE (ticket_id)', payload.new?.id);
        setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
      })

      // B. Conversations linked to this ticket — discover conversationId dynamically
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
        filter: `current_ticket_id=eq.${ticketId}`,
      }, (payload: any) => {
        const newCid = payload.new?.id || payload.old?.id;
        console.log('[Realtime] Conversation event (by ticket_id)', newCid);
        if (newCid && newCid !== conversationIdRef.current) {
          console.log(`[Realtime] Discovered conversation: ${newCid}`);
          conversationIdRef.current = newCid;
          setConversationId(newCid);
        }
        // Re-fetch messages to capture any messages linked by conversation_id
        refetchMessages();
      })

      // C. Ticket status updates
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tickets',
        filter: `id=eq.${ticketId}`,
      }, (payload: any) => {
        const nextTicket = payload.new;
        console.log('[Realtime] Ticket UPDATE', nextTicket?.status);

        // Safety: Filter out null/undefined fields from Postgres UPDATE payload to avoid nulling out local state
        const cleanUpdate: any = {};
        Object.keys(nextTicket).forEach(key => {
          if (nextTicket[key] !== null && nextTicket[key] !== undefined) {
            cleanUpdate[key] = nextTicket[key];
          }
        });
        setTicket((prev: any) => prev ? { ...prev, ...cleanUpdate } : prev);

        // Background fetch to sync relations (e.g. assigned_agent details)
        supabase
          .from('tickets')
          .select(`*, assigned_agent:profiles!assigned_agent_id(*)`)
          .eq('id', ticketId)
          .maybeSingle()
          .then(({ data }: any) => {
            if (data) setTicket(data);
          });

        supabase
          .from('ticket_logs')
          .select('id, created_at, action_type, to_status')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false })
          .then(({ data }: any) => { if (data) setLogs(data); });
        if (isSurveyEligibleStatus(nextTicket?.status) && !hasRespondedRef.current) {
          router.push(buildSurveyRedirectUrl(ticketId));
        }
      })

      // D. CSAT survey updates
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'csat_surveys',
        filter: `ticket_id=eq.${ticketId}`,
      }, (payload: any) => {
        const nextSurvey = payload.new;
        const value = nextSurvey?.score || nextSurvey?.rating || 0;
        const responded = Boolean(nextSurvey?.responded_at || value);
        if (responded) {
          setHasResponded(true);
          if (value) setSurveyScore(value);
          return;
        }
        if (!hasRespondedRef.current && isSurveyEligibleStatus(ticketStatusRef.current || payload.old?.status)) {
          setShowSurvey(true);
        }
      })

      .subscribe((status, err) => {
        console.log(`[Realtime] Channel status for ticket ${ticketId}:`, status, err || '');
        if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
          console.warn('[Realtime] Channel error or closed, forcing resync & reconnect.');
          refetchMessages();
          supabase.realtime.connect();
        }
      });

    // Dynamic fallback polling to save mobile battery and handle disconnects
    let poller: any = null;
    const startPoller = (intervalMs: number) => {
      if (poller) window.clearInterval(poller);
      poller = window.setInterval(() => {
        refetchMessages();
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // High frequency refresh when active
        startPoller(15000);
        refetchMessages();
      } else {
        // Low frequency refresh in background
        startPoller(45000);
      }
    };

    // Initial start
    startPoller(document.visibilityState === 'visible' ? 15000 : 45000);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (poller) window.clearInterval(poller);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      console.log(`[Realtime] Removing channel for ticket: ${ticketId}`);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);
  // NOTE: conversationId intentionally excluded — read via conversationIdRef to prevent channel teardown

  useEffect(() => {
    if (!ticketId) return;
    scrollToLatest('auto');
  }, [ticketId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      scrollToLatest(messages.length > 1 ? 'smooth' : 'auto');
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => {
    if (!ticketId) return;
    void loadSurveyState();
  }, [loadSurveyState, ticketId]);

  useEffect(() => {
    if (isSurveyEligibleStatus(ticket?.status) && !hasResponded && ticketId) {
      const targetUrl = projectSlugParam
        ? `/portal?${projectSlugParam}&survey_ticket_id=${ticketId}`
        : `/portal?survey_ticket_id=${ticketId}`;
      const timer = setTimeout(() => {
        router.push(targetUrl);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ticket?.status, hasResponded, ticketId, projectSlugParam, router]);

  const handleEditExistingImage = (url: string) => {
    setViewingImage(url);
    setIsViewerOpen(true);
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      content: newMessage,
      sender_type: 'customer',
      created_at: new Date().toISOString(),
      ticket_id: ticketId
    };
    setMessages((prev: any[]) => [...prev, optimisticMsg]);
    const messageToSend = newMessage;
    setNewMessage('');
    setSending(true);

    try {
      if (!profile?.userId) throw new Error('LINE profile not loaded');

      const sentMsg = await sendPortalMessageAction(
        ticketId as string,
        profile.userId,
        messageToSend,
        'text',
        getIdToken()
      );
      setMessages((prev: any[]) =>
        prev.map((m: any) => (m.id === tempId ? sentMsg : m))
      );
    } catch (err: any) {
      alert('Error sending message: ' + err.message);
      setMessages((prev: any[]) => prev.filter((m: any) => m !== optimisticMsg));
    } finally {
      setSending(false);
    }
  };

  const handleConfirmAttachment = async (file: File, type: 'image' | 'video' | 'file') => {
    setSending(true);
    try {
      let fileToUpload: File | Blob = file;
      let contentType = file.type;
      let ext = file.name.split('.').pop() || 'jpg';

      if (contentType.startsWith('image/')) {
        try {
          const compressed = await compressImage(file, { quality: 1.0 });
          fileToUpload = compressed;
          contentType = 'image/webp';
          ext = 'webp';
        } catch (err) {
          console.error('Portal detail compression failed:', err);
        }
      }

      const fileName = `${ticketId}_${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, fileToUpload, { contentType });
      if (uploadError) throw uploadError;

      if (!profile?.userId) throw new Error('LINE profile not loaded');
      const dbType = type === 'image' ? 'image' : 'file';

      const { data: { publicUrl } } = supabase.storage.from('chat_media').getPublicUrl(fileName);
      await sendPortalMessageAction(
        ticketId as string,
        profile.userId,
        publicUrl,
        dbType,
        getIdToken()
      );
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isReady || loading) {
    return (
      <div className={styles.stateScreen} style={rootStyle}>
        <div className={styles.stateCard} role="status" aria-live="polite">
          <Loader2 className={`${styles.spinner} ${styles.stateIconAccent}`} size={32} aria-hidden="true" />
          <p className={styles.stateDesc}>กำลังโหลดข้อมูลใบงาน...</p>
        </div>
      </div>
    );
  }

  if (liffError || !profile) {
    return (
      <div className={styles.stateScreen} style={rootStyle}>
        <div className={`${styles.stateCard} ${styles.stateCardDanger}`}>
          <AlertCircle size={44} className={styles.stateIconDanger} aria-hidden="true" />
          <h2 className={styles.stateTitle}>ไม่สามารถเข้าถึงได้</h2>
          <p className={styles.stateDesc}>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE</p>
          <button
            type="button"
            className={styles.stateActionBtn}
            onClick={() => setMockLogin('U_MOCK_ADMIN', 'Guest Admin')}
          >
            ทดสอบระบบ (Mock Login)
          </button>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className={styles.stateScreen} style={rootStyle}>
        <div className={styles.stateCard}>
          <AlertCircle size={44} className={styles.stateIconDanger} aria-hidden="true" />
          <h2 className={styles.stateTitle}>ไม่พบข้อมูลใบงาน</h2>
          <button
            type="button"
            className={styles.stateActionBtn}
            onClick={() => router.push(portalHomeUrl)}
          >
            กลับสู่หน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  let currentLevel = STATUS_LEVELS[String(ticket.status).toLowerCase()] || 1;
  if (currentLevel === 1 && ticket.assigned_agent_id) {
    currentLevel = 2;
  }

  const getFriendlyStatus = () => {
    const s = String(ticket.status).toLowerCase();
    const hasAgent = !!ticket.assigned_agent_id;
    if (s === 'resolved') return 'แก้ไขเสร็จสิ้น (Resolved)';
    if (s === 'closed') return 'ปิดใบงานแล้ว (Closed)';
    if (s === 'fix completed') return 'แก้ไขแล้ว รอตรวจสอบ (Fix Completed)';
    if (s === 'escalated') return 'ส่งต่อผู้เชี่ยวชาญ (Escalated)';
    if (s === 'assigned') return 'รับงานแล้ว (Assigned)';
    if (s === 'in progress') return 'กำลังดำเนินการ (In Progress)';
    if (s === 'pending') return 'ติดปัญหา (Pending)';
    if (hasAgent) return 'รับงานแล้ว (Assigned)';
    return 'รอดำเนินการ (New)';
  };

  const getCompactStatus = () => {
    const s = String(ticket.status).toLowerCase();
    const hasAgent = !!ticket.assigned_agent_id;
    if (s === 'resolved') return 'แก้ไขเสร็จสิ้น';
    if (s === 'closed') return 'ปิดใบงานแล้ว';
    if (s === 'fix completed') return 'รอตรวจสอบ';
    if (s === 'escalated') return 'ส่งต่อผู้เชี่ยวชาญ';
    if (s === 'assigned') return 'รับงานแล้ว';
    if (s === 'in progress') return 'กำลังดำเนินการ';
    if (s === 'pending') return 'ติดปัญหา';
    if (hasAgent) return 'รับงานแล้ว';
    return 'รอดำเนินการ';
  };

  const handleSubmitSurvey = async () => {
    if (surveyValue === 0 || !ticketId) return;
    setSubmittingSurvey(true);
    try {
      const result = await submitSurveyAction(ticketId, surveyValue, surveyComment);
      if (!result.success) {
        if (result.alreadySubmitted) {
          setHasResponded(true);
          setShowSurvey(false);
          return;
        }
        throw new Error(result.error || 'ไม่สามารถบันทึกการประเมินได้');
      }
      setHasResponded(true);
      setSurveyScore(surveyValue);
      setTimeout(() => setShowSurvey(false), 2000);
    } catch (err: any) {
      alert('ไม่สามารถบันทึกการประเมินได้: ' + err.message);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const filteredMessages = messages.filter((m: any) => m.message_type !== 'unsent' && !m.is_internal);
  const statusTone = getToneType(ticket.status);
  const statusPillClass =
    statusTone === 'success'
      ? styles.statusPillSuccess
      : statusTone === 'warning'
        ? styles.statusPillWarning
        : styles.statusPillAccent;
  const statusTextClass =
    statusTone === 'success'
      ? styles.statusTextSuccess
      : statusTone === 'warning'
        ? styles.statusTextWarning
        : styles.statusTextAccent;

  const surveyRatingLabel =
    surveyValue === 5
      ? 'ยอดเยี่ยมที่สุด'
      : surveyValue === 4
        ? 'ดีมาก'
        : surveyValue === 3
          ? 'ดี'
          : surveyValue === 2
            ? 'พอใช้'
            : surveyValue === 1
              ? 'ควรปรับปรุง'
              : '';

  return (
    <div className={styles.root} style={rootStyle}>
      {/* Survey Modal Popup */}
      {showSurvey && (
        <div
          className={styles.surveyOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="survey-modal-title"
        >
          <div className={styles.surveyModal}>
            {hasResponded ? (
              <div className={styles.surveyThankYou}>
                <div className={styles.surveyThankIcon} aria-hidden="true">
                  <CheckCircle2 size={28} />
                </div>
                <h3 id="survey-modal-title" className={styles.surveyTitle}>ขอบคุณมากครับ!</h3>
                <p className={styles.surveySubtitle}>คะแนนของคุณถูกบันทึกเรียบร้อยแล้ว</p>
                <div className={styles.starRow} aria-label={`คะแนน ${surveyScore || surveyValue} จาก 5 ดาว`}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={28}
                      fill={s <= (surveyScore || surveyValue) ? '#d97706' : '#e2e8f0'}
                      color={s <= (surveyScore || surveyValue) ? '#d97706' : '#e2e8f0'}
                      aria-hidden="true"
                    />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.surveyHeader}>
                  <div className={styles.surveyIconBadge} aria-hidden="true">
                    <Clock size={22} />
                  </div>
                  <h3 id="survey-modal-title" className={styles.surveyTitle}>ประเมินความพึงพอใจ</h3>
                  <p className={styles.surveySubtitle}>
                    งานหมายเลข <span className={styles.tabular}>#{ticket.ticket_no}</span> ได้รับการแก้ไขแล้ว ช่วยให้คะแนนเราหน่อยนะครับ
                  </p>
                </div>

                <div className={styles.starRow} role="radiogroup" aria-label="ให้คะแนนความพึงพอใจ">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = (surveyHover || surveyValue) >= star;
                    return (
                      <button
                        key={star}
                        type="button"
                        className={styles.starBtn}
                        onClick={() => setSurveyValue(star)}
                        onMouseEnter={() => setSurveyHover(star)}
                        onMouseLeave={() => setSurveyHover(0)}
                        aria-label={`ให้คะแนน ${star} ดาว`}
                        aria-pressed={surveyValue === star}
                      >
                        <Star
                          size={30}
                          fill={active ? '#d97706' : 'none'}
                          color={active ? '#d97706' : '#cbd5e1'}
                          aria-hidden="true"
                        />
                      </button>
                    );
                  })}
                </div>
                <div className={styles.starLabel} aria-live="polite">
                  {surveyRatingLabel}
                </div>

                <label htmlFor="survey-comment-input" className={styles.srOnly}>
                  ข้อเสนอแนะเพิ่มเติม
                </label>
                <textarea
                  id="survey-comment-input"
                  placeholder="ข้อเสนอแนะเพิ่มเติม (ถ้ามี)..."
                  value={surveyComment}
                  onChange={(e) => setSurveyComment(e.target.value)}
                  className={styles.surveyTextarea}
                />

                <div className={styles.surveyActions}>
                  <button
                    type="button"
                    className={styles.surveySkipBtn}
                    onClick={() => setShowSurvey(false)}
                  >
                    ข้ามก่อน
                  </button>
                  <button
                    type="button"
                    className={styles.surveySubmitBtn}
                    onClick={handleSubmitSurvey}
                    disabled={submittingSurvey || surveyValue === 0}
                  >
                    {submittingSurvey ? 'กำลังส่ง...' : 'ส่งผลประเมิน'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Top Navigation & Ticket Status Header */}
      <header className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={() => router.push(portalHomeUrl)}
            aria-label="กลับหน้ารายการใบงาน"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div className={styles.topBarMeta}>
            <h2 className={styles.ticketNumber}>ตั๋วเลขที่ #{ticket.ticket_no}</h2>
            <p className={styles.ticketSubjectSub}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
          </div>
        </div>
        <span className={`${styles.statusPill} ${statusPillClass}`}>
          {getCompactStatus()}
        </span>
      </header>

      {/* LINE-Native Chat Card */}
      <section className={styles.chatCard} aria-label="ห้องสนทนากับเจ้าหน้าที่">
        <div className={styles.chatHeader}>
          <h3 className={styles.chatHeaderTitle}>
            <MessageCircle size={17} className={styles.cardIcon} aria-hidden="true" />
            <span>สนทนากับเจ้าหน้าที่</span>
          </h3>
        </div>

        <div
          ref={messagesContainerRef}
          onScroll={handleMessagesScroll}
          className={styles.chatThread}
        >
          {filteredMessages.map((msg, idx) => (
            <MessageBubble key={msg.id || idx} msg={msg} onImageClick={handleEditExistingImage} />
          ))}
          {filteredMessages.length === 0 && (
            <p className={styles.emptyThread}>ยังไม่มีข้อความ เริ่มคุยกับเราได้เลยครับ</p>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showJumpToLatest && (
          <button
            type="button"
            className={styles.jumpLatestBtn}
            onClick={() => scrollToLatest('smooth')}
            aria-label="เลื่อนลงไปข้อความล่าสุด"
          >
            <span>ล่าสุด</span>
            <ArrowDown size={14} aria-hidden="true" />
          </button>
        )}

        {ticket.status !== 'Resolved' && ticket.status !== 'Closed' ? (
          <div className={styles.composer}>
            <button
              type="button"
              className={styles.attachBtn}
              onClick={() => setIsAttachModalOpen(true)}
              title="แนบไฟล์หรือรูปภาพ"
              aria-label="แนบไฟล์หรือรูปภาพ"
            >
              <Paperclip size={18} aria-hidden="true" />
            </button>
            <label htmlFor="ticket-chat-input" className={styles.srOnly}>
              เขียนข้อความถึงเจ้าหน้าที่
            </label>
            <input
              id="ticket-chat-input"
              type="text"
              className={styles.composerInput}
              placeholder="เขียนข้อความถึงเจ้าหน้าที่..."
              aria-label="เขียนข้อความถึงเจ้าหน้าที่"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              type="button"
              className={styles.sendBtn}
              onClick={handleSendMessage}
              disabled={sending}
              aria-label="ส่งข้อความ"
            >
              {sending ? (
                <Loader2 size={18} className={styles.spinner} aria-hidden="true" />
              ) : (
                <SendHorizontal size={18} aria-hidden="true" />
              )}
            </button>
          </div>
        ) : (
          <div className={styles.closedFooter}>
            <div className={styles.closedNotice}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <p>ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ</p>
            </div>
            {(surveyScore > 0 || (hasResponded && surveyValue > 0)) && (
              <div className={styles.csatDisplay}>
                <span className={styles.csatLabel}>คะแนนที่คุณให้:</span>
                <div className={styles.csatStars} aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={16}
                      fill={s <= (surveyScore || surveyValue) ? '#d97706' : '#e2e8f0'}
                      color={s <= (surveyScore || surveyValue) ? '#d97706' : '#e2e8f0'}
                    />
                  ))}
                </div>
                <span className={styles.csatScoreText}>{surveyScore || surveyValue}/5</span>
              </div>
            )}
            {!hasResponded && (
              <button
                type="button"
                className={styles.rateBtn}
                onClick={() => setShowSurvey(true)}
              >
                <Star size={16} aria-hidden="true" />
                <span>ให้คะแนนการบริการ</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* Current Status & Progress Stepper */}
      <section className={styles.card} aria-label="สถานะปัจจุบัน">
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>สถานะปัจจุบัน</h3>
          <span className={`${styles.statusValue} ${statusTextClass}`}>
            {getFriendlyStatus()}
          </span>
        </div>

        {String(ticket.status).toLowerCase() === 'pending' && (
          <div className={styles.pendingAlert} role="alert">
            <AlertTriangle size={18} className={styles.pendingAlertIcon} aria-hidden="true" />
            <span>ใบงานนี้ติดปัญหาชั่วคราว (Pending) - เจ้าหน้าที่อยู่ระหว่างการรอข้อมูลเพิ่มเติมหรือกำลังแก้ไขอย่างเร่งด่วน</span>
          </div>
        )}

        <TicketStatusStepper currentLevel={currentLevel} status={ticket.status} />
      </section>

      {/* Ticket Details Card */}
      <section className={styles.card} aria-label="ข้อมูลใบงาน">
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <FileText size={16} className={styles.cardIcon} aria-hidden="true" />
            <h3 className={styles.cardTitle}>ข้อมูลใบงาน</h3>
          </div>
        </div>

        <div className={styles.detailGroup}>
          <p className={styles.detailLabel}>หัวข้อที่แจ้ง</p>
          <p className={styles.detailSubject}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
        </div>

        {ticket.module && (
          <div className={styles.detailGroup}>
            <p className={styles.detailLabel}>โมดูลที่เกี่ยวข้อง (Module)</p>
            <span className={styles.moduleBadge}>{ticket.module}</span>
          </div>
        )}

        {ticket.description && (
          <div className={styles.detailGroup}>
            <p className={styles.detailLabel}>รายละเอียด</p>
            <p className={styles.detailDescription}>{ticket.description}</p>
          </div>
        )}
      </section>

      {/* Activity Logs Timeline */}
      <section className={styles.card} aria-label="ประวัติการดำเนินการ">
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <Clock size={16} className={styles.cardIcon} aria-hidden="true" />
            <h3 className={styles.cardTitle}>ประวัติการดำเนินการ</h3>
          </div>
        </div>

        {logs.length > 0 ? (
          <ol className={styles.timeline}>
            {logs.map((log, index) => (
              <li
                key={log.id}
                className={`${styles.timelineItem} ${index === 0 ? styles.timelineItemFirst : ''}`}
              >
                <span className={styles.timelineDot} aria-hidden="true" />
                <time className={styles.timelineTime} dateTime={log.created_at}>
                  {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                </time>
                <p className={styles.timelineAction}>
                  {log.action_type === 'status_change' ? `เปลี่ยนสถานะเป็น ${log.to_status}` : 'เริ่มดำเนินการ'}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.timelineEmpty}>กำลังรอเจ้าหน้าที่รับเรื่อง...</p>
        )}
      </section>

      <React.Suspense fallback={null}>
        <ChatAttachmentModal
          isOpen={isAttachModalOpen}
          onClose={() => setIsAttachModalOpen(false)}
          onConfirm={handleConfirmAttachment}
          onImageSelect={(dataUrl) => {
            setEditingImage(dataUrl);
            setIsEditorOpen(true);
            setIsAttachModalOpen(false);
          }}
        />
      </React.Suspense>

      {isEditorOpen && editingImage && (
        <React.Suspense fallback={null}>
          <ImageEditorModal
            imageUrl={editingImage}
            onClose={() => setIsEditorOpen(false)}
            onSave={async (blob) => {
              const file = new File([blob], `edit_${Date.now()}.jpg`, { type: 'image/jpeg' });
              await handleConfirmAttachment(file, 'image');
              setIsEditorOpen(false);
            }}
          />
        </React.Suspense>
      )}

      {isViewerOpen && viewingImage && (
        <React.Suspense fallback={null}>
          <ImageViewerModal
            imageUrl={viewingImage}
            onClose={() => setIsViewerOpen(false)}
            onEdit={(src: string) => {
              setIsViewerOpen(false);
              setEditingImage(src);
              setIsEditorOpen(true);
            }}
          />
        </React.Suspense>
      )}
    </div>
  );
}
