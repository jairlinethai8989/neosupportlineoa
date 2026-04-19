'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import ImageViewerModal from '@/components/modals/ImageViewerModal';
import SummaryExportModal from '@/components/modals/SummaryExportModal';
import { ResolveTicketModal } from '@/components/inbox/ResolveTicketModal';
import { ticketService } from '@/lib/services/ticketService';
import { TicketHeader } from '@/components/tickets/TicketHeader';
import { TicketChat } from '@/components/tickets/TicketChat';
import { TicketSidebar, getTicketDuration } from '@/components/tickets/TicketSidebar';
import { Clock } from 'lucide-react';
import { deleteMessageAction, closeConversationAction } from '@/app/actions/messageActions';
import { useNotificationContext } from '@/contexts/NotificationContext';
import {
  getTicketDetailActionFailedToast,
  getTicketDetailChatMustEndToast,
  confirmTicketDetailDeleteMessage,
  confirmTicketDetailEndChat,
  getTicketDetailResolvedToast,
  getTicketDetailSystemResolveMessage,
  getTicketDetailValidationToast,
} from '@/lib/tickets/detailFeedback';
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

const pageGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '6.5fr 3.5fr',
  gap: '24px',
  alignItems: 'start',
  marginBottom: '24px',
};

const activityGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '24px',
};

const loadingContainerStyle: React.CSSProperties = { height: '70vh' };

function normalizeRouteId(rawId: string | string[] | undefined): string | null {
  if (!rawId) return null;
  return Array.isArray(rawId) ? rawId[0] : rawId;
}

export default function StaffTicketDetailPage() {
  const params = useParams();
  const ticketId = normalizeRouteId(params.id);
  const { addToast } = useNotificationContext();
  const adminFileRef = useRef<HTMLInputElement>(null);
  const conversationIdRef = useRef<string | null>(null);

  const [ticket, setTicket] = useState<TicketDetailTicket | null>(null);
  const [user, setUser] = useState<TicketDetailUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [logs, setLogs] = useState<TicketDetailLog[]>([]);
  const [messages, setMessages] = useState<TicketDetailMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isChatActive, setIsChatActive] = useState(false);

  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [selectedDept, setSelectedDept] = useState('');
  const [availableDepts, setAvailableDepts] = useState<any[]>([]);
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedIssueType, setSelectedIssueType] = useState('');
  const [availableIssueTypes, setAvailableIssueTypes] = useState<string[]>([]);
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [personalQuickReplies, setPersonalQuickReplies] = useState<string[]>([]);
  const [personalResTemplates, setPersonalResTemplates] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resSummary, setResSummary] = useState('');
  const [editingImage, setEditingImage] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const fetchData = useCallback(async () => {
    if (!ticketId) return;

    try {
      const { data: ticketData, error } = await supabase
        .from('tickets')
        .select(`
          *,
          customers!tickets_customer_id_fkey (*),
          assigned_agent:profiles!assigned_agent_id(*),
          department_data:departments!current_department_id(id, name)
        `)
        .eq('id', ticketId)
        .maybeSingle();

      if (error) throw error;
      if (ticketData) {
        const normalizedTicket = ticketData as TicketDetailTicket;
        setTicket(normalizedTicket);
        setStatus(normalizedTicket.status || '');
        setPriority(normalizedTicket.priority || '');
        setSelectedDept(normalizedTicket.current_department_id || '');
        setSelectedModule(normalizedTicket.module || '');

        const { data: logData } = await supabase
          .from('ticket_logs')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: false });

        if (logData) setLogs(logData as TicketDetailLog[]);

        const { data: conv } = await supabase
          .from('conversations')
          .select('id, status')
          .eq('customer_id', normalizedTicket.customer_id)
          .eq('status', 'active')
          .maybeSingle();

        if (conv) {
          setConversationId(conv.id);
          conversationIdRef.current = conv.id;
          setIsChatActive(true);
        } else {
          setConversationId(null);
          conversationIdRef.current = null;
          setIsChatActive(false);
        }

        const cid = conversationIdRef.current;
        const query = cid
          ? supabase
              .from('messages')
              .select('*')
              .or(`ticket_id.eq.${ticketId},conversation_id.eq.${cid}`)
          : supabase.from('messages').select('*').eq('ticket_id', ticketId);
        const { data: msgData } = await query.order('created_at', { ascending: true });
        if (msgData) setMessages(msgData as TicketDetailMessage[]);
      }

      const { data: deptData } = await supabase
        .from('departments')
        .select('id, name')
        .eq('dept_type', 'organization')
        .eq('is_active', true)
        .order('name');

      if (deptData) setAvailableDepts(deptData.map(d => ({ label: d.name, value: d.id })));

      const { data: companyData } = await supabase
        .from('company_settings')
        .select('id, modules, issue_types')
        .limit(1)
        .single();
      setAvailableModules(
        companyData?.modules && companyData.modules.length > 0
          ? companyData.modules
          : DEFAULT_MODULES
      );
      setAvailableIssueTypes(
        companyData?.issue_types && companyData.issue_types.length > 0
          ? companyData.issue_types
          : []
      );

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
        if (profile) {
          const mergedUser: TicketDetailUser = {
            id: authUser.id,
            role: (profile as { role?: string | null }).role || null,
          };
          setUser(mergedUser);
          setPersonalQuickReplies((profile as { quick_replies?: string[] }).quick_replies || []);
          setPersonalResTemplates((profile as { resolution_templates?: string[] }).resolution_templates || []);
        } else {
          setUser({ id: authUser.id });
        }
      }
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('update ticket', error));
    } finally {
      setLoading(false);
    }
  }, [addToast, ticketId]);

  useEffect(() => {
    fetchData();
    if (!ticketId) return;

    const channel = supabase
      .channel(`staff-ticket-${ticketId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new as unknown as TicketDetailMessage;
        const cid = conversationIdRef.current;
        if (message.ticket_id === ticketId || (cid && message.conversation_id === cid)) {
          setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [...prev, message]));
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMessage = payload.new as unknown as TicketDetailMessage;
        setMessages((prev) => prev.map((item) => (item.id === updatedMessage.id ? updatedMessage : item)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
        setMessages((prev) => prev.filter((item) => item.id !== payload.old.id));
      })
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
      supabase.removeChannel(channel);
      conversationIdRef.current = null;
    };
  }, [fetchData, ticketId]);

  const updateTicketField = useCallback(
    async (field: 'status' | 'priority' | 'department' | 'module', value: string) => {
      if (!ticketId) return;

      const dbField = field === 'department' ? 'current_department_id' : field;

      try {
        await supabase.from('tickets').update({ [dbField]: value }).eq('id', ticketId);
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
      const extension = file.name.split('.').pop() || 'dat';
      const fileName = `admin_${ticketId}_${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, file);
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
          message_type: file.type.startsWith('image/') ? 'image' : 'file',
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

  const handleScreenCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          video.play();
          resolve(true);
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d')?.drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());

      setEditingImage(canvas.toDataURL('image/jpeg', 0.9));
      setShowEditor(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'NotAllowedError') return;
      addToast(getTicketDetailActionFailedToast('capture image', error));
    }
  }, [addToast]);

  const handleEditorSave = useCallback(async (blob: Blob) => {
    if (!ticketId) return;

    setSending(true);
    try {
      const fileName = `edited_${ticketId}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('chat_media').upload(fileName, blob, {
        contentType: 'image/jpeg',
      });
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
          message_type: 'image',
          content: publicUrl,
        },
      ]);
      setShowEditor(false);
      setEditingImage(null);
    } catch (error) {
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
    if (isChatActive) {
      addToast(getTicketDetailChatMustEndToast());
      return;
    }

    setUpdating(true);
    try {
      await ticketService.resolve(ticketId, user.id, resSummary, selectedModule, selectedIssueType);
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
      addToast(getTicketDetailResolvedToast(ticket.ticket_no));
      setShowResolveModal(false);
      setTicket((prev) => (prev ? { ...prev, status: 'Resolved' } : prev));
      setStatus('Resolved');
    } catch (error) {
      addToast(getTicketDetailActionFailedToast('resolve ticket', error));
    } finally {
      setUpdating(false);
    }
  }, [
    addToast,
    conversationId,
    isChatActive,
    resSummary,
    selectedIssueType,
    selectedModule,
    ticket,
    ticketId,
    user?.id,
  ]);

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
    <div className="animate-page-in">
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
        onExportClick={() => setShowExportModal(true)}
      />

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
          onScreenCapture={handleScreenCapture}
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
          showActivity={false}
        />
      </div>

      <div style={activityGridStyle}>
        {/* Time Tracking Box */}
        <div className="glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Clock size={20} color="var(--primary)" />
            <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Time Tracking Metrics
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
             <div>
                <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Reported At</label>
                <p style={{ fontSize: '13px', fontWeight: '700' }}>
                   {ticket.created_at ? new Date(ticket.created_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                </p>
             </div>

             {ticket.resolved_at && (
               <>
                 <div>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Resolved At</label>
                    <p style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary)' }}>
                       {new Date(ticket.resolved_at).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                 </div>
                 <div style={{ paddingLeft: '20px', borderLeft: '1px solid var(--border)' }}>
                    <label style={{ fontSize: '10px', fontWeight: '800', color: 'var(--primary)', display: 'block', marginBottom: '6px' }}>Resolution Duration</label>
                    <p style={{ fontSize: '18px', fontWeight: '900' }}>{getTicketDuration(ticket.created_at || '', ticket.resolved_at)}</p>
                 </div>
               </>
             )}

             {!ticket.resolved_at && (
                <div style={{ gridColumn: 'span 2', padding: '12px', background: 'rgba(255,165,0,0.05)', borderRadius: '12px', border: '1px dashed orange', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: '10px', fontWeight: '800', color: 'orange' }}>PENDING DURATION</span>
                   <span style={{ fontSize: '16px', fontWeight: '900' }}>{getTicketDuration(ticket.created_at || '')}</span>
                </div>
             )}
          </div>
        </div>

        {/* Recent Activity Box */}
        <div className="glass" style={{ padding: '24px' }}>
          <label style={{ fontSize: '11px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '20px', display: 'block' }}>
             Recent Activity Timeline
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
             {logs.slice(0, 4).map((log, idx) => (
                <div key={log.id || idx} className="glass-light" style={{ padding: '12px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                   <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleDateString()}</span>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                   </div>
                   <p style={{ fontSize: '12px', fontWeight: '700' }}>
                      {log.action_type === 'status_change' ? `Status → ${log.to_status}` : log.note || log.action_type}
                   </p>
                </div>
             ))}
             {logs.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No logs recorded</p>}
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
          onEdit={(imageUrl) => {
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
        onExport={() => {}}
        ticketNo={ticket.ticket_no || ''}
      />
    </div>
  );
}
