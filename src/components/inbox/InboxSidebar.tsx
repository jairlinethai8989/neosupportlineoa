'use client';

import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Mail, Search } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge, Button, EmptyState } from '@/components/ui';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';
import styles from './inbox.module.css';

interface InboxSidebarProps {
  conversations: InboxConversation[];
  selectedChat: InboxConversation | null;
  onSelectChat: (chat: InboxConversation) => void;
  onPrefetchChat?: (chat: InboxConversation) => void;
  viewMode: InboxViewMode;
  currentPage: number;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

type QueueFilterTab = 'all' | 'active' | 'linked';

function isConversationActive(chat: InboxConversation) {
  const normalizedStatus = String(chat.status || '').toLowerCase().trim();
  return (
    chat.is_active === true ||
    ['active', 'open', 'new', 'in progress', 'in_progress'].includes(normalizedStatus)
  );
}

export const InboxSidebar: React.FC<InboxSidebarProps> = React.memo(function InboxSidebar({
  conversations,
  selectedChat,
  onSelectChat,
  onPrefetchChat,
  viewMode,
  currentPage,
  hasNextPage,
  onPageChange,
}: InboxSidebarProps) {
  const { locale, t } = useStaffLocale();
  const [filterTab, setFilterTab] = useState<QueueFilterTab>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const visibleConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return conversations.filter((chat) => {
      if (filterTab === 'active' && !isConversationActive(chat)) return false;
      if (filterTab === 'linked' && !chat.ticket_data?.id && !chat.current_ticket_id) return false;
      if (!query) return true;

      const customerName = (chat.customers?.display_name || '').toLowerCase();
      const orgName = (chat.ticket_data?.organizations?.name || '').toLowerCase();
      const subject = (chat.ticket_data?.subject || '').toLowerCase();
      const ticketNo = (chat.ticket_data?.ticket_no || '').toLowerCase();
      const projectCode = (chat.projects?.code || '').toLowerCase();

      return (
        customerName.includes(query) ||
        orgName.includes(query) ||
        subject.includes(query) ||
        ticketNo.includes(query) ||
        projectCode.includes(query)
      );
    });
  }, [conversations, filterTab, searchTerm]);

  const tabs: Array<{ id: QueueFilterTab; label: string }> = [
    { id: 'all', label: locale === 'th' ? 'ทั้งหมด' : 'All' },
    { id: 'active', label: locale === 'th' ? 'กำลังคุย' : 'Active' },
    { id: 'linked', label: locale === 'th' ? 'มีใบงาน' : 'Tickets' },
  ];

  return (
    <aside
      aria-label={t('inbox.activeChats')}
      className={clsx(styles.queuePane, viewMode !== 'list' && styles.hiddenMobile)}
    >
      <div className={styles.queueHeader}>
        <div className={styles.queueTitleRow}>
          <h2 className={styles.queueTitle}>{t('inbox.activeChats')}</h2>
          <Badge variant="primary" size="sm">
            {visibleConversations.length}
          </Badge>
        </div>

        <div className={styles.queueSearchWrap}>
          <Search size={14} className={styles.queueSearchIcon} aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('inbox.searchPlaceholder')}
            aria-label={t('inbox.searchPlaceholder')}
            className={styles.queueSearchInput}
          />
        </div>

        <div className={styles.queueTabs} role="tablist" aria-label="Conversation queue filters">
          {tabs.map((tab) => {
            const active = filterTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilterTab(tab.id)}
                className={clsx(styles.queueTab, active && styles.queueTabActive)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.queueList}>
        {visibleConversations.length === 0 ? (
          <EmptyState
            compact
            icon={<Mail size={20} aria-hidden="true" />}
            title={t('inbox.noMessages')}
          />
        ) : (
          visibleConversations.map((chat) => {
            const active = isConversationActive(chat);
            const selected = selectedChat?.id === chat.id;
            const hospitalName = chat.ticket_data?.organizations?.name;

            return (
              <button
                key={chat.id}
                type="button"
                onClick={() => onSelectChat(chat)}
                onMouseEnter={() => onPrefetchChat?.(chat)}
                onFocus={() => onPrefetchChat?.(chat)}
                aria-current={selected ? 'true' : undefined}
                className={clsx(styles.queueItem, selected && styles.queueItemSelected)}
              >
                <div className={styles.queueItemTop}>
                  <span className={styles.queueCustomerName}>
                    {chat.customers?.display_name || t('inbox.lineUser')}
                  </span>
                  <span className={clsx(styles.queueTime, 'mono tabular-nums')}>
                    {chat.last_message_at
                      ? new Date(chat.last_message_at).toLocaleTimeString('th-TH', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: false,
                        })
                      : '-'}
                  </span>
                </div>

                {(chat.projects?.code || hospitalName) && (
                  <div className={styles.queueMetaRow}>
                    {chat.projects?.code && (
                      <Badge
                        size="sm"
                        variant="neutral"
                        dot={chat.projects.primary_color || true}
                      >
                        {chat.projects.code}
                      </Badge>
                    )}
                    {hospitalName && (
                      <span className={styles.queueOrg}>{hospitalName}</span>
                    )}
                  </div>
                )}

                <div className={styles.queueBottomRow}>
                  <span className={styles.queueSnippet}>
                    {chat.ticket_data?.subject ||
                      (chat.ticket_data?.ticket_no
                        ? `#${chat.ticket_data.ticket_no}`
                        : t('inbox.noTicket'))}
                  </span>
                  <Badge
                    size="sm"
                    variant={active ? 'success' : 'neutral'}
                    dot
                  >
                    {active ? (locale === 'th' ? 'เปิด' : 'Active') : (locale === 'th' ? 'ปิด' : 'Closed')}
                  </Badge>
                </div>
              </button>
            );
          })
        )}
      </div>

      {(hasNextPage || currentPage > 1 || conversations.length > 0) && (
        <div className={styles.queueFooter}>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            disabled={currentPage <= 1}
            onClick={() => onPageChange(currentPage - 1)}
            aria-label={locale === 'th' ? 'หน้าก่อนหน้า' : 'Previous page'}
            title={locale === 'th' ? 'ก่อนหน้า' : 'Previous'}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <span className={clsx(styles.queuePageLabel, 'tabular-nums')}>
            {locale === 'th' ? 'หน้า' : 'Page'} {currentPage}
          </span>
          <Button
            size="sm"
            variant="ghost"
            iconOnly
            disabled={!hasNextPage}
            onClick={() => onPageChange(currentPage + 1)}
            aria-label={locale === 'th' ? 'หน้าถัดไป' : 'Next page'}
            title={locale === 'th' ? 'ถัดไป' : 'Next'}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </aside>
  );
});
