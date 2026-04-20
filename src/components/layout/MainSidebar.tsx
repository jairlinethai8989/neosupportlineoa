'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { 
  BarChart2, 
  Inbox, 
  Settings, 
  Users, 
  Ticket, 
  LogOut,
  ShieldCheck,
  Building,
  User,
  LayoutDashboard,
  Settings2,
  Bell,
  Plus,
  Send,
} from 'lucide-react';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useAppContext } from '@/contexts/AppContext';

const DEPT_BADGES: Record<string, string> = {
  'IT Support': '💻',
  'Customer Service': '🎧',
  'Billing': '💵',
  'Accounting': '📊',
  'Management': '🛡️',
  'Sales': '🚀',
  'Marketing': '📢',
  'Operations': '⚙️',
  'Human Resources': '👥',
  'Administration': '🏢'
};

interface SidebarProps {
  onClickLink?: () => void;
  isCollapsed?: boolean;
}

const THEMES = [
  { id: 'dark', name: 'Dark', thai: 'ธีมเข้ม', color: '#0a0e14', iconColor: '#7367f0' },
  { id: 'light', name: 'Light', thai: 'ธีมสว่าง', color: '#ffffff', iconColor: '#ffcd3c' },
  { id: 'blue', name: 'Blue', thai: 'ธีมฟ้า', color: '#0f172a', iconColor: '#38bdf8' },
  { id: 'cyan', name: 'Cyan', thai: 'ธีมไซแอนด์', color: '#081a26', iconColor: '#06b6d4' },
  { id: 'gray', name: 'Gray', thai: 'ธีมเทา', color: '#111827', iconColor: '#f3f4f6' },
];

const Sidebar = ({ onClickLink, isCollapsed = false }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const { companySettings: company, userProfile: profile } = useAppContext();
  const [theme, setTheme] = useState('dark');
  
  const userRole = profile?.role || '';
  const permissions = profile?.permissions || null;
  const { unreadCount, newTicketsCount } = useNotificationContext();

  const [inboxCount, setInboxCount] = useState(0);
  const [openMenus, setOpenMenus] = useState<string[]>(['System Settings', 'Intelligence Dashboard']);

  useEffect(() => {
    // Initial fetch for counters only
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active')
      .then(res => res.count !== null && setInboxCount(res.count));

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Optimized Realtime Channel for counter updates
    const channel = supabase.channel('sidebar-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
         supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active')
           .then(res => res.count !== null && setInboxCount(res.count));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const changeTheme = useCallback((newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  const toggleMenu = useCallback((name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  }, []);

  // OPTIMIZATION: Memoized Menu Items
  const menuItems = useMemo(() => [
    { section: 'Operations', thai: 'ส่วนปฏิบัติการหลัก', items: [
      { name: 'Tickets', thai: 'จัดการใบงาน', icon: Ticket, path: '/tickets', count: newTicketsCount },
      { name: 'Inbox', thai: 'ห้องแชทลูกค้า', icon: Inbox, path: '/inbox', count: inboxCount },
      { name: 'Notifications', thai: 'การแจ้งเตือน', icon: Bell, path: '/notifications', count: unreadCount },
    ]},
    { section: 'Intelligence', thai: 'ระบบข้อมูลเชิงลึก', items: [
      { 
        name: 'Dashboard', 
        thai: 'วิเคราะห์และสถิติ', 
        icon: LayoutDashboard, 
        children: [
          { name: 'Overview', thai: 'ภาพรวมระบบ', path: '/' },
          { name: 'Performance', thai: 'สถิติการทำงาน', path: '/analytics' },
        ]
      },
      { name: 'Customers', thai: 'ฐานข้อมูลลูกค้า', icon: Users, path: '/customers' },
      { name: 'Reports', thai: 'รายงาน & Broadcast', icon: Send, children: [
          { name: 'Daily Report', thai: 'สรุปปัญหาประจำวัน', path: '/reports/daily' },
          { name: 'Report Hub', thai: 'ศูนย์ควบคุมการส่งรายงาน', path: '/reports/hub' }
      ] },
    ]},
    { section: 'System', thai: 'การตั้งค่าระบบ', items: [
      { 
        name: 'Settings', 
        thai: 'การตั้งค่า (Settings)', 
        icon: Settings, 
        children: [
          { name: 'Profile', thai: 'ข้อมูลส่วนตัว', path: '/settings/profile' },
          { name: 'Branding', thai: 'ข้อมูลองค์กร', path: '/settings/branding' },
          { name: 'Staff', thai: 'จัดการทีมงาน', path: '/settings/staff' },
          { name: 'SLA', thai: 'ตั้งค่า SLA', path: '/settings/sla' },
          { name: 'Master', thai: 'ข้อมูลพื้นฐาน', path: '/settings/master' },
          { name: 'Security', thai: 'Audit Logs', path: '/settings/audit' },
        ]
      },
    ]},
  ], [inboxCount, newTicketsCount, unreadCount]);

  // OPTIMIZATION: Memoized Permission Check
  const hasAccess = useCallback((name: string) => {
    if (userRole === 'Administrator') return true;
    if (!permissions) return true;
    
    const key = name.toLowerCase();
    if (key.includes('analytics') || key.includes('performance') || key.includes('dashboard')) return permissions.analytics !== 'none';
    if (key.includes('inbox')) return permissions.inbox !== 'none';
    if (key.includes('ticket') || key.includes('create')) return permissions.tickets !== 'none';
    if (key.includes('customer')) return permissions.customers !== 'none';
    if (key.includes('report')) return permissions.reports !== 'none';
    if (key.includes('settings')) return permissions.settings !== 'none';
    
    return true;
  }, [userRole, permissions]);

  const filteredMenuItems = useMemo(() => 
    menuItems.map((section: any) => ({
      ...section,
      items: section.items.filter((item: any) => hasAccess(item.name))
    })).filter((section: any) => section.items.length > 0)
  , [menuItems, hasAccess]);

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      <div style={{ padding: isCollapsed ? '24px 12px' : '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        {company?.logo_url ? (
          <img src={company.logo_url} alt="Company Logo" style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain' }} />
        ) : (
          <div style={{ 
            background: 'var(--primary)', 
            width: '36px', 
            height: '36px', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px var(--primary-glow)',
            flexShrink: 0
          }}>
            <ShieldCheck color="#0a0e14" size={20} />
          </div>
        )}
        {!isCollapsed && (
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', whiteSpace: 'nowrap', letterSpacing: '-0.5px' }}>
             {company?.company_name || 'NEO SUPPORT'}
          </h1>
        )}
      </div>

      {!isCollapsed && hasAccess('ticket') && (
         <div style={{ padding: '0 20px 20px' }}>
            <Link href="/tickets/new" style={{ textDecoration: 'none' }}>
               <button className="glass-interactive" style={{ 
                  width: '100%', 
                  padding: '14px', 
                  borderRadius: '14px', 
                  background: 'linear-gradient(135deg, var(--primary) 0%, var(--border-active) 100%)', 
                  color: 'white', 
                  border: 'none',
                  fontWeight: '700',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 10px 25px var(--primary-transparent)',
                  cursor: 'pointer'
               }}>
                  <Plus size={18} /> สร้างใบงานใหม่
               </button>
            </Link>
         </div>
      )}

      <nav style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {filteredMenuItems.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: '24px' }}>
            {!isCollapsed && (
              <label style={{ 
                fontSize: '10px', 
                fontWeight: '700', 
                color: 'var(--text-dim)', 
                textTransform: 'uppercase', 
                letterSpacing: '0.8px',
                padding: '0 16px',
                marginBottom: '10px',
                display: 'block'
              }}>{section.section}</label>
            )}
            {section.items.map((item: any) => {
              if (item.children) {
                const isOpen = openMenus.includes(item.name);
                return (
                  <div key={item.name} style={{ marginBottom: '4px' }}>
                    <button 
                      onClick={() => !isCollapsed && toggleMenu(item.name)}
                      className="sidebar-btn-premium"
                      title={isCollapsed ? item.thai : undefined}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsed ? '0' : '10px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        color: 'var(--text-muted)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <item.icon size={18} />
                      {!isCollapsed && (
                        <>
                          <span style={{ fontWeight: '500', fontSize: '13px', flex: 1, textAlign: 'left' }}>{item.thai}</span>
                          <div style={{ opacity: 0.5, fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</div>
                        </>
                      )}
                    </button>
                    {isOpen && !isCollapsed && (
                      <div style={{ marginLeft: '28px', borderLeft: '1px solid var(--border)', paddingLeft: '8px', marginTop: '4px' }}>
                        {item.children.map((child: any) => {
                          const isChildActive = pathname === child.path;
                          return (
                            <Link key={child.path} href={child.path} onClick={onClickLink} 
                              style={{
                                display: 'block',
                                padding: '8px 16px',
                                fontSize: '12px',
                                color: isChildActive ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: isChildActive ? '700' : '400',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                background: isChildActive ? 'var(--primary-transparent)' : 'transparent'
                              }}>
                              {child.thai}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = pathname === item.path;
              return (
                <Link key={item.path} href={item.path} onClick={onClickLink} 
                  className={`sidebar-btn-premium ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.thai : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isCollapsed ? '0' : '10px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    marginBottom: '4px',
                    textDecoration: 'none',
                    fontWeight: isActive ? '700' : '400',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  }}>
                  <item.icon size={18} />
                  {!isCollapsed && (
                    <span style={{ fontSize: '13px', flex: 1 }}>{item.thai}</span>
                  )}
                  {!isCollapsed && item.count !== undefined && item.count > 0 && (
                    <span style={{ 
                      fontSize: '10px', 
                      background: 'var(--danger)', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '10px',
                      fontWeight: '700'
                    }}>{item.count}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* User Profile Section at bottom */}
        <div style={{ padding: isCollapsed ? '8px 0' : '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '16px', marginBottom: '8px', border: '1px solid var(--border)' }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
                <div style={{ position: 'relative', width: '38px', height: '38px', flexShrink: 0 }}>
                   <img 
                      src={profile?.avatar_url || 'https://ui-avatars.com/api/?name=' + profile?.full_name} 
                      alt="User Avatar"
                      style={{ width: '38px', height: '38px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }} 
                   />
                   {profile?.department && (
                      <div style={{ position: 'absolute', top: '-5px', right: '-5px', fontSize: '10px', background: 'var(--bg-sidebar)', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', boxShadow: '0 2px 5px rgba(0,0,0,0.5)' }}>
                         {DEPT_BADGES[profile.department] || '💼'}
                      </div>
                   )}
                </div>
                {!isCollapsed && (
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                     <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name || 'Staff User'}</span>
                     <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '600', textTransform: 'uppercase' }}>{userRole || 'Agent'}</span>
                  </div>
                )}
             </div>
        </div>

        {!isCollapsed && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>สลับธีมพรีเมียม</span>
             <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {THEMES.map(t => (
                  <button 
                    key={t.id}
                    onClick={() => changeTheme(t.id)}
                    title={t.thai}
                    className="glass-interactive"
                    style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: t.color, 
                      border: theme === t.id ? `2px solid ${t.iconColor}` : '1px solid var(--border)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: theme === t.id ? `0 0 10px ${t.iconColor}40` : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.iconColor }} />
                  </button>
                ))}
             </div>
           </div>
        )}

        <button 
          onClick={handleLogout}
          className="glass-interactive"
          title={isCollapsed ? 'ออกจากระบบ' : ''}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: isCollapsed ? '0' : '12px',
            padding: isCollapsed ? '12px' : '12px',
            borderRadius: '12px',
            color: 'var(--danger)',
            background: 'rgba(234, 84, 85, 0.05)',
            border: '1px solid rgba(234, 84, 85, 0.1)',
            cursor: 'pointer',
            fontSize: '14px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            fontFamily: 'inherit',
            transition: 'all 0.2s ease'
          }}
        >
          <LogOut size={18} style={{ flexShrink: 0 }} />
          {!isCollapsed && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <span style={{ fontWeight: '700', fontSize: '13px' }}>ออกจากระบบ</span>
              <span style={{ fontSize: '9px', opacity: 0.6, fontWeight: '700' }}>LOGOUT</span>
            </div>
          )}
        </button>
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
          .sidebar-btn-premium {
            position: relative;
          }
          @media (min-width: 1025px) {
            .sidebar-btn-premium:hover::after {
              content: attr(title);
              position: absolute;
              left: 100%;
              margin-left: 12px;
              padding: 8px 14px;
              background: #1e293b;
              color: white;
              font-size: 12px;
              font-weight: 700;
              border-radius: 8px;
              white-space: nowrap;
              z-index: 1000;
              pointer-events: none;
              box-shadow: 0 10px 25px rgba(0,0,0,0.5);
              border: 1px solid rgba(255,255,255,0.15);
              display: ${isCollapsed ? 'block' : 'none'};
              animation: tooltipIn 0.2s ease-out;
            }
          @keyframes tooltipIn {
            from { opacity: 0; transform: translateX(-10px); }
            to { opacity: 1; transform: translateX(0); }
          }
        }
      `}} />
    </aside>
  );
};

export default Sidebar;

