'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { useInboxProfileSettings } from '@/hooks/useInboxProfileSettings';
import { useInboxConversation } from '@/hooks/useInboxConversation';
import {
  getInboxDeleteFailedMessage,
  getInboxUploadFailedMessage,
} from '@/lib/inbox/feedback';
import { getInboxConversationById, getInboxConversationByTicketId } from '@/lib/inbox/queries';
import { deleteInboxMessage, uploadInboxChatMedia } from '@/lib/inbox/mutations';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';

const ImageEditorModal = React.lazy(() => import('@/components/modals/ImageEditorModal'));
const ImageViewerModal = React.lazy(() => import('@/components/modals/ImageViewerModal'));
const ChatWindow = React.lazy(() =>
  import('@/components/inbox/ChatWindow').then((module) => ({ default: module.ChatWindow }))
);
const TicketSidebar = React.lazy(() =>
  import('@/components/inbox/TicketSidebar').then((module) => ({ default: module.TicketSidebar }))
);
const ResolveTicketModal = React.lazy(() =>
  import('@/components/inbox/ResolveTicketModal').then((module) => ({ default: module.ResolveTicketModal }))
);

function hasSelectedConversationChanged(
  prev: InboxConversation | null,
  next: InboxConversation
) {
  if (!prev) return true;

  // Potential stale data: If we locally closed it, don't revert to active 
  // until we are sure the server has a real reason (like a new ticket).
  const isStaleSessionRevert =
    prev.status === 'closed' &&
    next.status === 'active' &&
    prev.is_active === false &&
    next.is_active === true;

  return (
    prev.last_message_at !== next.last_message_at ||
    (prev.status !== next.status && !isStaleSessionRevert) ||
    prev.current_ticket_id !== next.current_ticket_id ||
    (prev.is_active !== next.is_active && !isStaleSessionRevert) ||
    prev.customers?.display_name !== next.customers?.display_name ||
    prev.customers?.avatar_url !== next.customers?.avatar_url
  );
}

function InboxContent() {
  const { t } = useStaffLocale();
  const { addToast } = useNotificationContext();
  const [selectedChat, setSelectedChat] = useState<InboxConversation | null>(null);
  const [viewMode, setViewMode] = useState<InboxViewMode>('list');
  const [showCanned, setShowCanned] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState('');
  const [editingImage, setEditingImage] = useState('');
  const [page, setPage] = useState(1);
  const [showCloseSessionConfirm, setShowCloseSessionConfirm] = useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = useState<string | null>(null);
  const lastHydratedCidRef = React.useRef<string | null>(null);
  const showInfoToast = (title: string, body: string) => {
    addToast({
      id: `inbox-info-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      type: 'message',
      title,
      body,
    });
  };

  const { conversations, hasNextPage, loading: inboxLoading } = useRealtimeInbox({
    page,
    pageSize: 20
  });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');
  const tid = searchParams.get('tid');

  const {
    agent,
    availableModules,
    availableIssueTypes,
    personalQuickReplies,
    personalResTemplates,
    handleAddCanned,
    handleEditCanned,
    handleDeleteCanned,
  } = useInboxProfileSettings();

  const {
    messages,
    newMessage,
    setNewMessage,
    currentTicket,
    sending,
    setSending,
    showResolveModal,
    setShowResolveModal,
    resSummary,
    setResSummary,
    selectedModule,
    setSelectedModule,
    selectedIssueType,
    setSelectedIssueType,
    hasMoreMessages,
    loadingMoreMessages,
    messagesEndRef,
    handleSendMessage,
    handleLoadOlderMessages,
    handleClaim,
    handleResolve,
    handleExecuteResolve,
    handleCloseSession,
  } = useInboxConversation({
    selectedChat,
    setSelectedChat,
    agent,
    addToast,
  });



  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;

    setSending(true);
    try {
      if (!agent?.id) {
        throw new Error('Agent session is missing');
      }
      await uploadInboxChatMedia({
        file,
        conversationId: selectedChat.id,
        ticketId: currentTicket?.id || selectedChat.current_ticket_id || null,
        staffId: agent.id,
      });
    } catch (error: unknown) {
      addToast({
        id: `upload-fail-${Date.now()}`,
        type: 'ticket',
        title: 'อัปโหลดไฟล์ไม่สำเร็จ',
        body: getInboxUploadFailedMessage(error)
      });
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const openImageInEditor = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') return;
      setEditingImage(result);
      setIsEditorOpen(true);
      setIsViewerOpen(false);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (!cid && !tid) return;

    const target = cid
      ? conversations.find((conversation) => conversation.id === cid)
      : conversations.find((conversation) => conversation.current_ticket_id === tid);
    if (target) {
      setSelectedChat(target);
      if (window.innerWidth <= 1000) {
        setViewMode('chat');
      }
      lastHydratedCidRef.current = cid || `ticket:${tid}`;
      return;
    }

    const hydrationKey = cid || `ticket:${tid}`;
    if (lastHydratedCidRef.current === hydrationKey) return;

    let cancelled = false;
    (async () => {
      try {
        const fetched = cid
          ? await getInboxConversationById(cid)
          : tid
            ? await getInboxConversationByTicketId(tid)
            : null;
        if (!fetched || cancelled) return;
        setSelectedChat(fetched);
        if (window.innerWidth <= 1000) {
          setViewMode('chat');
        }
        lastHydratedCidRef.current = hydrationKey;
      } catch (error) {
        console.error('Failed to hydrate inbox conversation:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cid, tid, conversations]);

  useEffect(() => {
    if (!inboxLoading && conversations.length === 0 && page > 1) {
      setPage(1);
    }
  }, [conversations.length, inboxLoading, page]);

  useEffect(() => {
    setSelectedChat((prev) => {
      if (!prev) return prev;

      const updatedConversation = conversations.find(
        (conversation) => conversation.id === prev.id
      );
      if (!updatedConversation) return prev;

      if (!hasSelectedConversationChanged(prev, updatedConversation)) {
        return prev;
      }

      const isStaleSessionRevert =
        prev.status === 'closed' &&
        updatedConversation.status === 'active' &&
        prev.is_active === false &&
        updatedConversation.is_active === true;

      if (isStaleSessionRevert) {
        return prev;
      }

      return updatedConversation;
    });
  }, [conversations, selectedChat?.id]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!selectedChat) return;

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
  }, [selectedChat]);

  if (inboxLoading && page === 1) {
    return (
      <div className="flex-center" style={{ height: '400px', flexDirection: 'column', gap: '16px' }}>
        <Loader2 className="animate-spin" />
        <p style={{ color: 'var(--text-muted)' }}>{t('common.messages.loading')}</p>
      </div>
    );
  }

  return (
    <div
      className="animate-page-in inbox-layout"
      style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: '24px' }}
    >
      <InboxSidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={(conversation) => {
          setSelectedChat(conversation);
          setViewMode('chat');
          const params = new URLSearchParams(window.location.search);
          params.set('cid', conversation.id);
          params.delete('tid');
          const query = params.toString();
          window.history.replaceState(
            {},
            '',
            query ? `${window.location.pathname}?${query}` : window.location.pathname
          );
        }}
        viewMode={viewMode}
        currentPage={page}
        hasNextPage={hasNextPage}
        onPageChange={setPage}
      />

      <div
        className={`inbox-main-view ${viewMode}`}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card)',
          borderRadius: '24px',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        {selectedChat ? (
          <Suspense fallback={<div className="flex-center" style={{ flex: 1 }}><Loader2 className="animate-spin" /></div>}>
            <ChatWindow
              selectedChat={selectedChat}
              messages={messages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              onSendMessage={handleSendMessage}
              sending={sending}
              agent={agent}
              currentTicket={currentTicket}
              onClaim={handleClaim}
              onAttachClick={() => fileInputRef.current?.click()}
              onEditImage={(source: string) => {
                setViewingImage(source);
                setEditingImage(source);
                setIsViewerOpen(true);
              }}
              hasMoreMessages={hasMoreMessages}
              loadingMoreMessages={loadingMoreMessages}
              onLoadOlderMessages={handleLoadOlderMessages}
              cannedResponses={personalQuickReplies}
              showCanned={showCanned}
              setShowCanned={setShowCanned}
              onUseCanned={(text: string) => {
                setNewMessage(text);
                setShowCanned(false);
              }}
              onAddCanned={handleAddCanned}
              onEditCanned={handleEditCanned}
              onDeleteCanned={handleDeleteCanned}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onDeleteMessage={async (messageId: string) => {
                setPendingDeleteMessageId(messageId);
              }}
              messagesEndRef={messagesEndRef}
            />
          </Suspense>
        ) : (
          <div
            className="flex-center"
            style={{
              flex: 1,
              flexDirection: 'column',
              gap: '16px',
              color: 'var(--text-muted)',
            }}
          >
            <MessageSquare size={64} style={{ opacity: 0.1 }} />
            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>{t('inbox.selectChatTitle')}</h3>
            <p style={{ fontSize: '14px' }}>{t('inbox.selectChatSubtitle')}</p>
          </div>
        )}
      </div>

      <div
        className={`inbox-details-sidebar ${viewMode === 'details' ? 'showing' : ''}`}
        style={{ width: '460px', display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {selectedChat && (
          <Suspense fallback={<div className="flex-center" style={{ minHeight: 220 }}><Loader2 className="animate-spin" /></div>}>
          <TicketSidebar
            selectedChat={selectedChat}
            currentTicket={currentTicket}
            agent={agent}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onFetchGlobalHistory={() =>
              showInfoToast('ฟีเจอร์ยังไม่พร้อม', 'ฟีเจอร์ประวัติการสนทนากลางยังอยู่ระหว่างการพัฒนา')
            }
            onResolve={handleResolve}
            onTransfer={() => showInfoToast('ฟีเจอร์ยังไม่พร้อม', 'ฟีเจอร์โอนงานกำลังอยู่ระหว่างการพัฒนา')}
            onCloseSession={() => setShowCloseSessionConfirm(true)}
            onCopySurvey={() => {
              const surveyTicketId = currentTicket?.id || selectedChat.current_ticket_id;
              if (!surveyTicketId) return;
              navigator.clipboard.writeText(
                `${window.location.origin}/survey/${surveyTicketId}`
              );
              showInfoToast('คัดลอกแล้ว', 'คัดลอกลิงก์ประเมินเรียบร้อย');
            }}
            onWarn={showInfoToast}
          />
          </Suspense>
        )}
      </div>

      <Suspense fallback={null}>
      <ResolveTicketModal
        open={showResolveModal}
        currentTicket={currentTicket}
        availableModules={availableModules}
        availableIssueTypes={availableIssueTypes}
        personalResTemplates={personalResTemplates}
        resSummary={resSummary}
        selectedModule={selectedModule}
        selectedIssueType={selectedIssueType}
        sending={sending}
        isChatActive={selectedChat?.status === 'active'}
        onClose={() => setShowResolveModal(false)}
        onConfirm={handleExecuteResolve}
        onChangeSummary={setResSummary}
        onChangeModule={setSelectedModule}
        onChangeIssueType={setSelectedIssueType}
      />
      </Suspense>

      {isViewerOpen && viewingImage && (
        <Suspense fallback={null}>
          <ImageViewerModal
            imageUrl={viewingImage}
            onClose={() => setIsViewerOpen(false)}
            onEdit={(source: string) => {
              setEditingImage(source);
              setIsEditorOpen(true);
            }}
          />
        </Suspense>
      )}

      {isEditorOpen && editingImage && (
        <Suspense fallback={null}>
          <ImageEditorModal
            imageUrl={editingImage}
            onClose={() => setIsEditorOpen(false)}
            onSave={async (blob: Blob) => {
              if (!selectedChat) return;
              if (!agent?.id) {
                throw new Error('Agent session is missing');
              }

              setSending(true);
              try {
                // 1. Convert Blob to File as per Codex protocol
                const file = new File([blob], `edited_inbox_${Date.now()}.jpg`, { type: 'image/jpeg' });
                
                // 2. Upload and wait for completion
                await uploadInboxChatMedia({
                  file, // Pass the new File object
                  conversationId: selectedChat.id,
                  ticketId: currentTicket?.id || selectedChat.current_ticket_id || null,
                  staffId: agent.id,
                  filePrefix: 'edited'
                });

                // 3. Success! Close modal and cleanup
                setIsEditorOpen(false);
                setEditingImage('');
              } catch (error: unknown) {
                console.error('Inbox editor save failed:', error);
                showInfoToast('อัปโหลดรูปไม่สำเร็จ', getInboxUploadFailedMessage(error));
              } finally {
                setSending(false);
              }
            }}
          />
        </Suspense>
      )}

      {pendingDeleteMessageId && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2300,
            background: 'rgba(5, 15, 30, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              padding: '22px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
              ยืนยันการลบข้อความ
            </h3>
            <p style={{ marginTop: '12px', marginBottom: '18px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {t('common.messages.deleteConfirm')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setPendingDeleteMessageId(null)}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  const messageId = pendingDeleteMessageId;
                  setPendingDeleteMessageId(null);
                  if (!messageId) return;
                  const result = await deleteInboxMessage(messageId);
                  if (!result.success) {
                    showInfoToast('ลบข้อความไม่สำเร็จ', getInboxDeleteFailedMessage(result.error));
                  }
                }}
              >
                ยืนยันลบข้อความ
              </button>
            </div>
          </div>
        </div>
      )}

      {showCloseSessionConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2200,
            background: 'rgba(5, 15, 30, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: '18px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
              padding: '22px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 900, color: 'var(--text-main)' }}>
              ยืนยันการจบการสนทนา
            </h3>
            <p style={{ marginTop: '12px', marginBottom: '18px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
              คุณต้องการจบการสนทนานี้ใช่หรือไม่?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCloseSessionConfirm(false)}>
                ยกเลิก
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={async () => {
                  setShowCloseSessionConfirm(false);
                  await handleCloseSession();
                }}
              >
                ยืนยันจบการสนทนา
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html:
            '@keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }',
        }}
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        style={{ display: 'none' }} 
        accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx"
      />
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex-center"
          style={{ height: '70vh', flexDirection: 'column', gap: '16px' }}
        >
          <Loader2
            className="animate-spin"
            size={32}
            color="var(--primary)"
            aria-hidden="true"
          />
          <p style={{ color: 'var(--text-muted)' }}>Loading Inbox...</p>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
