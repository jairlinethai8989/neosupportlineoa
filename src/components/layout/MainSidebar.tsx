'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Flame,
  Inbox,
  Layers,
  LayoutDashboard,
  Plus,
  Send,
  Settings,
  ShieldCheck,
  Ticket,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useNotificationContext } from '@/contexts/NotificationContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import { hasStaffRouteAccess } from '@/components/ui/CommandPalette';

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
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  path: string;
  count?: number;
};

type SidebarGroupItem = {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;
  children: SidebarChildItem[];
};

type SidebarItem = SidebarLinkItem | SidebarGroupItem;

function isGroupItem(item: SidebarItem): item is SidebarGroupItem {
  return 'children' in item;
}

function MainSidebarComponent({ onClickLink, isCollapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const {
    companySettings: company,
    userProfile: profile,
    projects,
    selectedProjectId,
    setSelectedProjectId,
    activeProject,
    onlineUserIds,
    updateStatus,
  } = useAppContext();
  const { unreadCount, newTicketsCount, slaAlertCount, inboxCount } = useNotificationContext();
  const { locale, t } = useStaffLocale();

  const [openMenus, setOpenMenus] = useState<string[]>(() => {
    if (pathname.startsWith('/settings/profile') || pathname.startsWith('/settings/notifications')) {
      return ['SettingsPersonal'];
    }
    if (pathname.startsWith('/settings/')) {
      return ['Settings'];
    }
    return [];
  });
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<{ label: string; top: number } | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(event.target as Node)) {
        setShowProjectMenu(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const handleMouseEnter = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, label: string) => {
      if (!isCollapsed) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const asideElement = event.currentTarget.closest('aside');
      if (asideElement) {
        const asideRect = asideElement.getBoundingClientRect();
        setHoveredItem({
          label,
          top: rect.top - asideRect.top + rect.height / 2,
        });
      }
    },
    [isCollapsed]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredItem(null);
  }, []);

  const userRole = profile?.role || '';
  const permissions = profile?.permissions || null;

  const toggleMenu = useCallback((name: string) => {
    setOpenMenus((prev) => (prev.includes(name) ? prev.filter((menu) => menu !== name) : [...prev, name]));
  }, []);

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
          { name: 'Overview', label: t('sidebar.menu.overview'), icon: LayoutDashboard, path: '/' },
          { name: 'Analytics', label: t('sidebar.menu.performance'), icon: TrendingUp, path: '/analytics' },
          { name: 'Reports', label: t('sidebar.menu.reports'), icon: Send, path: '/reports/hub' },
          { name: 'Customers', label: t('sidebar.menu.customers'), icon: Users, path: '/customers' },
        ] satisfies SidebarItem[],
      },
      {
        section: t('sidebar.sections.system'),
        items: [
          {
            name: 'SettingsPersonal',
            label: t('sidebar.menu.settingsPersonal'),
            icon: UserCog,
            children: [
              { name: 'Profile', label: t('sidebar.menu.profile'), path: '/settings/profile' },
              {
                name: 'Notifications Settings',
                label: t('sidebar.menu.notificationSettings'),
                path: '/settings/notifications',
              },
            ],
          },
          {
            name: 'Settings',
            label: t('sidebar.menu.settingsSystem'),
            icon: Settings,
            children: [
              { name: 'Projects', label: t('sidebar.menu.projects'), path: '/settings/projects' },
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
              if (!hasStaffRouteAccess(userRole, permissions, item.name, 'path' in item ? item.path : undefined)) {
                return null;
              }
              if (isGroupItem(item)) {
                const children = item.children.filter((child) =>
                  hasStaffRouteAccess(userRole, permissions, child.name, child.path)
                );
                if (children.length === 0) return null;
                return { ...item, children };
              }
              return item;
            })
            .filter(Boolean) as SidebarItem[],
        }))
        .filter((section) => section.items.length > 0),
    [menuSections, permissions, userRole]
  );

  const activeProjectLabel = useMemo(() => {
    if (selectedProjectId === 'all') {
      if (userRole === 'Administrator') {
        return locale === 'th' ? `ทุกโครงการ (${projects.length})` : `All projects (${projects.length})`;
      }
      if (projects.length === 1) return projects[0].name;
      return locale === 'th' ? `โครงการที่ดูแล (${projects.length})` : `My projects (${projects.length})`;
    }
    return activeProject?.name || (locale === 'th' ? 'เลือกโครงการ' : 'Select project');
  }, [activeProject?.name, locale, projects, selectedProjectId, userRole]);

  const isOnline = profile?.status === 'Active';
  const onlineCount = onlineUserIds.length;
  const canCreateTicket = hasStaffRouteAccess(userRole, permissions, 'ticket');

  return (
    <aside
      aria-label={locale === 'th' ? 'เมนูหลัก' : 'Primary sidebar'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--color-surface)',
        position: 'relative',
      }}
    >
      {/* Brand header */}
      <div
        style={{
          height: 'var(--topbar-height)',
          padding: isCollapsed ? '0 var(--space-3)' : '0 var(--space-4)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid var(--color-border)',
          flexShrink: 0,
        }}
      >
        {company?.logo_url ? (
          <img
            src={company.logo_url}
            alt={company.company_name || 'Company Logo'}
            style={{ width: 28, height: 28, borderRadius: 'var(--radius-sm)', objectFit: 'contain', flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              background: 'var(--color-primary-solid)',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldCheck color="#ffffff" size={16} aria-hidden="true" />
          </div>
        )}
        {!isCollapsed && (
          <span
            className="truncate"
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.01em',
            }}
          >
            {company?.company_name || 'NEO SUPPORT'}
          </span>
        )}
      </div>

      {/* Multi-Project Switcher (Linear/Notion placement at top of sidebar) */}
      {projects.length > 0 && (
        <div
          ref={projectMenuRef}
          style={{
            padding: isCollapsed ? 'var(--space-3) var(--space-2) 0' : 'var(--space-3) var(--space-3) 0',
            position: 'relative',
          }}
        >
          <button
            type="button"
            onClick={() => setShowProjectMenu((prev) => !prev)}
            aria-expanded={showProjectMenu}
            aria-haspopup="listbox"
            aria-label={locale === 'th' ? `สลับโครงการ: ${activeProjectLabel}` : `Switch project: ${activeProjectLabel}`}
            onMouseEnter={(e) => handleMouseEnter(e, activeProjectLabel)}
            onMouseLeave={handleMouseLeave}
            style={{
              width: '100%',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'space-between',
              gap: '8px',
              padding: isCollapsed ? '0' : '0 10px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface-subtle)',
              color: 'var(--color-text)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              transition: 'var(--transition-colors)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              {activeProject ? (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: activeProject.primary_color || 'var(--color-primary)',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Layers size={14} color="var(--color-primary)" aria-hidden="true" style={{ flexShrink: 0 }} />
              )}
              {!isCollapsed && (
                <span className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                  {activeProjectLabel}
                </span>
              )}
            </span>
            {!isCollapsed && <ChevronsUpDown size={14} color="var(--color-text-muted)" aria-hidden="true" style={{ flexShrink: 0 }} />}
          </button>

          {showProjectMenu && (
            <div
              role="listbox"
              aria-label={locale === 'th' ? 'รายการโครงการ' : 'Projects'}
              style={{
                position: 'absolute',
                top: isCollapsed ? 'var(--space-3)' : 'calc(100% + 6px)',
                left: isCollapsed ? 'calc(100% + 8px)' : 'var(--space-3)',
                right: isCollapsed ? 'auto' : 'var(--space-3)',
                minWidth: isCollapsed ? '230px' : 'auto',
                padding: '6px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 'var(--z-popover)',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {(userRole === 'Administrator' || projects.length > 1) && (
                <button
                  type="button"
                  role="option"
                  aria-selected={selectedProjectId === 'all'}
                  onClick={() => {
                    setSelectedProjectId('all');
                    setShowProjectMenu(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    padding: '7px 8px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    background: selectedProjectId === 'all' ? 'var(--color-primary-soft)' : 'transparent',
                    color: selectedProjectId === 'all' ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: selectedProjectId === 'all' ? 600 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <Layers size={14} color="var(--color-primary)" aria-hidden="true" />
                    <span className="truncate">
                      {userRole === 'Administrator'
                        ? locale === 'th'
                          ? `ทุกโครงการทั้งหมด (${projects.length})`
                          : `All projects (${projects.length})`
                        : locale === 'th'
                          ? `ทุกโครงการที่ดูแล (${projects.length})`
                          : `My projects (${projects.length})`}
                    </span>
                  </span>
                  {selectedProjectId === 'all' && <Check size={14} color="var(--color-primary)" aria-hidden="true" />}
                </button>
              )}

              {projects.map((proj) => {
                const isSelected =
                  selectedProjectId === proj.id || (projects.length === 1 && userRole !== 'Administrator');
                return (
                  <button
                    key={proj.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setShowProjectMenu(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      padding: '7px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: isSelected ? 'var(--color-primary-soft)' : 'transparent',
                      color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: isSelected ? 600 : 500,
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 'var(--radius-full)',
                          background: proj.primary_color || 'var(--color-primary)',
                          flexShrink: 0,
                        }}
                      />
                      <span className="mono" style={{ fontSize: '10px', fontWeight: 700, opacity: 0.75 }}>
                        {proj.code}
                      </span>
                      <span className="truncate">{proj.name}</span>
                    </span>
                    {isSelected && <Check size={14} color="var(--color-primary)" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Primary New Ticket CTA */}
      {canCreateTicket && (
        <div style={{ padding: isCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3)' }}>
          <Link
            href="/tickets/new"
            onClick={onClickLink}
            aria-label={isCollapsed ? t('sidebar.createTicket') : undefined}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => handleMouseEnter(e, t('sidebar.createTicket'))}
            onMouseLeave={handleMouseLeave}
            style={{
              width: '100%',
              height: '38px',
              padding: isCollapsed ? '0' : '0 12px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-primary-solid)',
              color: 'var(--color-on-primary)',
              fontWeight: 600,
              fontSize: 'var(--text-sm)',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'var(--transition-colors)',
            }}
          >
            <Plus size={16} aria-hidden="true" />
            {!isCollapsed && <span>{t('sidebar.createTicket')}</span>}
          </Link>
        </div>
      )}

      {/* Navigation Sections */}
      <nav
        aria-label={locale === 'th' ? 'หมวดหมู่เมนู' : 'Navigation sections'}
        style={{ padding: isCollapsed ? '0 var(--space-2)' : '0 var(--space-3)', flex: 1, overflowY: 'auto' }}
        className="no-scrollbar"
      >
        {filteredMenuSections.map((section) => (
          <div key={section.section} style={{ marginBottom: 'var(--space-5)' }}>
            {!isCollapsed && (
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-text-subtle)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  padding: '0 10px',
                  marginBottom: '6px',
                }}
              >
                {section.section}
              </div>
            )}

            {section.items.map((item) => {
              if (isGroupItem(item)) {
                const isOpen = openMenus.includes(item.name);
                const hasActiveChild = item.children.some((child) => pathname === child.path);
                return (
                  <div key={item.name} style={{ marginBottom: '2px' }}>
                    <button
                      type="button"
                      onClick={() => !isCollapsed && toggleMenu(item.name)}
                      aria-expanded={isOpen}
                      aria-label={isCollapsed ? item.label : undefined}
                      className={`sidebar-btn-premium ${hasActiveChild ? 'active' : ''}`}
                      onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => handleMouseEnter(e, item.label)}
                      onMouseLeave={handleMouseLeave}
                      style={{
                        width: '100%',
                        height: '36px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        gap: isCollapsed ? '0' : '10px',
                        padding: isCollapsed ? '0' : '0 10px',
                        borderRadius: 'var(--radius-md)',
                        background: 'transparent',
                        border: 'none',
                      }}
                    >
                      <item.icon size={17} aria-hidden={true} />
                      {!isCollapsed && (
                        <>
                          <span
                            className="truncate"
                            style={{
                              fontWeight: isOpen || hasActiveChild ? 600 : 500,
                              fontSize: 'var(--text-sm)',
                              flex: 1,
                              textAlign: 'left',
                            }}
                          >
                            {item.label}
                          </span>
                          <span style={{ opacity: 0.65, display: 'inline-flex', alignItems: 'center' }} aria-hidden="true">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </span>
                        </>
                      )}
                    </button>

                    {isOpen && !isCollapsed && (
                      <div
                        style={{
                          marginLeft: '18px',
                          borderLeft: '1px solid var(--color-border)',
                          paddingLeft: '10px',
                          marginTop: '2px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                        }}
                      >
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.path;
                          return (
                            <Link
                              key={child.path}
                              href={child.path}
                              onClick={onClickLink}
                              aria-current={isChildActive ? 'page' : undefined}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: '32px',
                                padding: '0 10px',
                                fontSize: 'var(--text-xs)',
                                color: isChildActive ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                fontWeight: isChildActive ? 600 : 500,
                                textDecoration: 'none',
                                borderRadius: 'var(--radius-sm)',
                                background: isChildActive ? 'var(--color-primary-soft)' : 'transparent',
                                transition: 'var(--transition-colors)',
                              }}
                            >
                              <span className="truncate">{child.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              const isActive = item.path === '/' ? pathname === '/' : pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={onClickLink}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={isCollapsed ? item.label : undefined}
                  className={`sidebar-btn-premium ${isActive ? 'active' : ''}`}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => handleMouseEnter(e, item.label)}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? '0' : '10px',
                    padding: isCollapsed ? '0' : '0 10px',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '2px',
                    textDecoration: 'none',
                    fontWeight: isActive ? 600 : 500,
                  }}
                >
                  <item.icon size={17} aria-hidden={true} />
                  {!isCollapsed && (
                    <span className="truncate" style={{ fontSize: 'var(--text-sm)', flex: 1 }}>
                      {item.label}
                    </span>
                  )}
                  {!isCollapsed && item.count !== undefined && item.count > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      {item.name === 'Notifications' && slaAlertCount > 0 && (
                        <span
                          aria-label={locale === 'th' ? 'มีแจ้งเตือน SLA' : 'SLA alerts'}
                          style={{
                            background: 'var(--color-danger)',
                            color: '#ffffff',
                            width: 18,
                            height: 18,
                            borderRadius: 'var(--radius-sm)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Flame size={10} aria-hidden="true" />
                        </span>
                      )}
                      <span
                        className="tabular-nums"
                        style={{
                          fontSize: '11px',
                          background: isActive ? 'var(--color-primary-solid)' : 'var(--color-primary-soft)',
                          color: isActive ? 'var(--color-on-primary)' : 'var(--color-primary)',
                          padding: '1px 7px',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                          lineHeight: '16px',
                        }}
                      >
                        {item.count}
                      </span>
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Agent Profile + Presence/Online Status + Version Footer */}
      <div
        style={{
          padding: isCollapsed ? 'var(--space-3) var(--space-2)' : 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => void updateStatus(isOnline ? 'Busy' : 'Active')}
          title={
            isOnline
              ? `${t('dashboard.statusActive')} — ${locale === 'th' ? 'คลิกเพื่อสลับเป็นติดงาน' : 'Click to set Busy'}`
              : `${t('dashboard.statusBusy')} — ${locale === 'th' ? 'คลิกเพื่อสลับเป็นพร้อมทำงาน' : 'Click to set Active'}`
          }
          aria-label={
            isCollapsed
              ? `${profile?.full_name || t('dashboard.agentFallback')} (${isOnline ? t('dashboard.statusActive') : t('dashboard.statusBusy')})`
              : undefined
          }
          onMouseEnter={(e) =>
            handleMouseEnter(
              e,
              `${profile?.full_name || t('dashboard.agentFallback')} • ${isOnline ? t('dashboard.statusActive') : t('dashboard.statusBusy')}`
            )
          }
          onMouseLeave={handleMouseLeave}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: '10px',
            padding: isCollapsed ? '4px' : '6px 8px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-subtle)',
            textAlign: 'left',
            transition: 'var(--transition-colors)',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name || 'Agent avatar'}
                style={{ width: 28, height: 28, borderRadius: 'var(--radius-full)', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 'var(--radius-full)',
                  background: 'var(--color-primary-solid)',
                  color: 'var(--color-on-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                {profile?.full_name?.charAt(0) || 'A'}
              </div>
            )}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 9,
                height: 9,
                borderRadius: 'var(--radius-full)',
                border: '2px solid var(--color-surface)',
                background: isOnline ? 'var(--color-success)' : 'var(--color-warning)',
              }}
            />
          </div>

          {!isCollapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="truncate"
                style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.25 }}
              >
                {profile?.full_name || t('dashboard.agentFallback')}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: isOnline ? 'var(--color-success-text)' : 'var(--color-warning-text)',
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '4px',
                }}
              >
                <span className="truncate">{isOnline ? t('dashboard.statusActive') : t('dashboard.statusBusy')}</span>
                {onlineCount > 0 && (
                  <span className="tabular-nums" style={{ color: 'var(--color-text-muted)', fontSize: '10px' }}>
                    {onlineCount} online
                  </span>
                )}
              </div>
            </div>
          )}
        </button>

        {!isCollapsed && (
          <p
            className="mono"
            style={{
              fontSize: '11px',
              color: 'var(--color-text-subtle)',
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            Neo Support v2.0.0
          </p>
        )}
      </div>

      {/* Collapsed Sidebar Tooltip */}
      {hoveredItem && isCollapsed && (
        <div
          role="tooltip"
          style={{
            position: 'absolute',
            left: '100%',
            top: `${hoveredItem.top}px`,
            transform: 'translateY(-50%)',
            marginLeft: '10px',
            padding: '6px 10px',
            background: 'var(--color-text)',
            color: 'var(--color-canvas)',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            borderRadius: 'var(--radius-md)',
            whiteSpace: 'nowrap',
            zIndex: 'var(--z-popover)',
            pointerEvents: 'none',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {hoveredItem.label}
        </div>
      )}
    </aside>
  );
}

export default React.memo(MainSidebarComponent);
