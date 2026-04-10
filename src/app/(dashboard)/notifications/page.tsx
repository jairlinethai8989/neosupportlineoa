'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from 'react';
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
  CheckCircle2,
  Volume2,
  VolumeX,
  Settings2,
  Info,
  ExternalLink,
  Smartphone,
  ShieldCheck
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useRouter } from 'next/navigation';
import type { AppNotification } from '@/hooks/useNotifications';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_ICONS: Record<string, any> = {
  'sla': AlertTriangle,
  'ticket': Ticket,
  'message': MessageSquare,
  'system': ShieldCheck,
};

const ACTION_COLORS: Record<string, string> = {
  'sla': '#ea5455',
  'ticket': '#00f2fe',
  'message': '#28c76f',
  'system': '#7367f0',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
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
  const [browserNotifsEnabled, setBrowserNotifsEnabled] = useState(false);

  // Check permission on mount
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setBrowserNotifsEnabled(Notification.permission === 'granted');
    }
  }, []);

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserNotifsEnabled(permission === 'granted');
  };

  const filteredNotifs = useMemo(() => {
    return notifications
      .filter(n => {
        const matchesSearch = n.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             n.body.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             n.ticketNo?.toString().includes(searchTerm);
        if (!matchesSearch) return false;
        
        if (activeTab === 'unread') return !n.isRead;
        if (activeTab === 'sla') return n.type === 'sla';
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications, searchTerm, activeTab]);

  const handleNotifClick = (notif: AppNotification) => {
    markAsRead(notif.id);
    if (notif.type === 'sla' || (notif.type === 'ticket' && notif.ticketId)) {
      router.push(`/tickets/${notif.ticketId}`);
    } else if (notif.type === 'message') {
      router.push('/inbox');
    }
  };

  return (
    <div className="notifications-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Header with Glassmorphism */}
      <header style={{ marginBottom: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="glass" style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 25px rgba(0, 242, 254, 0.2)' }}>
            <Bell color="var(--primary)" size={28} />
          </div>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: '900', letterSpacing: '-0.5px', marginBottom: '4px' }}>ศูนย์การแจ้งเตือน</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(54, 153, 255, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(54, 153, 255, 0.1)' }}>
                  <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--primary)' }}>{unreadCount} ข้อความใหม่</span>
               </div>
               <span style={{ color: 'var(--text-muted)', fontSize: '13px', fontWeight: '500' }}>อัปเดตกิจกรรมล่าสุดแบบ Real-time</span>
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
           <button 
              onClick={requestNotificationPermission}
              className="glass-interactive" 
              style={{ padding: '12px 20px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: browserNotifsEnabled ? 'var(--primary)' : 'var(--text-muted)', border: '1px solid var(--border)', background: 'rgba(255, 255, 255, 0.02)', cursor: 'pointer', fontWeight: '800', fontSize: '13px' }}
           >
             {browserNotifsEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
             Browser Notifications
           </button>

          {unreadCount > 0 && (
            <button 
              onClick={markAllRead}
              className="glass-interactive" 
              style={{ padding: '12px 24px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '10px', color: '#0a0e14', background: 'var(--primary)', border: 'none', cursor: 'pointer', fontWeight: '900', fontSize: '14px', boxShadow: '0 4px 15px rgba(0, 242, 254, 0.3)' }}
            >
              <CheckCheck size={18} />
              ทำเป็นอ่านแล้วทั้งหมด
            </button>
          )}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '32px' }}>
        {/* Left Column: Notification List */}
        <div style={{ minWidth: 0 }}>
          <div className="glass" style={{ padding: '24px', borderRadius: '24px', marginBottom: '24px', border: '1px solid var(--border)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '12px' }}>
                   {(['all', 'unread', 'sla'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                          padding: '10px 24px',
                          borderRadius: '10px',
                          border: 'none',
                          fontSize: '14px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          background: activeTab === tab ? 'rgba(54, 153, 255, 0.1)' : 'transparent',
                          color: activeTab === tab ? 'var(--primary)' : 'var(--text-dim)',
                          transition: 'all 0.2s',
                        }}
                      >
                        {tab === 'all' ? 'ทั้งหมด' : tab === 'unread' ? 'ยังไม่อ่าน' : '🔥 SLA วิกฤต'}
                      </button>
                   ))}
                </div>

                <div style={{ position: 'relative', width: '300px' }}>
                   <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', opacity: 0.3 }} />
                   <input 
                     type="text" 
                     placeholder="ค้นหาการแจ้งเตือน..." 
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     style={{ width: '100%', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 16px 12px 48px', color: 'white', fontSize: '14px' }}
                   />
                </div>
             </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <AnimatePresence mode="popLayout">
                  {filteredNotifs.length === 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ padding: '80px 24px', textAlign: 'center' }}
                    >
                       <Bell size={64} style={{ opacity: 0.05, marginBottom: '20px' }} />
                       <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: '500' }}>ไม่มีการแจ้งเตือนในขณะนี้</p>
                    </motion.div>
                  ) : (
                    filteredNotifs.map((notif) => {
                      const IconComp = ACTION_ICONS[notif.type] || Ticket;
                      const iconColor = ACTION_COLORS[notif.type] || '#00f2fe';
                      
                      return (
                        <motion.div 
                          key={notif.id}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          onClick={() => handleNotifClick(notif)}
                          className="notif-card-premium"
                          style={{
                            background: !notif.isRead ? 'rgba(0, 242, 254, 0.03)' : 'rgba(255, 255, 255, 0.015)',
                            border: `1px solid ${!notif.isRead ? 'rgba(0, 242, 254, 0.12)' : 'var(--border)'}`,
                            borderRadius: '16px',
                            padding: '18px 20px',
                            display: 'flex',
                            gap: '20px',
                            alignItems: 'center',
                            cursor: 'pointer',
                            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative'
                          }}
                        >
                          <div style={{ 
                            width: '48px', height: '48px', borderRadius: '14px', 
                            background: `${iconColor}12`, border: `1px solid ${iconColor}20`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                          }}>
                            <IconComp size={22} color={iconColor} />
                          </div>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                               <span style={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', color: iconColor, opacity: 0.8 }}>{notif.type}</span>
                               <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>•</span>
                               <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '700' }}>{timeAgo(notif.createdAt)}</span>
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: !notif.isRead ? '800' : '600', color: 'var(--text-main)', marginBottom: '4px' }}>{notif.title}</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.body}</p>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                             {notif.isRead ? (
                               <div style={{ padding: '10px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)' }}><CheckCircle2 size={18} /></div>
                             ) : (
                               <button 
                                 onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                                 className="glass-interactive"
                                 style={{ padding: '10px', borderRadius: '10px', border: 'none', background: 'var(--primary-glow)', color: 'var(--primary)', cursor: 'pointer' }}
                               >
                                 <CheckCheck size={18} />
                               </button>
                             )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
             </div>
          </div>
        </div>

        {/* Right Column: Settings & Quick View */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
           <div className="glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                 <Settings2 size={20} color="var(--primary)" />
                 <h2 style={{ fontSize: '18px', fontWeight: '800' }}>ช่องทางแจ้งเตือน</h2>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <Smartphone size={18} color="var(--primary)" />
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>ในระบบ (In-App)</span>
                    </div>
                    <div style={{ color: 'var(--success)', fontSize: '10px', fontWeight: '900' }}>ใช้งานอยู่</div>
                 </div>

                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'rgba(234, 84, 85, 0.05)', borderRadius: '12px', border: '1px solid rgba(234, 84, 85, 0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                       <MessageSquare size={18} color="#ea5455" />
                       <span style={{ fontSize: '14px', fontWeight: '700' }}>LINE Push (Direct)</span>
                    </div>
                    <div style={{ color: '#ea5455', fontSize: '10px', fontWeight: '900' }}>ยังไม่เปิดใช้</div>
                 </div>

                 <div style={{ padding: '16px', background: 'rgba(54, 153, 255, 0.05)', borderRadius: '12px', border: '1px solid rgba(54, 153, 255, 0.1)', marginTop: '8px' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                       <Info size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                       <p style={{ fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.5' }}>
                          คุณสามารถตั้งค่าการแจ้งเตือนเพิ่มเติมได้ในหน้ารายโปรไฟล์ เพื่อรับข้อความผ่าน LINE ส่วนตัวเมื่อมีเคสเร่งด่วนโอนมาหาคุณ
                       </p>
                    </div>
                 </div>
              </div>
           </div>

           <div className="glass" style={{ padding: '24px', borderRadius: '24px', border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(54, 153, 255, 0.05) 0%, rgba(0, 242, 254, 0.05) 100%)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                 <Zap size={20} color="var(--primary)" />
                 <h2 style={{ fontSize: '16px', fontWeight: '800' }}>Quick Tip</h2>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: '1.6' }}>
                คลิกที่การแจ้งเตือนเพื่อไปยังหน้าใบงานหรือห้องแชทนั้นๆ โดยตรง ระบบจะทำเครื่องหมายว่าอ่านแล้วให้ทันที
              </p>
              <button 
                onClick={() => router.push('/settings/profile')}
                style={{ width: '100%', marginTop: '20px', padding: '12px', borderRadius: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                ดูรายละเอียดโปรไฟล์ <ExternalLink size={14} />
              </button>
           </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .notif-card-premium:hover {
           background: rgba(255,255,255,0.05) !important;
           transform: translateY(-2px);
           box-shadow: 0 12px 40px rgba(0,0,0,0.4);
        }
        .pulse-dot {
           animation: pulse 2s infinite;
        }
        @keyframes pulse {
           0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(0, 242, 254, 0.4); }
           70% { transform: scale(1); opacity: 0.8; box-shadow: 0 0 0 10px rgba(0, 242, 254, 0); }
           100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(0, 242, 254, 0); }
        }
        @keyframes fadeIn {
           from { opacity: 0; transform: translateY(10px); }
           to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
