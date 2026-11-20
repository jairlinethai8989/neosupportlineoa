'use client';

import React, { useMemo } from 'react';
import { Lock, MessageSquare, Paperclip, SendHorizontal, X } from 'lucide-react';
import Image from 'next/image';
import { clsx } from 'clsx';
import { Badge, Button, EmptyState } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import {
  isAssignedToOtherAgent,
  isNewStatus,
  isResolvedOrClosedStatus,
} from '@/lib/tickets/detailState';
import type {
  TicketDetailMessage,
  TicketDetailTicket,
  TicketDetailUser,
} from '@/types/tickets';
import inboxStyles from '@/components/inbox/inbox.module.css';
import styles from '@/app/(dashboard)/tickets/tickets-workspace.module.css';

interface TicketChatProps {
  messages: TicketDetailMessage[];
  ticket: TicketDetailTicket | null;
  user: TicketDetailUser | null;
  newMessage: string;
  setNewMessage: (msg: string) => void;
  sending: boolean;
  onSendMessage: () => void;
  onAttachFile: () => void;
  onEditImage: (url: string) => void;
  onDeleteMessage?: (id: string) => void;
  onEndChat?: () => void;
  isChatActive?: boolean;
  quickReplies: string[];
  isReadOnly?: boolean;
}

export const TicketChat: React.FC<TicketChatProps> = ({
  messages,
  ticket,
  user,
  newMessage,
  setNewMessage,
  sending,
  onSendMessage,
  onAttachFile,
  onEditImage,
  onDeleteMessage,
  onEndChat,
  isChatActive = false,
  quickReplies,
  isReadOnly = false,
}) => {
  const { locale } = useStaffLocale();
  const status = ticket?.status || '';
  const visibleMessages = useMemo(
    () => messages.filter((message) => message.message_type !== 'unsent'),
    [messages]
  );
  const visibleQuickReplies = useMemo(
    () => quickReplies.filter(Boolean).slice(0, 12),
    [quickReplies]
  );

  if (!ticket) return null;
  const isResolvedOrClosed = isResolvedOrClosedStatus(status);
  const isNew = isNewStatus(status);
  const isAssignedToOther = isAssignedToOtherAgent(ticket, user);
  const isAdmin = user?.role === 'Administrator';

  return (
    <section data-capture-root="true" className={styles.detailChatCard}>
      <div className={styles.detailChatHeader}>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          Chat Workspace
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isChatActive && onEndChat && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onEndChat}
              leftIcon={<X size={14} aria-hidden="true" />}
            >
              End chat
            </Button>
          )}
          <Badge size="sm" variant={isChatActive ? 'success' : 'neutral'} dot>
            {isChatActive ? 'LIVE SESSION' : 'CLOSED SESSION'}
          </Badge>
        </div>
      </div>

      <div className={styles.detailChatMessages}>
        {visibleMessages.map((msg) => {
          const isOwn = msg.staff_id === user?.id;
          const canDelete = Boolean(
            (isOwn || isAdmin) && msg.sender_type === 'agent' && onDeleteMessage
          );
          const isAgent = msg.sender_type === 'agent';
          const isSystem = msg.sender_type === 'system';
          const isInternal = Boolean((msg as TicketDetailMessage & { is_internal?: boolean }).is_internal);

          const mediaSource = msg.media_path || msg.content || '';
          const isImage =
            msg.message_type === 'image' ||
            String(mediaSource).includes('supabase.co/storage');

          return (
            <div
              key={msg.id}
              className={clsx(
                inboxStyles.messageGroup,
                isSystem && !isInternal
                  ? inboxStyles.messageGroupSystem
                  : isAgent
                    ? inboxStyles.messageGroupAgent
                    : inboxStyles.messageGroupCustomer
              )}
            >
              {isInternal && (
                <div className={inboxStyles.internalLabel}>
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
                  inboxStyles.bubble,
                  isInternal
                    ? inboxStyles.bubbleInternal
                    : isSystem
                      ? inboxStyles.bubbleSystem
                      : isAgent
                        ? inboxStyles.bubbleAgent
                        : inboxStyles.bubbleCustomer
                )}
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => onEditImage(mediaSource)}
                    aria-label={locale === 'th' ? 'เปิดดูรูปภาพ' : 'Open image viewer'}
                    className={inboxStyles.bubbleImageBtn}
                  >
                    <Image
                      src={mediaSource}
                      alt="attachment"
                      width={280}
                      height={180}
                      unoptimized
                      className={inboxStyles.bubbleImage}
                    />
                  </button>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>

              <div className={inboxStyles.messageMeta}>
                <span className="tabular-nums">
                  {new Date(msg.created_at).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  {isAgent ? ' • Agent' : ''}
                </span>
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteMessage?.(msg.id)}
                    className={inboxStyles.unsendBtn}
                    aria-label={locale === 'th' ? 'ยกเลิกข้อความ' : 'Unsend message'}
                  >
                    Unsend
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {visibleMessages.length === 0 && (
          <EmptyState
            icon={<MessageSquare size={22} aria-hidden="true" />}
            title={locale === 'th' ? 'ยังไม่มีข้อความ' : 'No messages yet'}
            description={locale === 'th' ? 'ประวัติการสนทนาจะแสดงที่นี่' : 'Start supporting your customer'}
          />
        )}
      </div>

      {!isReadOnly && (
        <div className={styles.detailChatComposer}>
          {!isResolvedOrClosed && !isNew && visibleQuickReplies.length > 0 && (
            <div className={clsx(styles.quickReplyStrip, 'no-scrollbar')}>
              {visibleQuickReplies.map((quickReply, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setNewMessage(newMessage ? `${newMessage} ${quickReply}` : quickReply)
                  }
                  className={styles.quickReplyBtn}
                >
                  {quickReply.length > 30 ? `${quickReply.substring(0, 30)}...` : quickReply}
                </button>
              ))}
            </div>
          )}

          {isNew ? (
            <div className={clsx(inboxStyles.noticeBanner, inboxStyles.noticeWarning)}>
              Claim this ticket first to start chatting with the customer.
            </div>
          ) : isAssignedToOther ? (
            <div className={clsx(inboxStyles.noticeBanner, inboxStyles.noticeWarning)}>
              This ticket is currently owned by another agent (read-only).
            </div>
          ) : isResolvedOrClosed && !isAdmin ? (
            <div className={clsx(inboxStyles.noticeBanner, inboxStyles.noticeWarning)}>
              This ticket is completed and chat is now closed.
            </div>
          ) : (
            <div className={inboxStyles.composerBox}>
              <Button
                size="sm"
                variant="ghost"
                iconOnly
                onClick={onAttachFile}
                disabled={sending}
                title={locale === 'th' ? 'แนบรูปภาพหรือไฟล์ (Ctrl+V)' : 'Attach file or paste image'}
                aria-label={locale === 'th' ? 'แนบรูปภาพหรือไฟล์' : 'Attach file or paste image'}
              >
                <Paperclip size={17} aria-hidden="true" />
              </Button>

              <input
                type="text"
                aria-label={locale === 'th' ? 'พิมพ์ข้อความตอบกลับ' : 'Reply message'}
                placeholder={
                  isResolvedOrClosed
                    ? 'Ticket is closed (admin reopen mode)'
                    : 'Type your response, choose a template, or paste an image with Ctrl+V...'
                }
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onSendMessage();
                  }
                }}
                className={inboxStyles.composerInput}
              />

              <Button
                size="sm"
                variant="primary"
                onClick={onSendMessage}
                disabled={sending || !newMessage.trim()}
                loading={sending}
                aria-label={locale === 'th' ? 'ส่งข้อความ' : 'Send message'}
              >
                <SendHorizontal size={16} aria-hidden="true" />
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
