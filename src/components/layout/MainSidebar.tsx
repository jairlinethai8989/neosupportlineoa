'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect } from 'react';
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
  Settings2
} from 'lucide-react';

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

const Sidebar = ({ onClickLink, isCollapsed = false }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);

  const [theme, setTheme] = useState('dark');
  const [permissions, setPermissions] = useState<any>(null);
  const [userRole, setUserRole] = useState<string>('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;
    
    async function fetchUserData() {
       const { data: { user } } = await supabase.auth.getUser();
       if (user && isMounted) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          if (p && isMounted) {
             setProfile(p);
             setUserRole(p.role);
             setPermissions(p.permissions);
          }
       }
    }
    fetchUserData();

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (isMounted) {
      setTimeout(() => {
        if (isMounted) {
          setTheme(savedTheme);
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      }, 0);
    }
    
    async function fetchBranding() {
       const { data } = await supabase.from('company_settings').select('*').limit(1).single();
       if (data && isMounted) setCompany(data);
    }
    fetchBranding();

    return () => { isMounted = false; };
  }, []);

  const THEMES = [
    { id: 'dark', name: 'Dark', thai: 'ธีมเข้ม', color: '#0a0e14', iconColor: '#7367f0' },
    { id: 'light', name: 'Light', thai: 'ธีมสว่าง', color: '#ffffff', iconColor: '#ffcd3c' },
    { id: 'blue', name: 'Blue', thai: 'ธีมฟ้า', color: '#0f172a', iconColor: '#38bdf8' },
    { id: 'purple', name: 'Purple', thai: 'ธีมม่วง', color: '#1e1b4b', iconColor: '#a78bfa' },
    { id: 'gray', name: 'Gray', thai: 'ธีมเทา', color: '#111827', iconColor: '#f3f4f6' },
  ];

  const changeTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [openMenus, setOpenMenus] = useState<string[]>(['System Settings']);

  const [inboxCount, setInboxCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchCounts() {
      // Tickets (Only New)
      const { count: tCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'New');
      if (isMounted) setTicketCount(tCount || 0);

      // Inbox (Active conversations)
      const { count: iCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active');
      if (isMounted) setInboxCount(iCount || 0);

      // Customers (Total)
      const { count: cCount } = await supabase.from('customers').select('*', { count: 'exact', head: true });
      if (isMounted) setCustomerCount(cCount || 0);
    }
    
    fetchCounts();

    // 10-second polling fallback (Balanced for performance)
    const pollInterval = setInterval(fetchCounts, 10000);
    
    const channel = supabase.channel('sidebar-counts-v3')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => { fetchCounts(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => { fetchCounts(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, () => { fetchCounts(); })
      .subscribe();

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const menuItems = [
    { section: 'Dashboard', thai: 'หน้าหลัก', items: [
      { name: 'Analytics', thai: 'ภาพรวมระบบ', icon: LayoutDashboard, path: '/' },
      { name: 'Performance', thai: 'สถิติการทำงาน', icon: BarChart2, path: '/analytics' },
    ]},
    { section: 'Workspace', thai: 'พื้นที่ทำงาน', items: [
      { name: 'Tickets', thai: 'จัดการใบงาน', icon: Ticket, path: '/tickets', count: ticketCount },
      { name: 'Inbox', thai: 'ห้องแชทลูกค้า', icon: Inbox, path: '/inbox', count: inboxCount },
      { name: 'Customers', thai: 'ฐานข้อมูลลูกค้า', icon: Users, path: '/customers', count: customerCount },
    ]},
    { section: 'Admin', thai: 'หลังบ้าน', items: [
      { 
        name: 'Settings', 
        thai: 'ตั้งค่าองค์กร', 
        icon: Settings, 
        children: [
          { name: 'Staff', thai: 'จัดการทีมงาน', path: '/settings/staff' },
          { name: 'SLA', thai: 'ตั้งค่า SLA', path: '/settings/sla' },
          { name: 'Branding', thai: 'ข้อมูลองค์กร', path: '/settings/branding' },
          { name: 'Profile', thai: 'ข้อมูลส่วนตัว', path: '/settings/profile' },
          { name: 'Master', thai: 'ข้อมูลพื้นฐาน', path: '/settings/master' },
          { name: 'Security', thai: 'Audit Logs', path: '/settings/audit' },
        ]
      },
    ]},
  ];

  // Helper to check permission
  const hasAccess = (name: string) => {
    if (userRole === 'Administrator') return true;
    if (!permissions) return true; // Default to show if not loaded yet
    
    const key = name.toLowerCase();
    if (key.includes('analytics') || key.includes('performance')) return permissions.analytics !== 'none';
    if (key.includes('inbox')) return permissions.inbox !== 'none';
    if (key.includes('ticket')) return permissions.tickets !== 'none';
    if (key.includes('customer')) return permissions.customers !== 'none';
    if (key.includes('settings')) return permissions.settings !== 'none';
    
    return true;
  };

  const filteredMenuItems = menuItems.map((section: any) => ({
    ...section,
    items: section.items.filter((item: any) => hasAccess(item.name))
  })).filter((section: any) => section.items.length > 0);

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      <div style={{ padding: isCollapsed ? '24px 12px' : '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        {company?.logo_url ? (
          <img src={company.logo_url} style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain' }} />
        ) : (
          <div style={{ 
            background: 'var(--primary)', 
            width: '36px', 
            height: '36px', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)',
            flexShrink: 0
          }}>
            <ShieldCheck color="#0a0e14" size={20} />
          </div>
        )}
        {!isCollapsed && (
          <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
             {company?.company_name || 'NEO SUPPORT'}
          </h1>
        )}
      </div>

      <nav style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {filteredMenuItems.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: '24px' }}>
            {!isCollapsed && (
              <label style={{ 
                fontSize: '10px', 
                fontWeight: '800', 
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
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: isCollapsed ? '0' : '10px',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        color: isOpen ? 'var(--primary)' : 'var(--text-muted)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                      }}
                    >
                      <item.icon size={18} />
                      {!isCollapsed && (
                        <>
                          <span style={{ fontWeight: '600', fontSize: '13px', flex: 1, textAlign: 'left' }}>{item.thai}</span>
                          <div style={{ opacity: 0.5, fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</div>
                        </>
                      )}
                    </button>
                    {isOpen && !isCollapsed && (
                      <div style={{ marginLeft: '28px', borderLeft: '1px solid var(--border)', paddingLeft: '8px', marginTop: '4px' }}>
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.path;
                          return (
                            <Link key={child.path} href={child.path} onClick={onClickLink} 
                              style={{
                                display: 'block',
                                padding: '8px 16px',
                                fontSize: '12px',
                                color: isChildActive ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: isChildActive ? '700' : '500',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                background: isChildActive ? 'rgba(54, 153, 255, 0.08)' : 'transparent'
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
                <Link key={item.path} href={item.path} onClick={onClickLink} className={`sidebar-btn-premium ${isActive ? 'active' : ''}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isCollapsed ? '0' : '10px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    marginBottom: '4px',
                    color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(54, 153, 255, 0.08)' : 'transparent',
                    textDecoration: 'none',
                    fontWeight: isActive ? '700' : '500',
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
                      fontWeight: '800'
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
                     <span style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profile?.full_name || 'Staff User'}</span>
                     <span style={{ fontSize: '10px', color: 'var(--primary)', fontWeight: '700', textTransform: 'uppercase' }}>{userRole || 'Agent'}</span>
                  </div>
                )}
             </div>
        </div>

        {!isCollapsed && (
           <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
             <span style={{ fontSize: '10px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>สลับธีมพรีเมียม</span>
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
              <span style={{ fontSize: '9px', opacity: 0.6, fontWeight: '800' }}>LOGOUT</span>
            </div>
          )}
        </button>
        
        {!isCollapsed && (
          <div style={{ textAlign: 'center', marginTop: '12px', opacity: 0.3 }}>
             <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>VERSION 1.2.0 (THEME STABLE)</span>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .sidebar-btn {
          position: relative;
        }
        @media (min-width: 1025px) {
          .sidebar-btn:hover::after {
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
          @keyframes notifPulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.6); }
            70% { transform: scale(1.05); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        }
      `}} />
    </aside>
  );
};

export default Sidebar;
