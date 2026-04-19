'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2, MessageSquare } from 'lucide-react';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { useNotificationContext } from '@/contexts/NotificationContext';
import ImageEditorModal from '@/components/modals/ImageEditorModal';
import ImageViewerModal from '@/components/modals/ImageViewerModal';
import { InboxSidebar } from '@/components/inbox/InboxSidebar';
import { ChatWindow } from '@/components/inbox/ChatWindow';
import { TicketSidebar } from '@/components/inbox/TicketSidebar';
import { ResolveTicketModal } from '@/components/inbox/ResolveTicketModal';
import CaptureOverlay from '@/components/chat/CaptureOverlay';
import { useInboxProfileSettings } from '@/hooks/useInboxProfileSettings';
import { useInboxConversation } from '@/hooks/useInboxConversation';
import {
  getInboxDeleteFailedMessage,
  getInboxUploadFailedMessage,
} from '@/lib/inbox/feedback';
import { deleteInboxMessage, uploadInboxChatMedia } from '@/lib/inbox/mutations';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';

function hasSelectedConversationChanged(
  prev: InboxConversation | null,
  next: InboxConversation
) {
  if (!prev) return true;

  // Potential stale data: If we locally closed it, don't revert to active 
  // until we are sure the server has a real reason (like a new ticket).
  const isStaleStatusRevert = prev.status === 'closed' && next.status === 'active';

  return (
    prev.last_message_at !== next.last_message_at ||
    (prev.status !== next.status && !isStaleStatusRevert) ||
    prev.current_ticket_id !== next.current_ticket_id ||
    prev.is_active !== next.is_active ||
    prev.customers?.display_name !== next.customers?.display_name ||
    prev.customers?.avatar_url !== next.customers?.avatar_url
  );
}

function InboxContent() {
  const { conversations, loading: inboxLoading } = useRealtimeInbox();
  const { addToast } = useNotificationContext();
  const [selectedChat, setSelectedChat] = useState<InboxConversation | null>(null);
  const [viewMode, setViewMode] = useState<InboxViewMode>('list');
  const [showCanned, setShowCanned] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState('');
  const [editingImage, setEditingImage] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const cid = searchParams.get('cid');

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
      await uploadInboxChatMedia({
        file,
        conversationId: selectedChat.id,
        ticketId: selectedChat.current_ticket_id || null,
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

  const handleScreenCapture = async () => {
    setIsCapturing(true);
  };

  useEffect(() => {
    if (cid && conversations.length > 0) {
      const target = conversations.find((conversation) => conversation.id === cid);
      if (target) {
        setSelectedChat(target);
        if (window.innerWidth <= 1000) {
          setViewMode('chat');
        }
      }
    }
  }, [cid, conversations]);

  useEffect(() => {
    const updatedConversation = conversations.find((conversation) => conversation.id === selectedChat?.id);
    if (!updatedConversation || !selectedChat) return;

    if (hasSelectedConversationChanged(selectedChat, updatedConversation)) {
      // When syncing, preserve local 'closed'/'inactive' state if the incoming data is 'active' (likely stale)
      setSelectedChat(prev => {
         if (!prev) return updatedConversation;
         if (prev.status === 'closed' && updatedConversation.status === 'active') {
            return {
               ...updatedConversation,
               status: 'closed',
               is_active: false
            };
         }
         return updatedConversation;
      });
    }
  }, [conversations, selectedChat]);

  if (inboxLoading) {
    return (
      <div className="flex-center" style={{ height: '70vh' }}>
        <Loader2 className="animate-spin" />
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
        }}
        viewMode={viewMode}
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
            onScreenCapture={handleScreenCapture}
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
              if (confirm('ยกเลิกส่งข้อความนี้ใช่หรือไม่?')) {
                const result = await deleteInboxMessage(messageId);
                if (!result.success) {
                  alert(getInboxDeleteFailedMessage(result.error));
                }
              }
            }}
            messagesEndRef={messagesEndRef}
          />
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
            <h3 style={{ fontSize: '18px', fontWeight: '800' }}>เลือกแชตเพื่อเริ่มการสนทนา</h3>
            <p style={{ fontSize: '14px' }}>ระบบจะแสดงประวัติข้อความและข้อมูล ticket ทางด้านขวา</p>
          </div>
        )}
      </div>

      <div
        className={`inbox-details-sidebar ${viewMode === 'details' ? 'showing' : ''}`}
        style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '24px' }}
      >
        {selectedChat && (
          <TicketSidebar
            selectedChat={selectedChat}
            currentTicket={currentTicket}
            agent={agent}
            viewMode={viewMode}
            setViewMode={setViewMode}
            onFetchGlobalHistory={() =>
              alert('ฟีเจอร์ประวัติการสนทนากลางยังอยู่ระหว่างการพัฒนา')
            }
            onResolve={handleResolve}
            onTransfer={() => alert('ฟีเจอร์โอนงานกำลังอยู่ระหว่างการพัฒนา')}
            onCloseSession={handleCloseSession}
            onCopySurvey={() => {
              if (!selectedChat.current_ticket_id) return;
              navigator.clipboard.writeText(
                `${window.location.origin}/survey/${selectedChat.current_ticket_id}`
              );
              alert('คัดลอกลิงก์ประเมินแล้ว');
            }}
          />
        )}
      </div>

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
        onClose={() => setShowResolveModal(false)}
        onConfirm={handleExecuteResolve}
        onChangeSummary={setResSummary}
        onChangeModule={setSelectedModule}
        onChangeIssueType={setSelectedIssueType}
      />

      {isViewerOpen && viewingImage && (
        <ImageViewerModal
          imageUrl={viewingImage}
          onClose={() => setIsViewerOpen(false)}
          onEdit={(source: string) => {
            setEditingImage(source);
            setIsEditorOpen(true);
          }}
        />
      )}

      {isEditorOpen && editingImage && (
        <ImageEditorModal
          imageUrl={editingImage}
          onClose={() => setIsEditorOpen(false)}
          onSave={async (blob: Blob) => {
            if (!selectedChat) return;

            setSending(true);
            try {
              // 1. Convert Blob to File as per Codex protocol
              const file = new File([blob], `edited_inbox_${Date.now()}.jpg`, { type: 'image/jpeg' });
              
              // 2. Upload and wait for completion
              await uploadInboxChatMedia({
                file, // Pass the new File object
                conversationId: selectedChat.id,
                ticketId: selectedChat.current_ticket_id || null,
                filePrefix: 'edited'
              });

              // 3. Success! Close modal and cleanup
              setIsEditorOpen(false);
              setEditingImage('');
            } catch (error: unknown) {
              console.error('Inbox editor save failed:', error);
              alert(getInboxUploadFailedMessage(error));
            } finally {
              setSending(false);
            }
          }}
        />
      )}

      {isCapturing && (
        <CaptureOverlay 
          onCapture={(url) => {
            setEditingImage(url);
            setIsEditorOpen(true);
            setIsCapturing(false);
          }}
          onCancel={() => setIsCapturing(false)}
        />
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
