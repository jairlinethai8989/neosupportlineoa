'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Inbox,
  LayoutDashboard,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';

interface SidebarProps {
  onClickLink?: () => void;
  isCollapsed?: boolean;
}

type SidebarChildItem = {
  name: string;
  label: string;
  path: string;
};

type SidebarLinkItem = {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  path: string;
  count?: number;
};

type SidebarGroupItem = {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children: SidebarChildItem[];
};

type SidebarItem = SidebarLinkItem | SidebarGroupItem;

const DEFAULT_OPEN_MENUS = ['Settings', 'Dashboard'];

function isGroupItem(item: SidebarItem): item is SidebarGroupItem {
  return 'children' in item;
}

function MainSidebarComponent({ onClickLink, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { companySettings: company, userProfile: profile } = useAppContext();
  const { unreadCount, newTicketsCount, slaAlertCount } = useNotificationContext();
  const { t } = useStaffLocale();

  const [inboxCount, setInboxCount] = useState(0);
  const [openMenus, setOpenMenus] = useState<string[]>(DEFAULT_OPEN_MENUS);

  const userRole = profile?.role || '';
  const permissions = profile?.permissions || null;

  useEffect(() => {
    supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .then((res) => {
        if (res.count !== null) {
          setInboxCount(res.count);
        }
      });

    const channel = supabase
      .channel('sidebar-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        supabase
          .from('conversations')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')
          .then((res) => {
            if (res.count !== null) {
              setInboxCount(res.count);
            }
          });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }, [router]);

  const toggleMenu = useCallback((name: string) => {
    setOpenMenus((prev) => (prev.includes(name) ? prev.filter((menu) => menu !== name) : [...prev, name]));
  }, []);

  const hasAccess = useCallback(
    (name: string, path?: string) => {
      if (userRole === 'Administrator') return true;
      if (!permissions) return false;

      const key = name.toLowerCase();
      const normalizedPath = path?.toLowerCase() || '';

      if (
        key.includes('analytics') ||
        key.includes('performance') ||
        key.includes('dashboard') ||
        normalizedPath.includes('analytics')
      ) {
        return permissions.analytics === 'view' || permissions.analytics === 'edit';
      }
      if (key.includes('inbox') || normalizedPath.includes('inbox')) {
        return permissions.inbox === 'view' || permissions.inbox === 'edit';
      }
      if (key.includes('ticket') || normalizedPath === '/tickets' || normalizedPath.includes('tickets/')) {
        return permissions.tickets === 'view' || permissions.tickets === 'edit';
      }
      if (normalizedPath.includes('/settings/notifications')) {
        return permissions.notifications === 'view' || permissions.notifications === 'edit';
      }
      if (key.includes('notification')) {
        return permissions.notifications === 'view' || permissions.notifications === 'edit';
      }
      if (key.includes('customer')) {
        return permissions.customers === 'view' || permissions.customers === 'edit';
      }
      if (key.includes('report')) {
        return permissions.reports === 'view' || permissions.reports === 'edit';
      }

      if (normalizedPath.includes('/settings/profile')) {
        return permissions.settings_profile === 'view' || permissions.settings_profile === 'edit';
      }
      if (normalizedPath.includes('/settings/branding')) {
        return permissions.settings_branding === 'view' || permissions.settings_branding === 'edit';
      }
      if (normalizedPath.includes('/settings/staff')) {
        return permissions.settings_staff === 'view' || permissions.settings_staff === 'edit';
      }
      if (normalizedPath.includes('/settings/sla')) {
        return permissions.settings_sla === 'view' || permissions.settings_sla === 'edit';
      }
      if (normalizedPath.includes('/settings/master')) {
        return permissions.settings_master === 'view' || permissions.settings_master === 'edit';
      }
      if (normalizedPath.includes('/settings/audit')) {
        return permissions.settings_audit === 'view' || permissions.settings_audit === 'edit';
      }

      if (key.includes('settings')) return true;

      return false;
    },
    [permissions, userRole]
  );

  const menuSections = useMemo(
    () => [
      {
        section: t('sidebar.sections.operations'),
        items: [
          { name: 'Tickets', label: t('sidebar.menu.tickets'), icon: Ticket, path: '/tickets', count: newTicketsCount },
          { name: 'Inbox', label: t('sidebar.menu.inbox'), icon: Inbox, path: '/inbox', count: inboxCount },
          {
            name: 'Notifications',
            label: t('sidebar.menu.notifications'),
            icon: Bell,
            path: '/notifications',
            count: unreadCount,
          },
        ] satisfies SidebarItem[],
      },
      {
        section: t('sidebar.sections.intelligence'),
        items: [
          {
            name: 'Dashboard',
            label: t('sidebar.menu.dashboard'),
            icon: LayoutDashboard,
            children: [
              { name: 'Overview', label: t('sidebar.menu.overview'), path: '/' },
              { name: 'Performance', label: t('sidebar.menu.performance'), path: '/analytics' },
            ],
          },
          {
            name: 'Reports',
            label: t('sidebar.menu.reports'),
            icon: Send,
            children: [
              { name: 'Daily Report', label: t('sidebar.menu.dailyReport'), path: '/reports/daily' },
              { name: 'Report Hub', label: t('sidebar.menu.reportHub'), path: '/reports/hub' },
            ],
          },
          { name: 'Customers', label: t('sidebar.menu.customers'), icon: Users, path: '/customers' },
        ] satisfies SidebarItem[],
      },
      {
        section: t('sidebar.sections.system'),
        items: [
          {
            name: 'Settings',
            label: t('sidebar.menu.settings'),
            icon: Settings,
            children: [
              { name: 'Profile', label: t('sidebar.menu.profile'), path: '/settings/profile' },
              {
                name: 'Notifications Settings',
                label: t('sidebar.menu.notificationSettings'),
                path: '/settings/notifications',
              },
              { name: 'Branding', label: t('sidebar.menu.branding'), path: '/settings/branding' },
              { name: 'Staff', label: t('sidebar.menu.staff'), path: '/settings/staff' },
              { name: 'SLA', label: t('sidebar.menu.sla'), path: '/settings/sla' },
              { name: 'Master', label: t('sidebar.menu.master'), path: '/settings/master' },
              { name: 'Security', label: t('sidebar.menu.audit'), path: '/settings/audit' },
            ],
          },
        ] satisfies SidebarItem[],
      },
    ],
    [inboxCount, newTicketsCount, t, unreadCount]
  );

  const filteredMenuSections = useMemo(
    () =>
      menuSections
        .map((section) => ({
          ...section,
          items: section.items
            .map((item) => {
              if (!hasAccess(item.name, 'path' in item ? item.path : undefined)) {
                return null;
              }

              if (isGroupItem(item)) {
                const children = item.children.filter((child) => hasAccess(child.name, child.path));
                if (children.length === 0) return null;
                return { ...item, children };
              }

              return item;
            })
            .filter(Boolean) as SidebarItem[],
        }))
        .filter((section) => section.items.length > 0),
    [hasAccess, menuSections]
  );

  return (
    <aside style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-sidebar)' }}>
      <div
        style={{
          padding: isCollapsed ? '24px 12px' : '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}
      >
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt="Company Logo"
            style={{ width: '36px', height: '36px', borderRadius: '8px', objectFit: 'contain' }}
          />
        ) : (
          <div
            style={{
              background: 'var(--primary)',
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px var(--primary-glow)',
              flexShrink: 0,
            }}
          >
            <ShieldCheck color="#0a0e14" size={20} />
          </div>
        )}
        {!isCollapsed && (
          <h1
            style={{
              fontSize: '18px',
              fontWeight: '800',
              color: 'var(--text-main)',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              letterSpacing: '-0.5px',
            }}
          >
            {company?.company_name || 'NEO SUPPORT'}
          </h1>
        )}
      </div>

      {!isCollapsed && hasAccess('ticket') && (
        <div style={{ padding: '0 20px 20px' }}>
          <Link href="/tickets/new" style={{ textDecoration: 'none' }}>
            <button
              className="glass-interactive"
              style={{
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
                cursor: 'pointer',
              }}
            >
              <Plus size={18} />
              {t('sidebar.createTicket')}
            </button>
          </Link>
        </div>
      )}

      <nav style={{ padding: '0 12px', flex: 1, overflowY: 'auto' }} className="no-scrollbar">
        {filteredMenuSections.map((section) => (
          <div key={section.section} style={{ marginBottom: '24px' }}>
            {!isCollapsed && (
              <label
                style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  padding: '0 16px',
                  marginBottom: '10px',
                  display: 'block',
                }}
              >
                {section.section}
              </label>
            )}

            {section.items.map((item) => {
              if (isGroupItem(item)) {
                const isOpen = openMenus.includes(item.name);
                return (
                  <div key={item.name} style={{ marginBottom: '4px' }}>
                    <button
                      onClick={() => !isCollapsed && toggleMenu(item.name)}
                      className="sidebar-btn-premium"
                      title={isCollapsed ? item.label : undefined}
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
                        cursor: 'pointer',
                      }}
                    >
                      <item.icon size={18} />
                      {!isCollapsed && (
                        <>
                          <span style={{ fontWeight: '500', fontSize: '13px', flex: 1, textAlign: 'left' }}>
                            {item.label}
                          </span>
                          <div style={{ opacity: 0.5, fontSize: '10px' }}>{isOpen ? '▼' : '▶'}</div>
                        </>
                      )}
                    </button>

                    {isOpen && !isCollapsed && (
                      <div
                        style={{
                          marginLeft: '28px',
                          borderLeft: '1px solid var(--border)',
                          paddingLeft: '8px',
                          marginTop: '4px',
                        }}
                      >
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.path;

                          return (
                            <Link
                              key={child.path}
                              href={child.path}
                              onClick={onClickLink}
                              style={{
                                display: 'block',
                                padding: '8px 16px',
                                fontSize: '12px',
                                color: isChildActive ? 'var(--primary)' : 'var(--text-muted)',
                                fontWeight: isChildActive ? '700' : '400',
                                textDecoration: 'none',
                                borderRadius: '8px',
                                background: isChildActive ? 'var(--primary-transparent)' : 'transparent',
                              }}
                            >
                              {child.label}
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
                  href={item.path}
                  onClick={onClickLink}
                  className={`sidebar-btn-premium ${isActive ? 'active' : ''}`}
                  title={isCollapsed ? item.label : undefined}
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
                  }}
                >
                  <item.icon size={18} />
                  {!isCollapsed && <span style={{ fontSize: '13px', flex: 1 }}>{item.label}</span>}
                  {!isCollapsed && item.count !== undefined && item.count > 0 && (
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {item.name === 'Notifications' && slaAlertCount > 0 && (
                        <span
                          style={{
                            fontSize: '10px',
                            background: '#ea5455',
                            color: 'white',
                            padding: '2px 4px',
                            borderRadius: '6px',
                            fontWeight: '900',
                            display: 'flex',
                            alignItems: 'center',
                            boxShadow: '0 0 10px rgba(234, 84, 85, 0.4)',
                            animation: 'sidebar-pulse 2s infinite'
                          }}
                        >
                          🔥
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '10px',
                          background: isActive ? 'var(--primary)' : 'var(--primary-transparent)',
                          color: isActive ? '#fff' : 'var(--primary)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontWeight: '700',
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <p style={{ fontSize: '10px', color: 'var(--text-dim)', textAlign: 'center' }}>
          {!isCollapsed && 'Neo Support v1.1.2'}
        </p>
        {!isCollapsed && (
          <button
            onClick={handleLogout}
            className="glass-interactive"
            style={{
              marginTop: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid var(--border)',
              background: 'rgba(234, 84, 85, 0.06)',
              color: 'var(--danger)',
              fontWeight: '800',
              cursor: 'pointer',
            }}
          >
            Logout
          </button>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
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
            }

            @keyframes tooltipIn {
              from { opacity: 0; transform: translateX(-10px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes sidebar-pulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 84, 85, 0.4); }
              50% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(234, 84, 85, 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(234, 84, 85, 0); }
            }
          `,
        }}
      />
    </aside>
  );
}

export default React.memo(MainSidebarComponent);
