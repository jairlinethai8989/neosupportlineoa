'use client';
import React, { useState } from 'react';
import { Search, Mail, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';

interface InboxSidebarProps {
  conversations: InboxConversation[];
  selectedChat: InboxConversation | null;
  onSelectChat: (chat: InboxConversation) => void;
  viewMode: InboxViewMode;
  currentTab: 'active' | 'closed';
  onTabChange: (tab: 'active' | 'closed') => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onDateFilterChange: (start: string | null, end: string | null) => void;
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({ 
  conversations, 
  selectedChat, 
  onSelectChat, 
  viewMode,
  currentTab,
  onTabChange,
  currentPage,
  totalPages,
  onPageChange,
  onDateFilterChange
}) => {
  const [activeDateFilter, setActiveDateFilter] = useState('all');
  const [showCustomRange, setShowCustomRange] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleDateFilter = (type: string) => {
    setActiveDateFilter(type);
    setShowCustomRange(type === 'custom');
    
    if (type === 'custom') return;

    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;

    if (type === 'today') {
      start = new Date(now.setHours(0, 0, 0, 0));
    } else if (type === 'week') {
      start = new Date(now.setDate(now.getDate() - 7));
    } else if (type === 'month') {
      start = new Date(now.setMonth(now.getMonth() - 1));
    }

    onDateFilterChange(start?.toISOString() || null, null);
  };

  const applyCustomRange = () => {
    onDateFilterChange(
      customStart ? new Date(customStart).toISOString() : null,
      customEnd ? new Date(customEnd).toISOString() : null
    );
  };

  return (
    <div className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`} style={{ width: '360px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      
      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
        <button 
          onClick={() => onTabChange('active')}
          style={{ 
            flex: 1, 
            padding: '16px', 
            border: 'none', 
            background: 'transparent', 
            color: currentTab === 'active' ? 'var(--primary)' : 'var(--text-dim)',
            fontWeight: '800',
            fontSize: '14px',
            borderBottom: currentTab === 'active' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          แชทปัจจุบัน
        </button>
        <button 
          onClick={() => onTabChange('closed')}
          style={{ 
            flex: 1, 
            padding: '16px', 
            border: 'none', 
            background: 'transparent', 
            color: currentTab === 'closed' ? 'var(--primary)' : 'var(--text-dim)',
            fontWeight: '800',
            fontSize: '14px',
            borderBottom: currentTab === 'closed' ? '2px solid var(--primary)' : '2px solid transparent',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          ประวัติใบงาน
        </button>
      </div>

      <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
        {currentTab === 'closed' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }} className="no-scrollbar">
              {[
                { id: 'all', label: 'ทั้งหมด' },
                { id: 'today', label: 'วันนี้' },
                { id: 'week', label: '7 วันล่าสุด' },
                { id: 'month', label: '30 วันล่าสุด' },
                { id: 'custom', label: 'ระบุวันที่' }
              ].map(f => (
                <button 
                  key={f.id}
                  onClick={() => handleDateFilter(f.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: '700',
                    border: '1px solid var(--border)',
                    background: activeDateFilter === f.id ? 'var(--primary)' : 'transparent',
                    color: activeDateFilter === f.id ? 'black' : 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {showCustomRange && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', animation: 'fadeIn 0.2s ease-out' }}>
                <input 
                  type="date" 
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', color: 'var(--text-main)', fontSize: '11px', colorScheme: 'inherit' }}
                />
                <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>-</span>
                <input 
                  type="date" 
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  style={{ flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', color: 'var(--text-main)', fontSize: '11px', colorScheme: 'inherit' }}
                />
                <button 
                  onClick={applyCustomRange}
                  style={{ background: 'var(--primary)', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '10px', fontWeight: '900', cursor: 'pointer', color: 'black' }}
                >
                  ค้นหา
                </button>
              </div>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={16} aria-hidden="true" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อลูกค้า…" 
            aria-label="ค้นหาชื่อลูกค้า"
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 12px 10px 40px',
              color: 'var(--text-main)',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {conversations.length === 0 ? (
           <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Mail size={40} style={{ marginBottom: '16px', opacity: 0.2 }} />
              <p style={{ fontSize: '13px' }}>{currentTab === 'active' ? 'ยังไม่มีข้อความส่งเข้ามา' : 'ไม่พบประวัติการสนทนา'}</p>
           </div>
        ) : conversations.map((chat) => (
          <div 
            key={chat.id} 
            onClick={() => onSelectChat(chat)}
            className="glass-interactive"
            style={{ 
              padding: '16px 24px', 
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: selectedChat?.id === chat.id ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
              borderLeft: selectedChat?.id === chat.id ? '4px solid var(--primary)' : '4px solid transparent',
              transition: 'all 0.2s ease',
              display: 'flex',
              gap: '14px',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '12px', 
              background: `linear-gradient(135deg, oklch(70% 0.1 200), oklch(80% 0.15 190))`,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '16px', 
              fontWeight: '900', 
              color: '#0a0e14',
              flexShrink: 0,
              boxShadow: selectedChat?.id === chat.id ? '0 4px 10px rgba(0, 242, 254, 0.15)' : 'none'
            }}>
              {chat.customers?.display_name?.charAt(0) || 'L'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                <p style={{ fontWeight: '800', fontSize: '14px', color: selectedChat?.id === chat.id ? 'var(--primary)' : 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.customers?.display_name || 'LINE User'}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="truncate" style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '180px' }}>
                  {currentTab === 'active' ? (
                     <>สถานะ: <span style={{ color: 'var(--primary)', fontWeight: '700' }}>ACTIVE</span></>
                  ) : (
                     <>สรุปเมื่อ: {chat.last_message_at ? new Date(chat.last_message_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-'}</>
                  )}
                </p>
                {currentTab === 'active' && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 10px var(--primary)' }} />}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Footer */}
      {(totalPages > 1 || conversations.length > 0) && (
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: '700' }}>หน้า {currentPage} / {totalPages || 1}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: currentPage <= 1 ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }}
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-input)', border: '1px solid var(--border)', color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-main)', cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
