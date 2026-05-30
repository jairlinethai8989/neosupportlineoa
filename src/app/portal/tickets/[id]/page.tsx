'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  ArrowLeft, 
  Clock, 
  MessageCircle, 
  Loader2,
  AlertCircle,
  FileText,
  SendHorizontal,
  Paperclip
} from 'lucide-react';
import { useLiff } from '@/hooks/useLiff';
import { sendPortalMessageAction } from '@/app/actions/portalActions';
import { compressImage } from '@/lib/utils/imageCompression';

const ChatAttachmentModal = React.lazy(() => import('@/components/chat/ChatAttachmentModal'));
const ImageEditorModal = React.lazy(() => import('@/components/modals/ImageEditorModal'));
const ImageViewerModal = React.lazy(() => import('@/components/modals/ImageViewerModal'));

const STATUS_LEVELS: Record<string, number> = {
  'new': 1,
  'pending': 1,
  'assigned': 2,
  'in progress': 2,
  'escalated': 3,
  'fix completed': 4,
  'resolved': 4,
  'closed': 4
};

function isSurveyEligibleStatus(status: unknown) {
  const s = String(status || '').toLowerCase();
  return s === 'resolved' || s === 'closed' || s === 'fix completed';
}

// 1. Memoized Message Bubble to prevent massive DOM re-renders during chat scrolling
interface MessageBubbleProps {
  msg: any;
  onImageClick: (url: string) => void;
}

const MessageBubble = React.memo(function MessageBubble({ msg, onImageClick }: MessageBubbleProps) {
  const isCustomer = msg.sender_type === 'customer';
  const isImg = msg.message_type === 'image' || (msg.content?.startsWith('http') && msg.content?.match(/\.(jpeg|jpg|gif|png|webp|JPG|PNG)$/i));
  const isDoc = msg.message_type === 'file' || (msg.content?.startsWith('http') && msg.message_type !== 'text');

  return (
    <div style={{
      alignSelf: isCustomer ? 'flex-end' : 'flex-start',
      maxWidth: '80%',
      padding: '12px 16px',
      borderRadius: isCustomer ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
      background: isCustomer ? '#1e293b' : '#f1f5f9',
      color: isCustomer ? 'white' : '#334155',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}>
      <div style={{ fontSize: '14px', fontWeight: '500', lineHeight: '1.5' }}>
        {isImg ? (
          <img
            src={msg.content}
            style={{ maxWidth: '100%', borderRadius: '12px', cursor: 'pointer' }}
            alt="Attachment"
            onClick={() => onImageClick(msg.content)}
            title="คลิกเพื่อทำการขยายภาพ"
          />
        ) : isDoc ? (
          <a href={msg.content} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', color: 'inherit', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Paperclip size={14} /> ดูไฟล์แนบ
          </a>
        ) : (
          msg.content
        )}
      </div>
      <p style={{ fontSize: '10px', color: isCustomer ? 'rgba(255,255,255,0.6)' : '#94a3b8', marginTop: '6px', fontWeight: '600', textAlign: 'right' }}>
        {new Date(msg.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </p>
    </div>
  );
});

// 2. Memoized Ticket Status Stepper
interface TicketStatusStepperProps {
  currentLevel: number;
  status: string;
}

const TicketStatusStepper = React.memo(function TicketStatusStepper({ currentLevel, status }: TicketStatusStepperProps) {
  const isPending = status.toLowerCase() === 'pending';
  const isResolved = ['resolved', 'closed'].includes(status.toLowerCase());
  const themeColor = isResolved 
    ? '#22c55e' 
    : isPending 
      ? '#f97316' 
      : 'var(--portal-primary)';
  
  const steps = [
    { level: 1, label: 'รอดำเนินการ' },
    { level: 2, label: 'รับงานแล้ว' },
    { level: 3, label: 'ส่งต่อแก้ปัญหา' },
    { level: 4, label: 'ปิดงานแล้ว' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', margin: '12px 0 8px 0' }}>
      {/* Connector lines and nodes */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 12px' }}>
        {/* Background Track Line */}
        <div style={{
          position: 'absolute',
          left: '28px',
          right: '28px',
          height: '4px',
          background: '#e2e8f0',
          zIndex: 1,
          borderRadius: '2px'
        }} />
        
        {/* Active Progress Line */}
        <div style={{
          position: 'absolute',
          left: '28px',
          width: `${Math.max(0, Math.min(3, currentLevel - 1)) * 33.33}%`,
          height: '4px',
          background: themeColor,
          zIndex: 2,
          borderRadius: '2px',
          transition: 'width 0.4s ease'
        }} />

        {/* Circular Nodes */}
        {steps.map((step) => {
          const isActive = step.level === currentLevel;
          const isCompleted = step.level < currentLevel;
          const nodeColor = isResolved && (isCompleted || isActive) 
            ? '#22c55e' 
            : isPending && isActive
              ? '#f97316'
              : (isCompleted || isActive) 
                ? 'var(--portal-primary)' 
                : '#e2e8f0';

          return (
            <div
              key={step.level}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isActive ? 'white' : nodeColor,
                border: `3px solid ${nodeColor}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 3,
                boxShadow: isActive 
                  ? `0 0 10px ${isPending ? 'rgba(249, 115, 22, 0.4)' : 'rgba(0, 242, 254, 0.4)'}` 
                  : '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.4s ease',
                position: 'relative'
              }}
            >
              {isCompleted ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : isActive ? (
                isPending ? (
                  <span style={{ fontSize: '13px', fontWeight: '900', color: '#f97316', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    ⚠️
                  </span>
                ) : (
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: isResolved ? '#22c55e' : 'var(--portal-primary)',
                    boxShadow: `0 0 6px ${isResolved ? '#22c55e' : 'var(--portal-primary)'}`,
                    display: 'inline-block'
                  }} />
                )
              ) : (
                <span style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8' }}>
                  {step.level}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Step Labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
        {steps.map((step) => {
          const isActive = step.level === currentLevel;
          const isCompleted = step.level < currentLevel;
          let labelColor = '#64748b'; // Muted slate
          if (isActive) {
            labelColor = isResolved 
              ? '#166534' 
              : isPending 
                ? '#c2410c' 
                : 'var(--portal-primary)';
          } else if (isCompleted) {
            labelColor = '#334155'; // Darker text for completed
          }

          return (
            <div
              key={step.level}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: '11px',
                fontWeight: isActive ? '900' : '800',
                color: labelColor,
                transition: 'color 0.4s ease',
                lineHeight: '1.2',
                maxWidth: '80px'
              }}
            >
              {step.label}
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default function TicketDetailPage() {
  const { id } = useParams();
  const ticketId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { isReady, profile, error: liffError, setMockLogin } = useLiff();
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
  const [conversationId, setConversationId] = useState<string | null>(null);
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

    const { data } = await supabase
      .from('csat_surveys')
      .select('score, rating, responded_at')
      .eq('ticket_id', ticketId)
      .maybeSingle();

    const value = data?.score || data?.rating || 0;
    const responded = Boolean(data?.responded_at || value);

    if (responded) {
      setHasResponded(true);
      if (value) setSurveyScore(value);
    }

    return {
      responded,
      value,
      hasSurveyRecord: Boolean(data),
    };
  }, [ticketId]);

  // 1. Fetch initial ticket data once isReady and ticketId are available
  useEffect(() => {
    if (!ticketId) return;

    async function fetchTicketData() {
      if (!ticketId) return;
      setLoading(true);
      try {
        // Combined initial query with joins to avoid sequential waterfalls (fetched only once!)
        const { data: ticketData, error: e1 } = await supabase
          .from('tickets')
          .select(`*, assigned_agent:profiles!assigned_agent_id(*)`)
          .eq('id', ticketId)
          .maybeSingle();

        if (e1) throw e1;
        if (!ticketData) {
           setLoading(false);
           return;
        }

        // SECURITY: Verify owner customer ID mapping with profile.userId
        if (profile?.userId && ticketData.customer_id) {
          const { data: ownerCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('line_user_id', profile.userId)
            .maybeSingle();

          if (!ownerCustomer || ownerCustomer.id !== ticketData.customer_id) {
            console.warn('Access denied: user does not own this ticket');
            setTicket(null);
            setLoading(false);
            return;
          }
        }

        setTicket(ticketData);

        // Fetch conversation directly in parallel with message loaders
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .eq('current_ticket_id', ticketId)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        
        let cid = convData?.id || null;

        if (!cid && ticketData.customer_id) {
          const { data: convFallback } = await supabase
            .from('conversations')
            .select('id')
            .eq('customer_id', ticketData.customer_id)
            .eq('status', 'active')
            .order('last_message_at', { ascending: false, nullsFirst: false })
            .limit(1)
            .maybeSingle();
          cid = convFallback?.id || null;
        }

        if (cid) {
          setConversationId(cid);
          conversationIdRef.current = cid;
        }

        const loadMessages = async (cidToUse: string | null) => {
          let messagesQuery = supabase.from('messages').select('id, content, sender_type, message_type, created_at, ticket_id, conversation_id');
          if (cidToUse) {
            messagesQuery = messagesQuery.or(`ticket_id.eq.${ticketId},conversation_id.eq.${cidToUse}`);
          } else {
            messagesQuery = messagesQuery.eq('ticket_id', ticketId);
          }
          const { data } = await messagesQuery.order('created_at', { ascending: true });
          if (data) setMessages(data);
        };

        const [lRes, surveyState] = await Promise.all([
           supabase.from('ticket_logs').select('id, created_at, action_type, to_status').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
           loadSurveyState(),
           loadMessages(cid)
        ]);

        if (lRes.data) setLogs(lRes.data);
        if (
          surveyState &&
          !surveyState.responded &&
          isSurveyEligibleStatus(ticketData.status)
        ) {
          router.push(`/portal?survey_ticket_id=${ticketId}`);
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

    // Helper: fetch all messages for this ticket (uses ref for latest conversationId)
    const refetchMessages = () => {
      const cid = conversationIdRef.current;
      let q = supabase
        .from('messages')
        .select('id, content, sender_type, message_type, created_at, ticket_id, conversation_id');
      q = cid
        ? q.or(`ticket_id.eq.${ticketId},conversation_id.eq.${cid}`)
        : q.eq('ticket_id', ticketId);
      q.order('created_at', { ascending: true }).then(({ data }: any) => {
        if (data) setMessages(data);
      });
    };

    // Helper: deduplicated message insert handler
    const handleMessageInsert = (msg: any) => {
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
        setTicket((prev: any) => prev ? { ...prev, ...nextTicket } : prev);
        supabase
          .from('ticket_logs')
          .select('id, created_at, action_type, to_status')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false })
          .then(({ data }: any) => { if (data) setLogs(data); });
        if (isSurveyEligibleStatus(nextTicket?.status) && !hasRespondedRef.current) {
          router.push(`/portal?survey_ticket_id=${ticketId}`);
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
    if (isSurveyEligibleStatus(ticket?.status) && !hasResponded) {
      const timer = setTimeout(() => {
        router.push(`/portal?survey_ticket_id=${ticketId}`);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [ticket?.status, hasResponded, ticketId, router]);

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
         'text'
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
         dbType
      );
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!isReady || loading) return (
     <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd' }}>
        <Loader2 className="animate-spin" size={32} color="var(--portal-primary)" />
     </div>
  );

  if (liffError || !profile) {
    return (
      <div className="flex-center portal-glass" style={{ height: '70vh', margin: '20px', padding: '32px', textAlign: 'center', flexDirection: 'column', gap: '20px', border: '1px solid #fee2e2', background: 'white' }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800', color: '#1e293b' }}>ไม่สามารถเข้าถึงได้</h2>
        <p style={{ color: '#64748b', fontSize: '14px' }}>กรุณาเข้าใช้งานผ่านแอปพลิเคชัน LINE</p>
        <button 
           type="button"
           onClick={() => setMockLogin('U_MOCK_ADMIN', 'Guest Admin')}
           style={{ padding: '12px 24px', borderRadius: '12px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', fontWeight: '700', marginTop: '16px', cursor: 'pointer' }}
        >
           ทดสอบระบบ (Mock Login)
        </button>
      </div>
    );
  }

  if (!ticket) return (
     <div className="flex-center" style={{ height: '100vh', background: '#fbfcfd', color: '#1e293b', flexDirection: 'column', gap: '16px' }}>
        <AlertCircle size={48} color="#ef4444" />
        <h2 style={{ fontSize: '18px', fontWeight: '800' }}>ไม่พบข้อมูลใบงาน</h2>
        <button type="button" onClick={() => router.push('/portal')} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
           กลับสู่หน้าหลัก
        </button>
     </div>
  );

  let currentLevel = STATUS_LEVELS[String(ticket.status).toLowerCase()] || 1;
  if (currentLevel === 1 && ticket.assigned_agent_id) {
    currentLevel = 2;
  }

  const getFriendlyStatus = () => {
    const s = String(ticket.status).toLowerCase();
    const hasAgent = !!ticket.assigned_agent_id;
    if (s === 'resolved') return 'แก้ไขเสร็จสิ้น (Resolved)';
    if (s === 'closed') return 'ปิดใบงานแล้ว (Closed)';
    if (s === 'fix completed') return 'แก้ไขเสร็จสิ้น (Fix Completed)';
    if (s === 'escalated') return 'ส่งต่อผู้เชี่ยวชาญ (Escalated)';
    if (s === 'assigned') return 'รับงานแล้ว (Assigned)';
    if (s === 'in progress') return 'กำลังดำเนินการ (In Progress)';
    if (s === 'pending') return 'ติดปัญหา (Pending)';
    if (hasAgent) return 'รับงานแล้ว (Assigned)';
    return 'รอดำเนินการ (New)';
  };

  const handleSubmitSurvey = async () => {
    if (surveyValue === 0) return;
    setSubmittingSurvey(true);
    try {
      const { error } = await supabase.from('csat_surveys').upsert({
        ticket_id: ticketId,
        score: surveyValue,
        rating: surveyValue,
        comment: surveyComment,
        responded_at: new Date().toISOString()
      }, { onConflict: 'ticket_id' });

      if (error) throw error;
      setHasResponded(true);
      setSurveyScore(surveyValue);
      setTimeout(() => setShowSurvey(false), 2000);
    } catch (err: any) {
      alert('ไม่สามารถบันทึกการประเมินได้: ' + err.message);
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const filteredMessages = messages.filter((m: any) => m.message_type !== 'unsent');

  return (
    <div className="portal-container" style={{ animation: 'fadeIn 0.5s ease-out', position: 'relative' }}>
       {/* Survey Modal Popup */}
       {showSurvey && (
         <div className="portal-survey-overlay">
           <div className="portal-survey-modal" style={{
             animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
           }}>
             {/* Thank you screen shown after submit */}
             {hasResponded ? (
               <div style={{ textAlign: 'center', padding: '16px 0' }}>
                 <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
                 <h3 style={{ fontSize: '22px', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>ขอบคุณมากครับ!</h3>
                 <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>คะแนนของคุณถูกบันทึกเรียบร้อยแล้ว</p>
                 <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', marginBottom: '24px' }}>
                   {[1, 2, 3, 4, 5].map((s) => (
                     <svg key={s} width="32" height="32" viewBox="0 0 24 24"
                       fill={s <= (surveyScore || surveyValue) ? '#f59e0b' : '#e2e8f0'}
                       stroke={s <= (surveyScore || surveyValue) ? '#f59e0b' : '#e2e8f0'}
                       strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                     >
                       <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                     </svg>
                   ))}
                 </div>
               </div>
             ) : (
               <>
                 <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                   <div style={{ 
                     display: 'inline-flex', padding: '12px', background: '#f0f9ff', 
                     borderRadius: '50%', marginBottom: '16px', color: 'var(--portal-primary)' 
                   }}>
                     <Clock size={24} />
                   </div>
                   <h3 style={{ fontSize: '20px', fontWeight: '900', color: '#1e293b', marginBottom: '8px' }}>ประเมินความพึงพอใจ</h3>
                   <p style={{ fontSize: '14px', color: '#64748b' }}>งานหมายเลข #{ticket.ticket_no} ได้รับการแก้ไขแล้ว ช่วยให้คะแนนเราหน่อยนะครับ</p>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
                   {[1, 2, 3, 4, 5].map((star) => (
                     <button
                       key={star}
                       type="button"
                       onClick={() => setSurveyValue(star)}
                       onMouseEnter={() => setSurveyHover(star)}
                       onMouseLeave={() => setSurveyHover(0)}
                       style={{ 
                         background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
                         transition: 'transform 0.2s', padding: '4px'
                       }}
                     >
                       <svg 
                         width="36" height="36" viewBox="0 0 24 24" 
                         fill={(surveyHover || surveyValue) >= star ? '#f59e0b' : 'none'} 
                         stroke={(surveyHover || surveyValue) >= star ? '#f59e0b' : '#cbd5e1'} 
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       >
                         <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                       </svg>
                     </button>
                   ))}
                 </div>
                 <div style={{ textAlign: 'center', height: '20px', fontSize: '12px', color: '#f59e0b', fontWeight: '700', marginBottom: '24px' }}>
                   {surveyValue === 5 ? 'ยอดเยี่ยมที่สุด' : surveyValue === 4 ? 'ดีมาก' : surveyValue === 3 ? 'ดี' : surveyValue === 2 ? 'พอใช้' : surveyValue === 1 ? 'ควรปรับปรุง' : ''}
                 </div>

                 <textarea 
                   placeholder="ข้อเสนอแนะเพิ่มเติม (ถ้ามี)..."
                   value={surveyComment}
                   onChange={(e) => setSurveyComment(e.target.value)}
                   className="portal-survey-comment"
                 />

                 <div style={{ display: 'flex', gap: '12px' }}>
                   <button 
                     type="button"
                     onClick={() => setShowSurvey(false)}
                     style={{ 
                       flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0',
                       background: 'white', color: '#64748b', fontWeight: '700', cursor: 'pointer'
                     }}
                   >
                     ข้ามก่อน
                   </button>
                   <button 
                     type="button"
                     onClick={handleSubmitSurvey}
                     disabled={submittingSurvey || surveyValue === 0}
                     style={{ 
                       flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                       background: 'var(--portal-primary)', color: 'white', fontWeight: '800',
                       cursor: 'pointer', opacity: (surveyValue === 0 || submittingSurvey) ? 0.5 : 1
                     }}
                   >
                     {submittingSurvey ? 'กำลังส่ง...' : 'ส่งผลประเมิน'}
                   </button>
                 </div>
               </>
             )}
           </div>
         </div>
       )}

       <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '0 4px' }}>
          <button type="button" onClick={() => router.push('/portal')} style={{ padding: '8px', borderRadius: '12px', border: '1px solid var(--portal-border)', background: 'white', color: '#1e293b', cursor: 'pointer' }}>
             <ArrowLeft size={18} />
          </button>
          <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>ตั๋วเลขที่ #{ticket.ticket_no}</h2>
       </div>

       <section className="portal-glass" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', height: '450px', background: 'white', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--portal-border)', paddingBottom: '12px' }}>
             <MessageCircle size={16} color="var(--portal-primary)" />
             <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>สนทนากับเจ้าหน้าที่</h3>
          </div>

          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '14px', padding: '0 4px' }}
            className="no-scrollbar"
          >
             {filteredMessages.map((msg, idx) => (
                <MessageBubble key={msg.id || idx} msg={msg} onImageClick={handleEditExistingImage} />
             ))}
             {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--portal-text-muted)', fontSize: '13px', marginTop: '40px' }}>ยังไม่มีข้อความ เริ่มคุยกับเราได้เลยครับ</p>}
             <div ref={messagesEndRef} />
          </div>

          {showJumpToLatest && (
            <button
              type="button"
              onClick={() => scrollToLatest('smooth')}
              style={{
                position: 'absolute',
                right: '22px',
                bottom: '84px',
                border: '1px solid rgba(15, 23, 42, 0.08)',
                background: '#ffffff',
                color: '#0f172a',
                borderRadius: '999px',
                padding: '8px 12px',
                fontSize: '12px',
                fontWeight: '800',
                boxShadow: '0 10px 20px rgba(15, 23, 42, 0.12)',
                cursor: 'pointer',
                zIndex: 5,
              }}
            >
              Latest ↓
            </button>
          )}

          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' ? (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '16px' }}>
               <button 
                 type="button"
                 onClick={() => setIsAttachModalOpen(true)} 
                 title="แนบไฟล์หรือรูปภาพ"
                 style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: 'white', color: '#64748b', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }} 
                 className="flex-center"
               >
                  <Paperclip size={18} />
               </button>
               <input 
                 type="text" 
                 placeholder="เขียนข้อความถึงเจ้าหน้าที่..." 
                 value={newMessage}
                 onChange={(e) => setNewMessage(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                 style={{ flex: 1, background: 'transparent', border: 'none', borderRadius: '10px', padding: '10px', color: '#1e293b', outline: 'none', fontSize: '14px' }}
               />
               <button 
                 type="button"
                 onClick={handleSendMessage}
                 disabled={sending}
                 style={{ width: '40px', height: '40px', borderRadius: '12px', border: 'none', background: '#1e293b', color: 'white', cursor: 'pointer' }}
                 className="flex-center"
               >
                    {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
               </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
               <div style={{ padding: '16px', borderRadius: '16px', background: '#f0fdf4', border: '1px solid #dcfce7', textAlign: 'center' }}>
                  <p style={{ fontSize: '13px', color: '#166534', fontWeight: '700' }}>
                     ใบงานนี้เสร็จสมบูรณ์แล้ว ระบบปิดการสนทนาขอบคุณที่ใช้บริการครับ
                  </p>
               </div>
               {/* Show CSAT score immediately after survey submission */}
               {(surveyScore > 0 || (hasResponded && surveyValue > 0)) && (
                 <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                   <span style={{ fontSize: '12px', fontWeight: '700', color: '#92400e' }}>คะแนนที่คุณให้:</span>
                   <div style={{ display: 'flex', gap: '2px' }}>
                     {[1, 2, 3, 4, 5].map((s) => (
                       <svg key={s} width="16" height="16" viewBox="0 0 24 24"
                         fill={s <= (surveyScore || surveyValue) ? '#f59e0b' : '#e2e8f0'}
                         stroke={s <= (surveyScore || surveyValue) ? '#f59e0b' : '#e2e8f0'}
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                       >
                         <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                       </svg>
                     ))}
                   </div>
                   <span style={{ fontSize: '12px', fontWeight: '800', color: '#f59e0b' }}>{surveyScore || surveyValue}/5</span>
                 </div>
               )}
               {/* Button to re-open survey if not responded yet */}
               {!hasResponded && (
                 <button
                   type="button"
                   onClick={() => setShowSurvey(true)}
                   style={{ padding: '12px', borderRadius: '12px', border: '1px solid #fde68a', background: '#fffbeb', color: '#92400e', fontWeight: '700', fontSize: '13px', cursor: 'pointer' }}
                 >
                   ⭐ ให้คะแนนการบริการ
                 </button>
               )}
            </div>
          )}
       </section>

       <section className="portal-glass" style={{ padding: '24px', marginBottom: '24px', background: 'white', border: '1px solid var(--portal-border)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', alignItems: 'center' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>สถานะปัจจุบัน</h3>
              <span style={{ 
                fontSize: '13px', 
                fontWeight: '900', 
                color: ['resolved', 'closed'].includes(String(ticket.status).toLowerCase()) 
                  ? '#22c55e' 
                  : String(ticket.status).toLowerCase() === 'pending'
                    ? '#f97316'
                    : 'var(--portal-primary)' 
              }}>
                 {getFriendlyStatus()}
              </span>
           </div>

           {String(ticket.status).toLowerCase() === 'pending' && (
             <div style={{
               padding: '12px 16px',
               borderRadius: '12px',
               background: '#fff7ed',
               border: '1px solid #ffedd5',
               color: '#c2410c',
               fontSize: '13px',
               fontWeight: '700',
               marginBottom: '16px',
               display: 'flex',
               alignItems: 'center',
               gap: '8px'
             }}>
               <span style={{ fontSize: '16px' }}>⚠️</span>
               <span>ใบงานนี้ติดปัญหาชั่วคราว (Pending) - เจ้าหน้าที่อยู่ระหว่างการรอข้อมูลเพิ่มเติมหรือกำลังแก้ไขอย่างเร่งด่วน</span>
             </div>
           )}

          <TicketStatusStepper currentLevel={currentLevel} status={ticket.status} />
       </section>

        <div className="portal-glass" style={{ padding: '20px', marginBottom: '24px', background: 'white' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <FileText size={16} color="var(--portal-primary)" />
              <p style={{ fontSize: '12px', fontWeight: '800', color: 'var(--portal-text-muted)', textTransform: 'uppercase' }}>ข้อมูลใบงาน</p>
           </div>
           
           <div style={{ marginBottom: '16px' }}>
              <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>หัวข้อที่แจ้ง</p>
              <p style={{ fontSize: '17px', fontWeight: '800', color: '#1e293b' }}>{ticket.subject || 'แจ้งปัญหาทั่วไป'}</p>
           </div>

           {ticket.module && (
              <div style={{ marginBottom: '16px' }}>
                 <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>โมดูลที่เกี่ยวข้อง (Module)</p>
                 <div style={{ display: 'inline-flex', padding: '6px 12px', background: '#7c3aed', color: 'white', borderRadius: '10px', fontSize: '13px', fontWeight: '800' }}>
                    {ticket.module}
                 </div>
              </div>
           )}

           {ticket.description && (
              <div>
                 <p style={{ fontSize: '10px', color: '#64748b', fontWeight: '800', textTransform: 'uppercase', marginBottom: '4px' }}>รายละเอียด</p>
                 <p style={{ fontSize: '14px', color: '#64748b', lineHeight: '1.6' }}>{ticket.description}</p>
              </div>
           )}
        </div>

       <section className="portal-glass" style={{ padding: '24px', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
             <Clock size={16} color="var(--portal-primary)" />
             <h3 style={{ fontSize: '13px', fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>ประวัติการดำเนินการ</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', borderLeft: '1px solid #e2e8f0', marginLeft: '8px', paddingLeft: '20px' }}>
             {logs.map((log, index) => (
                <div key={log.id} style={{ position: 'relative', marginBottom: '20px' }}>
                   <div style={{ 
                      position: 'absolute', 
                      left: '-24.5px', 
                      top: '4px', 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: index === 0 ? 'var(--portal-primary)' : '#cbd5e1',
                      border: '2px solid white'
                   }} />
                   <p style={{ fontSize: '10px', color: 'var(--portal-text-muted)', marginBottom: '4px', fontWeight: '600' }}>
                      {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                   </p>
                   <p style={{ fontSize: '13px', fontWeight: '700', color: '#334155' }}>
                      {log.action_type === 'status_change' ? `เปลี่ยนสถานะเป็น ${log.to_status}` : 'เริ่มดำเนินการ'}
                   </p>
                </div>
              ))}
              {logs.length === 0 && <p style={{ fontSize: '12px', color: 'var(--portal-text-muted)' }}>กำลังรอเจ้าหน้าที่รับเรื่อง...</p>}
           </div>
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
                onEdit={(src) => {
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
