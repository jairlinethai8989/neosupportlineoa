'use client';
import React from 'react';
import { Mail, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';
import { getHospitalColorStyles } from '@/lib/inbox/colors';

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
  const { locale, t } = useStaffLocale();

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

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {conversations.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Mail size={40} style={{ marginBottom: '16px', opacity: 0.2 }} />
            <p style={{ fontSize: '13px' }}>{t('inbox.noMessages')}</p>
          </div>
        ) : (
          conversations.map((chat) => {
            const active = isConversationActive(chat);
            const hospitalName = chat.ticket_data?.organizations?.name || chat.customers?.organizations?.name;
            const colors = getHospitalColorStyles(hospitalName);

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
                    selectedChat?.id === chat.id ? colors.bg : 'transparent',
                  borderLeft:
                    selectedChat?.id === chat.id
                      ? `4px solid ${colors.accent}`
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
                          selectedChat?.id === chat.id ? colors.accent : 'var(--text-main)',
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
                    {hospitalName && (
                      <span style={{ 
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: '800',
                        background: colors.bg,
                        color: colors.text,
                        border: `1px solid ${colors.border}`,
                        maxWidth: 'fit-content',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        marginTop: '3px',
                        marginBottom: '3px',
                        letterSpacing: '0.3px',
                        boxShadow: `0 2px 8px ${colors.bg}`,
                        opacity: 0.95
                      }}>
                        {hospitalName}
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
            padding: '16px 24px',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.01)',
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '3px 6px',
            boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.2)',
          }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="glass-interactive flex-center"
              style={{
                width: '28px',
                height: '28px',
                background: currentPage <= 1 ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: currentPage <= 1 ? 'var(--text-dim)' : 'var(--primary)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: currentPage <= 1 ? 0.2 : 1,
                transition: 'all 0.2s ease-in-out',
                boxShadow: currentPage <= 1 ? 'none' : '0 2px 8px rgba(0, 242, 254, 0.15)',
              }}
              title={locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              color: 'var(--text-main)',
              minWidth: '45px',
              textAlign: 'center',
              letterSpacing: '0.5px'
            }}>
              {locale === 'th' ? 'หน้า' : 'Page'} {currentPage}
            </span>
            <button
              disabled={!hasNextPage}
              onClick={() => onPageChange(currentPage + 1)}
              className="glass-interactive flex-center"
              style={{
                width: '28px',
                height: '28px',
                background: !hasNextPage ? 'transparent' : 'rgba(255, 255, 255, 0.06)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: !hasNextPage ? 'var(--text-dim)' : 'var(--primary)',
                cursor: !hasNextPage ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !hasNextPage ? 0.2 : 1,
                transition: 'all 0.2s ease-in-out',
                boxShadow: !hasNextPage ? 'none' : '0 2px 8px rgba(0, 242, 254, 0.15)',
              }}
              title={locale === 'th' ? 'ถัดไป' : 'Next'}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
