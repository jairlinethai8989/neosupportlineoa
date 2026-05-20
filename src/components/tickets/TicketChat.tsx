'use client';
import React, { useMemo } from 'react';
import {
  MessageSquare,
  Paperclip,
  Loader2,
  SendHorizontal,
  X
} from 'lucide-react';
import Image from 'next/image';
import type {
  TicketDetailMessage,
  TicketDetailTicket,
  TicketDetailUser,
} from '@/types/tickets';
import {
  isAssignedToOtherAgent,
  isNewStatus,
  isResolvedOrClosedStatus,
} from '@/lib/tickets/detailState';

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
    <div
      data-capture-root="true"
      className="glass"
      style={{
        padding: '32px',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 200px)',
        minHeight: '600px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <label
          style={{
            fontSize: '11px',
            fontWeight: '800',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            display: 'block',
          }}
        >
          Chat Workspace
        </label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {isChatActive && onEndChat && (
            <button
              onClick={onEndChat}
              className="glass-interactive"
              style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: 'rgba(6, 182, 212, 0.1)',
                color: '#06b6d4',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <X size={14} /> End chat
            </button>
          )}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 12px',
              background: isChatActive ? 'rgba(0,255,127,0.1)' : 'var(--bg-input)',
              borderRadius: '20px',
            }}
          >
            <div
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: isChatActive ? 'var(--success)' : 'var(--text-muted)',
              }}
            />
            <span
              style={{
                fontSize: '10px',
                color: isChatActive ? 'var(--success)' : 'var(--text-muted)',
                fontWeight: '800',
              }}
            >
              {isChatActive ? 'LIVE SESSION' : 'CLOSED SESSION'}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          marginBottom: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          paddingRight: '12px',
        }}
        className="no-scrollbar"
      >
        {visibleMessages.map((msg) => {
            const isOwn = msg.staff_id === user?.id;
            const canDelete =
              Boolean((isOwn || isAdmin) && msg.sender_type === 'agent' && onDeleteMessage);

            return (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                  maxWidth: '75%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender_type === 'agent' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    padding: '12px 18px',
                    borderRadius: '18px',
                    borderTopRightRadius: msg.sender_type === 'agent' ? '4px' : '18px',
                    borderTopLeftRadius: msg.sender_type === 'customer' ? '4px' : '18px',
                    background: msg.sender_type === 'agent' ? 'var(--primary)' : 'var(--secondary)',
                    color: msg.sender_type === 'agent' ? 'white' : 'var(--text)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    position: 'relative',
                  }}
                >
                  {msg.message_type === 'image' || (msg.media_path || msg.content)?.includes('supabase.co/storage') ? (
                    <Image
                      src={(msg.media_path || msg.content) as string}
                      alt="attachment"
                      width={280}
                      height={180}
                      unoptimized
                      onClick={() => onEditImage((msg.media_path || msg.content) as string)}
                      title="Click to open image viewer"
                      style={{
                        maxWidth: '280px',
                        height: 'auto',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: msg.sender_type === 'agent' ? '700' : '500',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msg.content}
                    </p>
                  )}

                  {canDelete && (
                    <button
                      onClick={() => onDeleteMessage?.(msg.id)}
                      className="glass-interactive flex-center"
                      style={{
                        position: 'absolute',
                        right: '-10px',
                        top: '-10px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(255, 68, 68, 0.9)',
                        color: 'white',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(255, 68, 68, 0.3)',
                        display: 'none',
                        zIndex: 10,
                      }}
                      title="Unsend"
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  )}
                </div>
                <p
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                    marginTop: '6px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {new Date(msg.created_at).toLocaleTimeString('th-TH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                  {msg.sender_type === 'agent' && ' - Sent by you'}
                  {canDelete && (
                    <span
                      onClick={() => onDeleteMessage?.(msg.id)}
                      style={{
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        marginLeft: '8px',
                        textDecoration: 'underline',
                      }}
                    >
                      Unsend
                    </span>
                  )}
                </p>
              </div>
            );
          })}
        {visibleMessages.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: '100px', opacity: 0.3 }}>
            <MessageSquare size={48} style={{ marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', fontWeight: '800' }}>No messages yet</p>
            <p style={{ fontSize: '12px' }}>Start supporting your customer</p>
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div style={{ marginTop: 'auto' }}>
          {!isResolvedOrClosed && !isNew && (
            <div
              className="no-scrollbar"
              style={{
                display: 'flex',
                gap: '8px',
                overflowX: 'auto',
                marginBottom: '12px',
                paddingBottom: '4px',
              }}
            >
              {visibleQuickReplies.map((quickReply, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    setNewMessage(newMessage ? `${newMessage} ${quickReply}` : quickReply)
                  }
                  className="glass-interactive"
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '20px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {quickReply.length > 30 ? `${quickReply.substring(0, 30)}...` : quickReply}
                </button>
              ))}
            </div>
          )}

          {isNew ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(255, 171, 0, 0.05)',
                border: '1px dotted var(--warning)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--warning)', fontWeight: '800' }}>
                Claim this ticket first to start chatting with the customer.
              </p>
            </div>
          ) : isAssignedToOther ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px dotted var(--border)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '800' }}>
                This ticket is currently owned by another agent (read-only).
              </p>
            </div>
          ) : isResolvedOrClosed && !isAdmin ? (
            <div
              style={{
                padding: '16px',
                borderRadius: '10px',
                background: 'rgba(0, 255, 127, 0.05)',
                border: '1px dotted var(--success)',
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: '13px', color: 'var(--success)', fontWeight: '800' }}>
                This ticket is completed and chat is now closed.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                background: 'rgba(0,0,0,0.03)',
                padding: '12px',
                borderRadius: '16px',
                border: '1px solid var(--border)',
                alignItems: 'center',
              }}
            >
              <button
                onClick={onAttachFile}
                disabled={sending}
                className="glass-interactive flex-center"
                title="à¹à¸™à¸šà¸£à¸¹à¸›à¸ à¸²à¸žà¸«à¸£à¸·à¸­à¹„à¸Ÿà¸¥à¹Œ (Ctrl+V)"
                aria-label="Attach file or paste image"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-muted)',
                }}
              >
                <Paperclip size={18} />
              </button>

              <input
                type="text"
                placeholder={
                  isResolvedOrClosed
                    ? 'Ticket is closed (admin reopen mode)'
                    : 'Type your response, choose a template, or paste an image with Ctrl+V...'
                }
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                onKeyPress={(event) => event.key === 'Enter' && onSendMessage()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  padding: '12px',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: '500',
                  outline: 'none',
                }}
              />
              <button
                onClick={onSendMessage}
                disabled={sending || !newMessage.trim()}
                className="glass-interactive flex-center"
                title="à¸ªà¹ˆà¸‡à¸‚à¹‰à¸­à¸„à¸§à¸²à¸¡"
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  border: 'none',
                  background: !newMessage.trim() && !sending ? 'var(--bg-input)' : 'var(--primary)',
                  color: !newMessage.trim() && !sending ? 'var(--text-muted)' : 'black',
                  transition: 'all 0.3s',
                }}
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <SendHorizontal size={20} />}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


