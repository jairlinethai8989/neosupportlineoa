'use client';
import React from 'react';
import { Search, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';

interface InboxSidebarProps {
  conversations: InboxConversation[];
  selectedChat: InboxConversation | null;
  onSelectChat: (chat: InboxConversation) => void;
  viewMode: InboxViewMode;
  currentPage: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

function isConversationActive(chat: InboxConversation) {
  const normalizedStatus = String(chat.status || '').toLowerCase().trim();
  return (
    chat.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(normalizedStatus)
  );
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({
  conversations,
  selectedChat,
  onSelectChat,
  viewMode,
  currentPage,
  hasNextPage,
  onPageChange,
}) => {
  const { t } = useStaffLocale();

  return (
    <div
      className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`}
      style={{ width: '260px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div
        style={{
          padding: '24px',
          borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(to right, rgba(255,255,255,0.03), transparent)',
        }}
      >
        <h2
          style={{
            fontSize: '18px',
            fontWeight: '900',
            color: 'var(--primary)',
            margin: 0,
            letterSpacing: '-0.5px',
          }}
        >
          {t('inbox.activeChats')}
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
          {t('inbox.queueSubtitle')}
        </p>
      </div>

      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'relative' }}>
          <Search
            style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }}
            size={16}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder={t('inbox.searchPlaceholder')}
            aria-label={t('inbox.searchPlaceholder')}
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px 10px 40px',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none',
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {conversations.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={40} style={{ marginBottom: '16px', opacity: 0.2 }} />
            <p style={{ fontSize: '13px' }}>{t('inbox.noMessages')}</p>
          </div>
        ) : (
          conversations.map((chat) => {
            const active = isConversationActive(chat);

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className="glass-interactive"
                style={{
                  padding: '16px 24px',
                  borderBottom: '1px solid var(--border)',
                  cursor: 'pointer',
                  background:
                    selectedChat?.id === chat.id ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
                  borderLeft:
                    selectedChat?.id === chat.id
                      ? '4px solid var(--primary)'
                      : '4px solid transparent',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'center',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                    <p
                      style={{
                        fontWeight: '750',
                        fontSize: '12px',
                        color:
                          selectedChat?.id === chat.id ? 'var(--primary)' : 'var(--text-main)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {chat.customers?.display_name || 'LINE User'}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>
                      {chat.last_message_at
                        ? new Date(chat.last_message_at).toLocaleTimeString('th-TH', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false,
                          })
                        : '-'}
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    {chat.customers?.hospitals?.name && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: 'var(--text-dim)',
                        fontWeight: '700',
                        maxWidth: '220px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        opacity: 0.8
                      }}>
                        {chat.customers.hospitals.name}
                      </span>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '12px' }}>
                      {chat.ticket_data?.subject ? (
                        <span style={{ 
                          fontSize: '10px', 
                          color: 'var(--text-muted)',
                          fontWeight: '500',
                          maxWidth: '210px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontStyle: 'italic'
                        }}>
                          {chat.ticket_data.subject}
                        </span>
                      ) : (
                        <div />
                      )}
                      <span
                        title={active ? 'Active session' : 'Closed session'}
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: active ? 'var(--success)' : 'var(--text-muted)',
                          boxShadow: active ? '0 0 10px rgba(40, 199, 111, 0.7)' : 'none',
                          flexShrink: 0,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(hasNextPage || currentPage > 1 || conversations.length > 0) && (
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700' }}>
            หน้า {currentPage}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              disabled={!hasNextPage}
              onClick={() => onPageChange(currentPage + 1)}
              style={{
                padding: '8px',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border)',
                color: !hasNextPage ? 'var(--text-muted)' : 'var(--text-main)',
                cursor: !hasNextPage ? 'not-allowed' : 'pointer',
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
