'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import MainSidebar from '@/components/layout/MainSidebar';
import { TopBar } from '@/components/layout/TopBar';
import ToastContainer from '@/components/notifications/ToastContainer';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { StaffLocaleProvider } from '@/contexts/StaffLocaleContext';
import { SWRProvider } from '@/lib/swr-config';
import type { DashboardBootstrapData } from '@/lib/server/dashboardBootstrap';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { loading: appLoading } = useAppContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  if (appLoading) {
    return (
      <div
        className="flex-center"
        style={{ height: '100vh', background: 'var(--color-canvas)' }}
        role="status"
        aria-label="Loading workspace"
      >
        <Loader2 className="animate-spin" color="var(--color-primary)" size={36} aria-hidden="true" />
      </div>
    );
  }

  return (
    <NotificationProvider>
      <div className="shell-layout">
        <ToastContainer />
        <CommandPalette isOpen={isCommandPaletteOpen} onOpenChange={setIsCommandPaletteOpen} />

        {isSidebarOpen && (
          <button
            type="button"
            aria-label="Close navigation menu"
            className="shell-sidebar-backdrop"
            style={{ border: 'none' }}
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        <div
          className={`shell-sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
        >
          <MainSidebar isCollapsed={isSidebarCollapsed} onClickLink={() => setIsSidebarOpen(false)} />
        </div>

        <div className="shell-main-column">
          <TopBar
            isSidebarOpen={isSidebarOpen}
            setIsSidebarOpen={setIsSidebarOpen}
            isSidebarCollapsed={isSidebarCollapsed}
            setIsSidebarCollapsed={setIsSidebarCollapsed}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          />

          <main id="main-content" tabIndex={-1} className="shell-content">
            {children}
          </main>
        </div>
      </div>
    </NotificationProvider>
  );
}

export function DashboardShell({
  children,
  initialBootstrap,
}: {
  children: React.ReactNode;
  initialBootstrap: DashboardBootstrapData | null;
}) {
  return (
    <AppProvider initialBootstrap={initialBootstrap}>
      <StaffLocaleProvider>
        <SWRProvider>
          <DashboardInner>{children}</DashboardInner>
        </SWRProvider>
      </StaffLocaleProvider>
    </AppProvider>
  );
}
