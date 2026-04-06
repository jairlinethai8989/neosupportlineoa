'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { 
  Bell, 
  Search, 
  Filter, 
  CheckCheck, 
  Trash2, 
  Ticket, 
  Zap, 
  ArrowRight, 
  MessageSquare,
  AlertTriangle,
  History,
  MoreVertical,
  CheckCircle2
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@/hooks/useNotifications';

const ACTION_ICONS: Record<string, any> = {
  'sla': AlertTriangle,
  'ticket': Ticket,
  'message': MessageSquare,
};

const ACTION_COLORS: Record<string, string> = {
  'sla': '#ff9f43',
  'ticket': '#00f2fe',
  'message': '#28c76f',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'เมื่อสักครู่';
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hrs / 24);
  return `${days} วันที่แล้ว`;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, markAllRead, markAsRead } = useNotificationContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'sla'>('all');

  const filteredNotifs = notifications.filter(n => {
    const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         n.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         n.ticketNo?.toString().includes(searchTerm);
    if (!matchesSearch) return false;
    
    if (activeTab === 'unread') return !n.isRead;
    if (activeTab === 'sla') return n.type === 'sla';
    return true;
  });

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.type === 'sla' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(`/tickets/${notif.ticketId}`);
    } else if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  return (
    <div className="notifications-page" style={{ animation: 'fadeIn 0.4s ease-out' }}>
      <header style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell color="var(--primary)" size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '26px', fontWeight: '800' }}>ศูนย์แจ้งเตือน (Notification Center)</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>คุณมีการแจ้งเตือนใหม่ {unreadCount} รายการ</p>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="glass-interactive" 
              style={{ padding: '10px 18px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', border: '1px solid rgba(0, 242, 254, 0.3)', background: 'rgba(0, 242, 254, 0.05)', cursor: 'pointer', fontWeight: '700', fontSize: '14px' }}
            >
              <CheckCheck size={16} />
              อ่านทั้งหมด
            </button>
          )}
        </div>
      </header>

      {/* Filter & Search Bar */}
      <div className="glass-card" style={{ padding: '20px', borderRadius: '16px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
         <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
            <input 
              type="text" 
              placeholder="ค้นหาตามหัวข้อ, รายละเอียด หรือเลขใบงาน..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px 12px 48px', color: 'white', fontSize: '15px' }}
            />
         </div>

         <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '30px', padding: '4px' }}>
            {(['all', 'unread', 'sla'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '24px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  background: activeTab === tab ? 'var(--primary)' : 'transparent',
                  color: activeTab === tab ? '#0a0e14' : 'var(--text-muted)',
                  transition: 'all 0.2s ease',
                }}
              >
                {tab === 'all' ? 'ทั้งหมด' : tab === 'unread' ? `ยังไม่อ่าน (${notifications.filter(n=>!n.isRead).length})` : '⚠️ วิกฤต/SLA'}
              </button>
            ))}
         </div>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '40px' }}>
        {filteredNotifs.length === 0 ? (
          <div className="glass-card" style={{ padding: '80px', textAlign: 'center', borderRadius: '20px' }}>
            <Bell size={48} style={{ margin: '0 auto 16px', opacity: 0.05 }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '16px', fontWeight: '500' }}>ไม่พบการแจ้งเตือนตามเงื่อนไขที่ค้นหา</p>
          </div>
        ) : (
          filteredNotifs.map((notif) => {
            const IconComp = ACTION_ICONS[notif.type] || Ticket;
            const iconColor = ACTION_COLORS[notif.type] || '#00f2fe';
            
            return (
              <div 
                key={notif.id}
                className="notif-row-hover"
                onClick={() => handleNotifClick(notif)}
                style={{
                  background: !notif.isRead ? 'rgba(0, 242, 254, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${!notif.isRead ? 'rgba(0, 242, 254, 0.15)' : 'var(--border)'}`,
                  borderRadius: '16px',
                  padding: '16px 20px',
                  display: 'flex',
                  gap: '20px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {!notif.isRead && (
                  <div style={{ position: 'absolute', left: 0, top: 0, width: '4px', height: '100%', background: 'var(--primary)' }} />
                )}
                
                <div style={{ 
                  width: '48px', 
                  height: '48px', 
                  borderRadius: '14px', 
                  background: `${iconColor}15`, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <IconComp size={20} color={iconColor} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: !notif.isRead ? '800' : '600', color: 'var(--text-main)' }}>{notif.title}</h3>
                    {!notif.isRead && <span className="pulse-dot" style={{ width: '8px', height: '8px', borderRadius: '50%', background: iconColor }} />}
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.body}</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '500' }}>{timeAgo(notif.createdAt)}</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {!notif.isRead && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                        className="notif-action-btn"
                        title="ทำเป็นอ่านแล้ว"
                        style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    )}
                    <button 
                      className="notif-action-btn"
                      style={{ padding: '6px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .notif-row-hover:hover {
          transform: scale(1.005);
          background: rgba(255, 255, 255, 0.05) !important;
          border-color: rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .notif-action-btn:hover {
          background: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
        }
        .pulse-dot {
          animation: dot-pulse 2s infinite;
        }
        @keyframes dot-pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(0, 242, 254, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 242, 254, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
