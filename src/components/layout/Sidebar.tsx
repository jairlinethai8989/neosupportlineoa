'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
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
  User
} from 'lucide-react';

interface SidebarProps {
  onClickLink?: () => void;
}

const Sidebar = ({ onClickLink }: SidebarProps) => {
  const pathname = usePathname();
  const router = useRouter();
  const [company, setCompany] = useState<any>(null);

  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    async function fetchBranding() {
       const { data } = await supabase.from('company_settings').select('*').limit(1).single();
       if (data) setCompany(data);
    }
    fetchBranding();

    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
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

  const toggleMenu = (name: string) => {
    setOpenMenus(prev => 
      prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]
    );
  };

  const menuItems = [
    { name: 'Dashboard', thai: 'หน้าหลัก', icon: BarChart2, path: '/' },
    { name: 'Inbox', thai: 'กล่องข้อความ', icon: Inbox, path: '/inbox', count: 5 },
    { name: 'Tickets', thai: 'รายการใบงาน', icon: Ticket, path: '/tickets', count: 12 },
    { name: 'Customers', thai: 'รายชื่อลูกค้า', icon: Users, path: '/customers' },
    { 
      name: 'System Settings', 
      thai: 'ตั้งค่าระบบ', 
      icon: Settings, 
      children: [
        { name: 'Staff Management', thai: 'จัดการพนักงาน', path: '/settings/staff' },
        { name: 'SLA Settings', thai: 'ตั้งค่า SLA', path: '/settings/sla' },
        { name: 'Identity & Branding', thai: 'ข้อมูลองค์กร', path: '/settings/profile' },
      ]
    },
  ];

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      <div style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)'
          }}>
            <ShieldCheck color="#0a0e14" size={20} />
          </div>
        )}
        <h1 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-main)', textTransform: 'uppercase' }}>
           {company?.company_name || 'NEO SUPPORT'}
        </h1>
      </div>

      <nav style={{ padding: '12px', flex: 1 }}>
        {menuItems.map((item) => {
          if (item.children) {
            const isOpen = openMenus.includes(item.name);
            return (
              <div key={item.name} style={{ marginBottom: '6px' }}>
                <button 
                  onClick={() => toggleMenu(item.name)}
                  className="glass-interactive"
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 16px',
                    borderRadius: '10px',
                    color: 'var(--text-muted)',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: 'pointer'
                  }}
                >
                  <item.icon size={18} />
                  <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '600', fontSize: '14px' }}>{item.thai}</span>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', opacity: 0.7 }}>{item.name}</span>
                  </div>
                  <div style={{ marginLeft: 'auto', opacity: 0.5 }}>
                    {isOpen ? '−' : '+'}
                  </div>
                </button>
                
                {isOpen && (
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
              className={`glass-interactive`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 16px',
                borderRadius: '10px',
                marginBottom: '6px',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                background: isActive ? 'rgba(0, 242, 254, 0.1)' : 'transparent',
                border: isActive ? '1px solid rgba(0, 242, 254, 0.2)' : '1px solid transparent',
              }}
            >
              <item.icon size={18} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <span style={{ fontWeight: isActive ? '700' : '600', fontSize: '14px' }}>{item.thai}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', opacity: 0.7 }}>{item.name}</span>
              </div>
              
              {item.count && item.count > 0 && (
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
            padding: '10px',
            borderRadius: '10px',
            color: 'var(--text-main)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {theme === 'dark' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#ffcd3c' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '600' }}>ธีมสว่าง</span>
                <span style={{ fontSize: '9px', opacity: 0.6 }}>LIGHT MODE</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#7367f0' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontWeight: '600' }}>ธีมเข้ม</span>
                <span style={{ fontSize: '9px', opacity: 0.6 }}>DARK MODE</span>
              </div>
            </div>
          )}
        </button>

        <button 
          onClick={handleLogout}
          className="glass-interactive"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px',
            borderRadius: '10px',
            color: 'var(--danger)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          <LogOut size={18} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontWeight: '600' }}>ออกจากระบบ</span>
            <span style={{ fontSize: '9px', opacity: 0.6 }}>LOGOUT</span>
          </div>
        </button>
        
        <div style={{ textAlign: 'center', marginTop: '12px', opacity: 0.5 }}>
           <span style={{ fontSize: '10px', fontWeight: '700', letterSpacing: '1px' }}>VERSION 1.1.0 (UPDATED)</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
