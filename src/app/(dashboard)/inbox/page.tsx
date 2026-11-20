'use client';

import React, { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';
import { clsx } from 'clsx';
import { Button, EmptyState, Modal } from '@/components/ui';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useInboxProfileSettings } from '@/hooks/useInboxProfileSettings';
import { useInboxConversation } from '@/hooks/useInboxConversation';
import {
  getInboxDeleteFailedMessage,
  getInboxUploadFailedMessage,
} from '@/lib/inbox/feedback';
import { getInboxConversationById, getInboxConversationByTicketId } from '@/lib/inbox/queries';
import { deleteInboxMessage, uploadInboxChatMedia } from '@/lib/inbox/mutations';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';
import styles from '@/components/inbox/inbox.module.css';

const ImageEditorModal = dynamic(() => import('@/components/modals/ImageEditorModal'), { ssr: false });
const ImageViewerModal = dynamic(() => import('@/components/modals/ImageViewerModal'), { ssr: false });
const ChatWindow = dynamic(
  () => import('@/components/inbox/ChatWindow').then((module) => module.ChatWindow),
  { ssr: false }
);
const TicketSidebar = dynamic(
  () => import('@/components/inbox/TicketSidebar').then((module) => module.TicketSidebar),
  { ssr: false }
);
const ResolveTicketModal = dynamic(
  () => import('@/components/inbox/ResolveTicketModal').then((module) => module.ResolveTicketModal),
  { ssr: false }
);

function hasSelectedConversationChanged(
  prev: InboxConversation | null,
  next: InboxConversation
) {
  if (!prev) return true;

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
  const { locale, t } = useStaffLocale();
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

  const { conversations, hasNextPage, loading: inboxLoading, refresh } = useRealtimeInbox({
    page,
    pageSize: 10,
  });
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    if (!inboxLoading) return;
    const timer = setTimeout(() => {
      setShowRetry(true);
    }, 10000);
    return () => {
      clearTimeout(timer);
      setShowRetry(false);
    };
  }, [inboxLoading]);

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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const {
    messages,
    newMessage,
    setNewMessage,
    isInternalMode,
    setIsInternalMode,
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
        title: t('inbox.uploadFailedTitle'),
        body: getInboxUploadFailedMessage(error),
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
      if (window.innerWidth <= 1024) {
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
        if (window.innerWidth <= 1024) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cid, tid]);

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
      <div className={styles.loadingState} role="status" aria-live="polite">
        <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
        <p>{t('common.messages.loading')}</p>
        {showRetry && (
          <Button variant="secondary" size="sm" onClick={() => refresh()}>
            {locale === 'th' ? 'โหลดใหม่อีกครั้ง' : 'Retry'}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={clsx(styles.workspace, isSidebarCollapsed && styles.workspaceCollapsed)}>
      <InboxSidebar
        conversations={conversations}
        selectedChat={selectedChat}
        onSelectChat={async (conversation) => {
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

      {selectedChat ? (
        <Suspense
          fallback={
            <div className={styles.threadPane}>
              <div className={styles.loadingState}>
                <Loader2 className="animate-spin" size={24} aria-hidden="true" />
              </div>
            </div>
          }
        >
          <ChatWindow
            selectedChat={selectedChat}
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            isInternalMode={isInternalMode}
            setIsInternalMode={setIsInternalMode}
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
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
        </Suspense>
      ) : (
        <div className={clsx(styles.threadPane, viewMode !== 'chat' && styles.hiddenMobile)}>
          <EmptyState
            icon={<MessageSquare size={22} aria-hidden="true" />}
            title={t('inbox.selectChatTitle')}
            description={t('inbox.selectChatSubtitle')}
          />
        </div>
      )}

      {selectedChat && (
        <div
          className={clsx(
            styles.inspectorWrap,
            isSidebarCollapsed && styles.inspectorWrapCollapsed,
            viewMode !== 'details' && styles.hiddenMobile
          )}
        >
          <Suspense
            fallback={
              <div className={styles.inspectorPane}>
                <div className={styles.loadingState} style={{ height: 220 }}>
                  <Loader2 className="animate-spin" size={20} aria-hidden="true" />
                </div>
              </div>
            }
          >
            <TicketSidebar
              selectedChat={selectedChat}
              currentTicket={currentTicket}
              agent={agent}
              viewMode={viewMode}
              setViewMode={setViewMode}
              onFetchGlobalHistory={() =>
                showInfoToast(
                  locale === 'th' ? 'ฟีเจอร์ยังไม่พร้อม' : 'Coming soon',
                  t('inbox.globalHistoryComingSoon')
                )
              }
              onResolve={handleResolve}
              onTransfer={() =>
                showInfoToast(
                  locale === 'th' ? 'ฟีเจอร์ยังไม่พร้อม' : 'Coming soon',
                  t('inbox.transferComingSoon')
                )
              }
              onCloseSession={() => setShowCloseSessionConfirm(true)}
              onCopySurvey={() => {
                const surveyTicketId = currentTicket?.id || selectedChat.current_ticket_id;
                if (!surveyTicketId) return;
                navigator.clipboard.writeText(
                  `${window.location.origin}/survey/${surveyTicketId}`
                );
                showInfoToast(
                  locale === 'th' ? 'คัดลอกแล้ว' : 'Copied',
                  t('inbox.surveyLinkCopied')
                );
              }}
              onWarn={showInfoToast}
            />
          </Suspense>
        </div>
      )}

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
                const file = new File([blob], `edited_inbox_${Date.now()}.jpg`, {
                  type: 'image/jpeg',
                });

                await uploadInboxChatMedia({
                  file,
                  conversationId: selectedChat.id,
                  ticketId: currentTicket?.id || selectedChat.current_ticket_id || null,
                  staffId: agent.id,
                  filePrefix: 'edited',
                });

                setIsEditorOpen(false);
                setEditingImage('');
              } catch (error: unknown) {
                console.error('Inbox editor save failed:', error);
                showInfoToast(t('inbox.uploadFailedTitle'), getInboxUploadFailedMessage(error));
              } finally {
                setSending(false);
              }
            }}
          />
        </Suspense>
      )}

      <Modal
        isOpen={Boolean(pendingDeleteMessageId)}
        onClose={() => setPendingDeleteMessageId(null)}
        size="sm"
        title={t('inbox.confirmDeleteMessageTitle')}
        description={t('common.messages.deleteConfirm')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPendingDeleteMessageId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const messageId = pendingDeleteMessageId;
                setPendingDeleteMessageId(null);
                if (!messageId) return;
                const result = await deleteInboxMessage(messageId);
                if (!result.success) {
                  showInfoToast(
                    t('common.messages.deleteFailed'),
                    getInboxDeleteFailedMessage(result.error)
                  );
                }
              }}
            >
              {t('inbox.confirmDeleteMessageButton')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {t('common.messages.deleteConfirm')}
        </p>
      </Modal>

      <Modal
        isOpen={showCloseSessionConfirm}
        onClose={() => setShowCloseSessionConfirm(false)}
        size="sm"
        title={t('inbox.confirmEndChatTitle')}
        description={t('inbox.confirmEndChatBody')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCloseSessionConfirm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={async () => {
                setShowCloseSessionConfirm(false);
                await handleCloseSession();
              }}
            >
              {t('inbox.confirmEndChatButton')}
            </Button>
          </>
        }
      >
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          {t('inbox.confirmEndChatBody')}
        </p>
      </Modal>

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
        <div className={styles.loadingState} role="status">
          <Loader2 className="animate-spin" size={28} color="var(--color-primary)" aria-hidden="true" />
          <p>Loading Inbox...</p>
        </div>
      }
    >
      <InboxContent />
    </Suspense>
  );
}
