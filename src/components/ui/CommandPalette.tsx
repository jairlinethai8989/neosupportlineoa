'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Check,
  FileText,
  Inbox,
  Layers,
  LayoutDashboard,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Sliders,
  Ticket,
  TrendingUp,
  UserCheck,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { useStaffLocale } from '@/contexts/StaffLocaleContext';
import styles from './ui.module.css';

export function hasStaffRouteAccess(
  userRole: string,
  permissions: Record<string, string> | null | undefined,
  name: string,
  path?: string
): boolean {
  if (userRole === 'Administrator') return true;
  if (!permissions) return false;

  const key = name.toLowerCase();
  const normalizedPath = path?.toLowerCase() || '';

  if (normalizedPath === '/analytics/personal') {
    return permissions.analytics_personal === 'view' || permissions.analytics_personal === 'edit';
  }
  if (normalizedPath === '/analytics/staff') {
    return permissions.analytics_staff === 'view' || permissions.analytics_staff === 'edit';
  }
  if (
    key.includes('overview') ||
    normalizedPath === '/' ||
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
  if (normalizedPath.includes('/settings/notifications') || key.includes('notification')) {
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
  if (normalizedPath.includes('/settings/projects')) {
    return userRole === 'Administrator';
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
}

interface CommandItem {
  id: string;
  group: 'navigation' | 'projects';
  label: string;
  keywords: string;
  meta?: string;
  icon: React.ReactNode;
  isSelected?: boolean;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Global Cmd+K / Ctrl+K command palette for fast route navigation and project switching.
 */
export function CommandPalette({ isOpen: controlledOpen, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { userProfile, projects, selectedProjectId, setSelectedProjectId } = useAppContext();
  const { locale, t } = useStaffLocale();

  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const listboxId = useId();
  const titleId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (!next) {
        setQuery('');
        setActiveIndex(0);
      }
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [open, setOpen]);

  // Focus management when palette opens/closes
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      previousFocusRef.current?.focus();
    }
  }, [open]);

  const userRole = userProfile?.role || '';
  const permissions = userProfile?.permissions || null;

  const items = useMemo<CommandItem[]>(() => {
    const navSpecs: Array<{
      id: string;
      name: string;
      path: string;
      label: string;
      keywords: string;
      icon: React.ComponentType<{ size?: number }>;
    }> = [
      { id: 'nav-tickets', name: 'Tickets', path: '/tickets', label: t('sidebar.menu.tickets'), keywords: 'tickets workspace ใบงาน', icon: Ticket },
      { id: 'nav-new-ticket', name: 'ticket', path: '/tickets/new', label: t('sidebar.createTicket'), keywords: 'new create ticket เปิดใบงาน สร้างใบงาน', icon: Plus },
      { id: 'nav-inbox', name: 'Inbox', path: '/inbox', label: t('sidebar.menu.inbox'), keywords: 'inbox chat line แชท ลูกค้า', icon: Inbox },
      { id: 'nav-notifications', name: 'Notifications', path: '/notifications', label: t('sidebar.menu.notifications'), keywords: 'notifications alerts sla แจ้งเตือน', icon: Bell },
      { id: 'nav-overview', name: 'Overview', path: '/', label: t('sidebar.menu.overview'), keywords: 'overview dashboard home ภาพรวม', icon: LayoutDashboard },
      { id: 'nav-analytics', name: 'Analytics', path: '/analytics', label: t('sidebar.menu.performance'), keywords: 'analytics performance สถิติ', icon: TrendingUp },
      { id: 'nav-analytics-personal', name: 'Personal', path: '/analytics/personal', label: t('sidebar.menu.personalPerformance'), keywords: 'personal my performance ผลงาน', icon: UserCheck },
      { id: 'nav-analytics-staff', name: 'StaffAnalytics', path: '/analytics/staff', label: t('sidebar.menu.staffPerformance'), keywords: 'staff analytics team สถิติพนักงาน', icon: Users },
      { id: 'nav-reports-hub', name: 'Reports', path: '/reports/hub', label: t('sidebar.menu.reportHub'), keywords: 'reports hub broadcast รายงาน', icon: Send },
      { id: 'nav-reports-daily', name: 'Reports', path: '/reports/daily', label: t('sidebar.menu.dailyReport'), keywords: 'daily report ประจำวัน', icon: FileText },
      { id: 'nav-customers', name: 'Customers', path: '/customers', label: t('sidebar.menu.customers'), keywords: 'customers hospitals orgs ลูกค้า โรงพยาบาล', icon: Users },
      { id: 'nav-settings-profile', name: 'Profile', path: '/settings/profile', label: t('sidebar.menu.profile'), keywords: 'profile account ข้อมูลส่วนตัว', icon: UserCog },
      { id: 'nav-settings-notif', name: 'Notifications Settings', path: '/settings/notifications', label: t('sidebar.menu.notificationSettings'), keywords: 'notification sound settings เสียงแจ้งเตือน', icon: Bell },
      { id: 'nav-settings-projects', name: 'Projects', path: '/settings/projects', label: t('sidebar.menu.projects'), keywords: 'projects line oa webhook โครงการ', icon: Layers },
      { id: 'nav-settings-branding', name: 'Branding', path: '/settings/branding', label: t('sidebar.menu.branding'), keywords: 'branding organization องค์กร', icon: Settings },
      { id: 'nav-settings-staff', name: 'Staff', path: '/settings/staff', label: t('sidebar.menu.staff'), keywords: 'staff users rbac ทีมงาน', icon: Users },
      { id: 'nav-settings-sla', name: 'SLA', path: '/settings/sla', label: t('sidebar.menu.sla'), keywords: 'sla targets ตั้งค่า', icon: Sliders },
      { id: 'nav-settings-master', name: 'Master', path: '/settings/master', label: t('sidebar.menu.master'), keywords: 'master data modules ข้อมูลพื้นฐาน', icon: Settings },
      { id: 'nav-settings-audit', name: 'Security', path: '/settings/audit', label: t('sidebar.menu.audit'), keywords: 'audit log security บันทึก', icon: Shield },
    ];

    const navItems: CommandItem[] = navSpecs
      .filter((spec) => hasStaffRouteAccess(userRole, permissions, spec.name, spec.path))
      .map((spec) => {
        const Icon = spec.icon;
        return {
          id: spec.id,
          group: 'navigation',
          label: spec.label,
          keywords: `${spec.label} ${spec.keywords} ${spec.path}`,
          meta: spec.path,
          icon: <Icon size={16} aria-hidden="true" />,
          onSelect: () => {
            setOpen(false);
            router.push(spec.path);
          },
        };
      });

    const projectItems: CommandItem[] = [];
    if (projects.length > 0 && (userRole === 'Administrator' || projects.length > 1)) {
      const allLabel =
        locale === 'th'
          ? `แสดงทุกโครงการ (${projects.length})`
          : `All projects (${projects.length})`;
      projectItems.push({
        id: 'project-all',
        group: 'projects',
        label: allLabel,
        keywords: `all projects ทุกโครงการ ${allLabel}`,
        meta: 'ALL',
        icon: <Layers size={16} aria-hidden="true" />,
        isSelected: selectedProjectId === 'all',
        onSelect: () => {
          setSelectedProjectId('all');
          setOpen(false);
        },
      });
    }

    for (const proj of projects) {
      const isSelected =
        selectedProjectId === proj.id || (projects.length === 1 && userRole !== 'Administrator');
      projectItems.push({
        id: `project-${proj.id}`,
        group: 'projects',
        label: proj.name,
        keywords: `${proj.name} ${proj.code} ${proj.organization_label} project โครงการ`,
        meta: proj.code,
        icon: (
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: '9999px',
              background: proj.primary_color || 'var(--color-primary)',
              flexShrink: 0,
            }}
          />
        ),
        isSelected,
        onSelect: () => {
          setSelectedProjectId(proj.id);
          setOpen(false);
        },
      });
    }

    return [...navItems, ...projectItems];
  }, [locale, permissions, projects, router, selectedProjectId, setOpen, setSelectedProjectId, t, userRole]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.keywords.toLowerCase().includes(q));
  }, [items, query]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (filteredItems.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const target = filteredItems[activeIndex];
      target?.onSelect();
    }
  };

  if (!open) return null;

  const navResults = filteredItems.filter((item) => item.group === 'navigation');
  const projectResults = filteredItems.filter((item) => item.group === 'projects');

  const placeholderText =
    locale === 'th' ? 'พิมพ์เพื่อไปหน้าอื่น หรือสลับโครงการ...' : 'Jump to page or switch project...';
  const navGroupLabel = locale === 'th' ? 'หน้าในระบบ' : 'Navigation';
  const projectGroupLabel = locale === 'th' ? 'สลับโครงการ' : 'Switch Project';
  const emptyText = locale === 'th' ? 'ไม่พบรายการที่ตรงกัน' : 'No matching commands found';

  let runningIndex = -1;

  return (
    <div
      className={styles.cmdBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.cmdPanel}
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="sr-only">
          {locale === 'th' ? 'คำสั่งด่วน' : 'Command Palette'}
        </h2>
        <div className={styles.cmdInputRow}>
          <Search size={18} color="var(--color-text-muted)" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder={placeholderText}
            aria-label={placeholderText}
            aria-controls={listboxId}
            aria-activedescendant={filteredItems[activeIndex]?.id}
            className={styles.cmdInput}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={locale === 'th' ? 'ปิดคำสั่งด่วน' : 'Close command palette'}
            className={styles.modalCloseBtn}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div id={listboxId} role="listbox" className={styles.cmdList}>
          {filteredItems.length === 0 ? (
            <div className={styles.cmdEmpty}>{emptyText}</div>
          ) : (
            <>
              {navResults.length > 0 && (
                <div>
                  <div className={styles.cmdGroupLabel}>{navGroupLabel}</div>
                  {navResults.map((item) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        id={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive ? 'true' : undefined}
                        className={styles.cmdItem}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={item.onSelect}
                      >
                        <span className={styles.cmdItemLeft}>
                          {item.icon}
                          <span className={styles.cmdItemLabel}>{item.label}</span>
                        </span>
                        {item.meta ? <span className={styles.cmdItemMeta}>{item.meta}</span> : null}
                      </button>
                    );
                  })}
                </div>
              )}

              {projectResults.length > 0 && (
                <div>
                  <div className={styles.cmdGroupLabel}>{projectGroupLabel}</div>
                  {projectResults.map((item) => {
                    runningIndex += 1;
                    const idx = runningIndex;
                    const isActive = idx === activeIndex;
                    return (
                      <button
                        key={item.id}
                        id={item.id}
                        type="button"
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive ? 'true' : undefined}
                        className={styles.cmdItem}
                        onMouseEnter={() => setActiveIndex(idx)}
                        onClick={item.onSelect}
                      >
                        <span className={styles.cmdItemLeft}>
                          {item.icon}
                          <span className={styles.cmdItemLabel}>{item.label}</span>
                        </span>
                        <span className={styles.cmdItemLeft}>
                          {item.meta ? <span className={styles.cmdItemMeta}>{item.meta}</span> : null}
                          {item.isSelected ? <Check size={14} color="var(--color-primary)" aria-hidden="true" /> : null}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        <div className={styles.cmdFooter}>
          <span>{locale === 'th' ? '↑↓ เลือก • Enter เปิด • Esc ปิด' : '↑↓ Navigate • Enter Open • Esc Close'}</span>
          <span className={styles.cmdKbd}>⌘K</span>
        </div>
      </div>
    </div>
  );
}
