'use client';
import Image from 'next/image';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { isAdminRole } from '@/lib/services/auditLogService';
import type { CompanySettings } from '@/types';
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
  LayoutDashboard
} from 'lucide-react';

interface SidebarProps {
  onClickLink?: () => void;
  isCollapsed?: boolean;
}

const Sidebar = ({ onClickLink, isCollapsed = false }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    let isMounted = true;
    
    async function fetchBranding() {
       const [{ data }, { data: authData }] = await Promise.all([
         supabase.from('company_settings').select('*').limit(1).single(),
         supabase.auth.getUser(),
       ]);
       if (data && isMounted) setCompany(data);
       if (authData.user && isMounted) {
         const { data: profile } = await supabase
           .from('profiles')
           .select('role')
           .eq('id', authData.user.id)
           .single();
         if (isMounted) setIsAdmin(isAdminRole(profile?.role));
       }
    }
    fetchBranding();

    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (isMounted) {
      setTimeout(() => {
        if (isMounted) {
          setTheme(savedTheme);
          document.documentElement.setAttribute('data-theme', savedTheme);
        }
      }, 0);
    }
    
    return () => { isMounted = false; };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const [openMenus, setOpenMenus] = useState<string[]>(['Settings']);
  const [inboxCount, setInboxCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchCounts() {
      // Tickets (Only New)
      const { count: tCount } = await supabase.from('tickets').select('*', { count: 'exact', head: true }).eq('status', 'New');
      if (isMounted) {
        setTimeout(() => {
          if (isMounted) {
            setTicketCount(tCount || 0);
          }
        }, 0);
      }

      // Inbox (Active conversations)
      const { count: iCount } = await supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'active');
      if (isMounted) {
        setTimeout(() => {
          if (isMounted) {
            setInboxCount(iCount || 0);
          }
        }, 0);
      }
    }
    
    fetchCounts();

    // Subscribe to listen to tickets/conversations changes
    const channel = supabase.channel('sidebar-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
        fetchCounts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchCounts();
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const menuItems = [
    { name: 'Dashboard', thai: 'หน้าหลัก', icon: LayoutDashboard, path: '/' },
    { name: 'Tickets', thai: 'รายการใบงาน', icon: Ticket, path: '/tickets', count: ticketCount },
    { name: 'Inbox', thai: 'กล่องข้อความ', icon: Inbox, path: '/inbox', count: inboxCount },
    { name: 'Analytics', thai: 'สถิติ', icon: BarChart2, path: '/analytics' },
    { name: 'Customers', thai: 'รายชื่อลูกค้า', icon: Users, path: '/customers' },
    { 
      name: 'System Settings', 
      thai: 'ตั้งค่าระบบ', 
      icon: Settings, 
      children: [
        { name: 'Staff Management', thai: 'จัดการพนักงาน', path: '/settings/staff' },
        { name: 'SLA Settings', thai: 'ตั้งค่า SLA', path: '/settings/sla' },
        { name: 'Identity & Branding', thai: 'ข้อมูลองค์กร', path: '/settings/profile' },
        { name: 'Master Data', thai: 'ตั้งค่าพื้นฐาน (รพ./แผนก)', path: '/settings/master' },
        ...(isAdmin ? [{ name: 'Audit Logs', thai: 'ประวัติการใช้งานระบบ', path: '/settings/audit-logs' }] : []),
      ]
    },
  ];

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      <div style={{ padding: isCollapsed ? '24px 12px' : '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
        {company?.logo_url ? (
          <Image src={company.logo_url} alt="Company logo" width={36} height={36} style={{ borderRadius: '8px', objectFit: 'contain' }} />
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

      <nav style={{ padding: '12px', flex: 1 }}>
        {menuItems.map((item) => {
          if (item.children) {
            const isOpen = openMenus.includes(item.name);
            return (
              <div key={item.name} style={{ marginBottom: '6px', position: 'relative' }} className="menu-item-container">
                <button 
                  onClick={() => !isCollapsed && toggleMenu(item.name)}
                  className="glass-interactive sidebar-btn"
                  title={isCollapsed ? item.thai : ''}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isCollapsed ? '0' : '12px',
                    padding: isCollapsed ? '12px' : '10px 16px',
                    borderRadius: '10px',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer',
                    justifyContent: isCollapsed ? 'center' : 'flex-start'
                  }}
                >
                  <item.icon size={18} style={{ flexShrink: 0 }} />
                  {!isCollapsed && (
                    <>
                      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.thai}</span>
                        <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7 }}>{item.name}</span>
                      </div>
                      <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                        {isOpen ? '−' : '+'}
                      </div>
                    </>
                  )}
                </button>
                
                {isOpen && !isCollapsed && (
                  <div style={{ paddingLeft: '24px', marginTop: '4px', borderLeft: '1px solid var(--border)', marginLeft: '24px' }}>
                    {item.children.map((child) => {
                      const isActive = pathname === child.path;
                      return (
                        <Link 
                          key={child.path} 
                          href={child.path}
                          onClick={onClickLink}
                          className="glass-interactive"
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0px',
                            padding: '8px 16px',
                            borderRadius: '8px',
                            marginBottom: '4px',
                            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                            background: isActive ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                            border: isActive ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid transparent',
                            lineHeight: '1.2'
                          }}
                        >
                          <span style={{ fontWeight: isActive ? '700' : '500', fontSize: '13px' }}>{child.thai}</span>
                          <span style={{ fontSize: '9px', opacity: 0.6 }}>{child.name.toUpperCase()}</span>
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
            <Link 
              key={item.path} 
              href={item.path || '#'}
              onClick={onClickLink}
              title={isCollapsed ? item.thai : ''}
              className={`glass-interactive sidebar-btn ${isActive ? 'active' : ''}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isCollapsed ? '0' : '12px',
                padding: isCollapsed ? '12px' : '10px 16px',
                borderRadius: '10px',
                marginBottom: '6px',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: isActive ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid transparent',
              }}
            >
              <item.icon size={18} style={{ flexShrink: 0 }} />
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                  <span style={{ fontWeight: isActive ? '700' : '600', fontSize: '14px' }}>{item.thai}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', opacity: 0.7 }}>{item.name}</span>
                </div>
              )}
              
              {!isCollapsed && item.count && item.count > 0 && (
                <div style={{
                  marginLeft: 'auto',
                  background: 'var(--accent)',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 8px',
                  borderRadius: '20px',
                  boxShadow: '0 0 10px rgba(248, 43, 96, 0.4)'
                }}>
                  {item.count}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          onClick={toggleTheme}
          className="glass-interactive"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px',
            borderRadius: '12px',
            color: 'var(--text-main)',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            fontSize: '14px',
            transition: 'all 0.2s ease'
          }}
        >
          {theme === 'dark' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#ffcd3c', boxShadow: '0 0 10px rgba(255, 205, 60, 0.4)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '700', fontSize: '13px' }}>ธีมสว่าง</span>
                <span style={{ fontSize: '9px', opacity: 0.6, fontWeight: '800' }}>LIGHT MODE</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '100%' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#7367f0', boxShadow: '0 0 10px rgba(115, 103, 240, 0.4)' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '700', fontSize: '13px' }}>ธีมเข้ม</span>
                <span style={{ fontSize: '9px', opacity: 0.6, fontWeight: '800' }}>DARK MODE</span>
              </div>
            </div>
          )}
        </button>

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
        }
      `}} />
    </aside>
  );
};

export default Sidebar;
