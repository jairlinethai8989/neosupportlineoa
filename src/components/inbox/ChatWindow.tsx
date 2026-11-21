'use client';
/* eslint-disable @next/next/no-img-element */
import React, { type FormEvent, type RefObject } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  Info,
  Loader2,
  Lock,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Trash2,
  Zap,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, Button, EmptyState } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type {
  InboxAgent,
  InboxConversation,
  InboxMessage,
  InboxTicket,
  InboxViewMode,
} from '@/types/inbox';
import styles from './inbox.module.css';

interface ChatWindowProps {
  selectedChat: InboxConversation;
  messages: InboxMessage[];
  newMessage: string;
  setNewMessage: (msg: string) => void;
  isInternalMode?: boolean;
  setIsInternalMode?: (internal: boolean) => void;
  sending: boolean;
  onSendMessage: (e: FormEvent<HTMLFormElement>) => void;
  viewMode: InboxViewMode;
  setViewMode: (mode: InboxViewMode) => void;
  currentTicket: InboxTicket | null;
  agent: InboxAgent | null;
  showCanned: boolean;
  setShowCanned: (show: boolean) => void;
  cannedResponses: string[];
  onAddCanned: () => void;
  onEditCanned: (idx: number) => void;
  onDeleteCanned: (idx: number) => void;
  onUseCanned: (text: string) => void;
  onAttachClick: () => void;
  onEditImage: (url: string) => void;
  onClaim: () => void;
  onDeleteMessage?: (id: string) => void | Promise<void>;
  hasMoreMessages: boolean;
  loadingMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

interface MessagesStreamProps {
  messages: InboxMessage[];
  agent: InboxAgent | null;
  hasMoreMessages: boolean;
  loadingMoreMessages: boolean;
  onLoadOlderMessages: () => Promise<void>;
  onEditImage: (url: string) => void;
  onDeleteMessage?: (id: string) => void | Promise<void>;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

const MemoizedMessagesStream = React.memo(function MessagesStream({
  messages,
  agent,
  hasMoreMessages,
  loadingMoreMessages,
  onLoadOlderMessages,
  onEditImage,
  onDeleteMessage,
  messagesEndRef,
}: MessagesStreamProps) {
  const { locale, t } = useStaffLocale();

  const handleMessagesScroll = async (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (!hasMoreMessages || loadingMoreMessages || target.scrollTop > 60) return;

    const prevScrollTop = target.scrollTop;
    const prevScrollHeight = target.scrollHeight;
    await onLoadOlderMessages();

    requestAnimationFrame(() => {
      const nextScrollHeight = target.scrollHeight;
      target.scrollTop = nextScrollHeight - prevScrollHeight + prevScrollTop;
    });
  };

  return (
    <div className={styles.messagesStream} onScroll={handleMessagesScroll}>
      {(hasMoreMessages || loadingMoreMessages) && (
        <div className={styles.loadOlderHint}>
          {loadingMoreMessages ? t('inbox.loadingOlderMessages') : t('inbox.scrollToLoadOlder')}
        </div>
      )}

      {hasMoreMessages && (
        <div className={styles.mobileOnly} style={{ justifyContent: 'center' }}>
          <Button
            size="sm"
            variant="secondary"
            loading={loadingMoreMessages}
            onClick={() => void onLoadOlderMessages()}
          >
            {loadingMoreMessages ? t('common.messages.loading') : t('inbox.loadOlder')}
          </Button>
        </div>
      )}

      {messages.length === 0 && (
        <EmptyState compact title={t('inbox.waitingNewMessage')} />
      )}

      {messages
        .filter((message) => message.message_type !== 'unsent')
        .map((msg) => {
          const isOwn = msg.staff_id === agent?.id;
          const isAdmin = agent?.role === 'Administrator';
          const canDelete = Boolean(
            (isOwn || isAdmin) && msg.sender_type === 'agent' && onDeleteMessage
          );
          const isInternal = Boolean(msg.is_internal);
          const isAgent = msg.sender_type === 'agent';
          const isSystem = msg.sender_type === 'system';

          const mediaSource = msg.media_path || msg.content || '';
          const isImage =
            Boolean(mediaSource) &&
            (msg.message_type === 'image' ||
              (String(mediaSource).startsWith('http') &&
                /\.(jpeg|jpg|gif|png|webp)$/i.test(String(mediaSource))));
          const isFile =
            !isImage &&
            (msg.message_type === 'file' ||
              (String(mediaSource).startsWith('http') && msg.message_type !== 'text'));

          return (
            <div
              key={msg.id}
              className={clsx(
                styles.messageGroup,
                isSystem && !isInternal
                  ? styles.messageGroupSystem
                  : isAgent
                    ? styles.messageGroupAgent
                    : styles.messageGroupCustomer
              )}
            >
              {isInternal && (
                <div className={styles.internalLabel}>
                  <Lock size={11} aria-hidden="true" />
                  <span>
                    {locale === 'th'
                      ? 'โน้ตภายในทีม (ลูกค้าไม่เห็น)'
                      : 'Internal Note (Hidden from customer)'}
                  </span>
                </div>
              )}

              <div
                className={clsx(
                  styles.bubble,
                  isInternal
                    ? styles.bubbleInternal
                    : isSystem
                      ? styles.bubbleSystem
                      : isAgent
                        ? styles.bubbleAgent
                        : styles.bubbleCustomer
                )}
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => onEditImage(mediaSource)}
                    aria-label={t('inbox.imageEditHint')}
                    title={t('inbox.imageEditHint')}
                    className={styles.bubbleImageBtn}
                  >
                    <img
                      src={mediaSource}
                      loading="lazy"
                      alt="Chat attachment"
                      className={styles.bubbleImage}
                    />
                  </button>
                ) : isFile ? (
                  <a
                    href={mediaSource}
                    target="_blank"
                    rel="noreferrer"
                    className={styles.attachmentLink}
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span>{t('inbox.viewAttachment')}</span>
                  </a>
                ) : (
                  msg.content
                )}
              </div>

              <div className={styles.messageMeta}>
                <span className="mono tabular-nums">
                  {new Date(msg.created_at).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteMessage && void onDeleteMessage(msg.id)}
                    className={styles.unsendBtn}
                    aria-label={locale === 'th' ? 'ยกเลิกข้อความ' : 'Unsend message'}
                  >
                    Unsend
                  </button>
                )}
              </div>
            </div>
          );
        })}
      <div ref={messagesEndRef} />
    </div>
  );
});

export const ChatWindow: React.FC<ChatWindowProps> = ({
  selectedChat,
  messages,
  newMessage,
  setNewMessage,
  isInternalMode = false,
  setIsInternalMode,
  sending,
  onSendMessage,
  viewMode,
  setViewMode,
  currentTicket,
  agent,
  showCanned,
  setShowCanned,
  cannedResponses,
  onAddCanned,
  onEditCanned,
  onDeleteCanned,
  onUseCanned,
  onAttachClick,
  onEditImage,
  onClaim,
  onDeleteMessage,
  hasMoreMessages,
  loadingMoreMessages,
  onLoadOlderMessages,
  messagesEndRef,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const { locale, t } = useStaffLocale();

  if (!selectedChat) {
    return (
      <section className={styles.threadPane}>
        <EmptyState
          icon={<MessageSquare size={22} aria-hidden="true" />}
          title={t('inbox.selectChatTitle')}
          description={t('inbox.selectChatSubtitle')}
        />
      </section>
    );
  }

  const statusLower = currentTicket?.status?.toLowerCase();
  const isResolved =
    statusLower === 'resolved' || statusLower === 'closed' || statusLower === 'fix completed';
  const isViewOnly = !!(agent?.role !== 'Administrator' && agent?.permissions?.inbox === 'view');
  const isUnassigned = !!(currentTicket && !currentTicket.assigned_agent_id);
  const normalizedConversationStatus = String(selectedChat.status || '')
    .toLowerCase()
    .trim();
  const isSessionActive =
    selectedChat.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(
      normalizedConversationStatus
    );

  const isComposerLocked =
    isViewOnly || (!isInternalMode && (isResolved || isUnassigned || !isSessionActive));

  return (
    <section
      data-capture-root="true"
      aria-label={selectedChat.customers?.display_name || t('inbox.lineUser')}
      className={clsx(styles.threadPane, viewMode !== 'chat' && styles.hiddenMobile)}
    >
      {/* Clean 58px Header */}
      <header className={styles.threadHeader}>
        <div className={styles.threadHeaderLeft}>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            onClick={() => setViewMode('list')}
            aria-label={locale === 'th' ? 'กลับไปรายการแชท' : 'Back to conversations'}
            className={styles.mobileOnly}
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>

          <div className={styles.threadAvatar} aria-hidden="true">
            {selectedChat.customers?.display_name?.charAt(0) || 'L'}
          </div>

          <div className={styles.threadTitleBlock}>
            <div className={styles.threadCustomerRow}>
              <h2 className={styles.threadCustomerName}>
                {selectedChat.customers?.display_name || t('inbox.lineUser')}
              </h2>
              {currentTicket?.ticket_no && (
                <span className={clsx(styles.threadTicketNo, 'mono tabular-nums')}>
                  #{currentTicket.ticket_no}
                </span>
              )}
            </div>
            <div className={styles.threadStatusRow}>
              <Badge size="sm" variant={isSessionActive ? 'success' : 'neutral'} dot>
                {isSessionActive ? t('inbox.activeSession') : t('inbox.closedSession')}
              </Badge>
              {currentTicket?.status && (
                <Badge
                  size="sm"
                  variant={
                    isResolved
                      ? 'success'
                      : statusLower === 'pending'
                        ? 'danger'
                        : statusLower === 'escalated'
                          ? 'warning'
                          : 'primary'
                  }
                >
                  {currentTicket.status}
                </Badge>
              )}
            </div>
          </div>
        </div>

        <div className={styles.threadHeaderActions}>
          {isUnassigned && (
            <Button
              size="sm"
              variant="primary"
              onClick={onClaim}
              leftIcon={<Zap size={14} aria-hidden="true" />}
            >
              {t('inbox.claimTicket')}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            iconOnly
            onClick={() => setViewMode('details')}
            aria-label={t('inbox.ticketInfo')}
            className={styles.mobileOnly}
          >
            <Info size={18} aria-hidden="true" />
          </Button>

          <Button
            size="sm"
            variant={isSidebarCollapsed ? 'secondary' : 'ghost'}
            onClick={() => onToggleSidebar?.()}
            aria-expanded={!isSidebarCollapsed}
            aria-label={isSidebarCollapsed ? t('inbox.showInfo') : t('inbox.hideInfo')}
            leftIcon={
              isSidebarCollapsed ? (
                <PanelRightOpen size={15} aria-hidden="true" />
              ) : (
                <PanelRightClose size={15} aria-hidden="true" />
              )
            }
            className={styles.desktopOnly}
          >
            {isSidebarCollapsed ? t('inbox.showInfo') : t('inbox.hideInfo')}
          </Button>
        </div>
      </header>

      {/* Message Stream */}
      <MemoizedMessagesStream
        messages={messages}
        agent={agent}
        hasMoreMessages={hasMoreMessages}
        loadingMoreMessages={loadingMoreMessages}
        onLoadOlderMessages={onLoadOlderMessages}
        onEditImage={onEditImage}
        onDeleteMessage={onDeleteMessage}
        messagesEndRef={messagesEndRef}
      />

      {/* Composer */}
      <div className={clsx(styles.composerArea, isInternalMode && styles.composerAreaWhisper)}>
        {showCanned && (
          <div className={styles.cannedPopover} role="region" aria-label={t('inbox.quickReplies')}>
            <div className={styles.cannedHeader}>
              <span className={styles.cannedTitle}>{t('inbox.quickReplies')}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.preventDefault();
                  onAddCanned();
                }}
                leftIcon={<Plus size={13} aria-hidden="true" />}
              >
                {t('common.add')}
              </Button>
            </div>
            {cannedResponses.map((res, i) => (
              <div key={i} className={styles.cannedRow}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onUseCanned(res);
                  }}
                  className={styles.cannedItemBtn}
                >
                  {res}
                </button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  onClick={(e) => {
                    e.preventDefault();
                    onEditCanned(i);
                  }}
                  aria-label={locale === 'th' ? 'แก้ไขข้อความสำเร็จรูป' : 'Edit quick reply'}
                >
                  <Pencil size={13} aria-hidden="true" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  iconOnly
                  onClick={(e) => {
                    e.preventDefault();
                    onDeleteCanned(i);
                  }}
                  aria-label={locale === 'th' ? 'ลบข้อความสำเร็จรูป' : 'Delete quick reply'}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {isUnassigned && (
          <div className={clsx(styles.noticeBanner, styles.noticeWarning)}>
            <div className={styles.noticeLeft}>
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{t('inbox.unassignedTicketNotice')}</span>
            </div>
            <Button size="sm" variant="primary" onClick={onClaim}>
              {t('inbox.claimTicket')}
            </Button>
          </div>
        )}

        {!isSessionActive && !isResolved && (
          <div className={clsx(styles.noticeBanner, styles.noticeDanger)}>
            <div className={styles.noticeLeft}>
              <AlertTriangle size={15} aria-hidden="true" />
              <span>{t('inbox.sessionEndedWarning')}</span>
            </div>
          </div>
        )}

        <form onSubmit={onSendMessage}>
          {setIsInternalMode && (
            <div className={styles.modeBar} style={{ marginBottom: '8px' }}>
              <div className={styles.modeTabs}>
                <button
                  type="button"
                  aria-pressed={!isInternalMode}
                  onClick={() => setIsInternalMode(false)}
                  className={clsx(styles.modeBtn, !isInternalMode && styles.modeBtnPublicActive)}
                >
                  <MessageSquare size={13} aria-hidden="true" />
                  <span>{locale === 'th' ? 'ตอบลูกค้า (ส่ง LINE)' : 'Reply Customer (LINE)'}</span>
                </button>
                <button
                  type="button"
                  aria-pressed={isInternalMode}
                  disabled={isViewOnly}
                  onClick={() => setIsInternalMode(true)}
                  className={clsx(styles.modeBtn, isInternalMode && styles.modeBtnWhisperActive)}
                >
                  <Lock size={13} aria-hidden="true" />
                  <span>{locale === 'th' ? 'โน้ตภายใน (ไม่ส่งลูกค้า)' : 'Internal Note'}</span>
                </button>
              </div>
              {isInternalMode && (
                <span className={styles.whisperHint}>
                  <Lock size={12} aria-hidden="true" />
                  {locale === 'th'
                    ? 'ข้อความนี้จะเห็นเฉพาะทีมงานภายในเท่านั้น'
                    : 'Visible to internal staff only'}
                </span>
              )}
            </div>
          )}

          <div className={clsx(styles.composerBox, isInternalMode && styles.composerBoxWhisper)}>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              onClick={() => setShowCanned(!showCanned)}
              disabled={!isInternalMode && (isResolved || isUnassigned || !isSessionActive)}
              title={t('inbox.quickReplies')}
              aria-label={t('inbox.quickReplies')}
              aria-expanded={showCanned}
            >
              <MessageSquare size={17} aria-hidden="true" />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              iconOnly
              onClick={onAttachClick}
              disabled={isInternalMode || isResolved || isUnassigned || !isSessionActive}
              title={t('inbox.attachHint')}
              aria-label={t('inbox.attachHint')}
            >
              <Paperclip size={17} aria-hidden="true" />
            </Button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              aria-label={
                isInternalMode
                  ? locale === 'th'
                    ? 'บันทึกโน้ตภายในทีม'
                    : 'Internal note message'
                  : t('inbox.typeMessagePlaceholder')
              }
              placeholder={
                isViewOnly
                  ? t('inbox.viewOnlyPlaceholder')
                  : isInternalMode
                    ? locale === 'th'
                      ? 'บันทึกโน้ตภายในทีม (ลูกค้าจะไม่เห็นข้อความนี้)...'
                      : 'Write an internal note (hidden from customer)...'
                    : isResolved
                      ? t('inbox.readOnlyPlaceholder')
                      : isUnassigned
                        ? t('inbox.claimBeforeChatPlaceholder')
                        : !isSessionActive
                          ? t('inbox.sessionEndedPlaceholder')
                          : t('inbox.typeMessagePlaceholder')
              }
              disabled={isComposerLocked}
              className={styles.composerInput}
            />

            <Button
              type="submit"
              size="sm"
              variant="primary"
              disabled={sending || !newMessage.trim() || isComposerLocked}
              aria-label={
                isInternalMode
                  ? locale === 'th'
                    ? 'บันทึกโน้ตภายใน'
                    : 'Post internal note'
                  : locale === 'th'
                    ? 'ส่งข้อความ'
                    : 'Send message'
              }
              className={isInternalMode ? styles.sendBtnWhisper : undefined}
            >
              {sending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
              ) : (
                <Send size={16} aria-hidden="true" />
              )}
            </Button>
          </div>
        </form>
      </div>
    </section>
  );
};
