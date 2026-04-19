'use client';
import React from 'react';
import { Search, Mail } from 'lucide-react';
import type { InboxConversation, InboxViewMode } from '@/types/inbox';

interface InboxSidebarProps {
  conversations: InboxConversation[];
  selectedChat: InboxConversation | null;
  onSelectChat: (chat: InboxConversation) => void;
  viewMode: InboxViewMode;
}

export const InboxSidebar: React.FC<InboxSidebarProps> = ({ 
  conversations, 
  selectedChat, 
  onSelectChat, 
  viewMode 
}) => {
  return (
    <div className={`glass inbox-list-panel ${viewMode !== 'list' ? 'hidden-mobile' : ''}`} style={{ width: '360px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '24px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800' }}>แชททั้งหมด</h2>
          <div style={{ background: 'var(--primary)', color: 'white', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '800' }}>
             {conversations.length} รายการ
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} size={16} aria-hidden="true" />
          <input 
            type="text" 
            placeholder="ค้นหาชื่อลูกค้าหรือตั๋ว…" 
            aria-label="ค้นหาชื่อลูกค้าหรือตั๋ว"
            style={{
              width: '100%',
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 12px 12px 40px',
              color: 'white',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {conversations.length === 0 ? (
           <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Mail size={40} style={{ marginBottom: '16px', opacity: 0.2 }} />
              <p style={{ fontSize: '14px' }}>ยังไม่มีข้อความส่งเข้ามา</p>
           </div>
        ) : conversations.map((chat) => (
          <div 
            key={chat.id} 
            onClick={() => onSelectChat(chat)}
            className="glass-interactive"
            style={{ 
              padding: '18px 24px', 
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              background: selectedChat?.id === chat.id ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
              borderLeft: selectedChat?.id === chat.id ? '4px solid var(--primary)' : '4px solid transparent',
              transition: 'all var(--dur-main) var(--ease-soft)',
              display: 'flex',
              gap: '14px',
              alignItems: 'center'
            }}
          >
            <div style={{ 
              width: '46px', 
              height: '46px', 
              borderRadius: '14px', 
              background: `linear-gradient(135deg, oklch(70% 0.1 200), oklch(80% 0.15 190))`,
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '18px', 
              fontWeight: '900', 
              color: '#0a0e14',
              flexShrink: 0,
              boxShadow: selectedChat?.id === chat.id ? '0 4px 15px rgba(0, 242, 254, 0.2)' : 'none'
            }}>
              {chat.customers?.display_name?.charAt(0) || 'L'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <p style={{ fontWeight: '800', fontSize: '15px', color: selectedChat?.id === chat.id ? 'var(--primary)' : 'var(--text-main)' }}>{chat.customers?.display_name || 'LINE User'}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {chat.last_message_at ? new Date(chat.last_message_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) : '-'}
                </p>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p className="truncate" style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '180px' }}>
                  สถานะ: <span style={{ color: chat.status === 'active' ? 'var(--primary)' : 'inherit', fontWeight: '700' }}>{(chat.status || '').toUpperCase()}</span>
                </p>
                {chat.status === 'active' && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', boxShadow: '0 0 12px var(--primary)' }} />}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
