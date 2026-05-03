'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
import MainSidebar from '@/components/layout/MainSidebar';
import { TopBar } from '@/components/layout/TopBar';
import ToastContainer from '@/components/notifications/ToastContainer';
import { AppProvider, useAppContext } from '@/contexts/AppContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { StaffLocaleProvider } from '@/contexts/StaffLocaleContext';

function DashboardInner({ children }: { children: React.ReactNode }) {
  const { userProfile: agent, loading: appLoading } = useAppContext();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  if (appLoading) {
    return (
      <div className="flex-center" style={{ height: '100vh', background: 'var(--bg-main)' }}>
        <Loader2 className="animate-spin" color="var(--primary)" size={40} />
      </div>
    );
  }

  return (
    <div className="main-layout">
      <ToastContainer />

      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />}

      <div
        className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
        style={{
          width:
            typeof window !== 'undefined' && window.innerWidth > 1024
              ? isSidebarCollapsed
                ? '80px'
                : '280px'
              : '280px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease, left 0.3s ease',
        }}
      >
        <MainSidebar isCollapsed={isSidebarCollapsed} onClickLink={() => setIsSidebarOpen(false)} />
      </div>

      <main className="content-area">
        <TopBar isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} isSidebarCollapsed={isSidebarCollapsed} setIsSidebarCollapsed={setIsSidebarCollapsed} />

        <div
          style={{
            flex: 1,
            padding: '24px',
            overflowX: 'hidden',
            overflowY: 'auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --primary-rgb: 59, 130, 246;
            }
            .hover-item:hover {
              background: rgba(255,255,255,0.05) !important;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.4; }
            }
            .sidebar.collapsed {
              width: 80px !important;
            }
            @media (max-width: 1024px) {
              .show-desktop { display: none !important; }
            }
          `,
        }}
      />
    </div>
  );
}

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppProvider>
      <StaffLocaleProvider>
        <NotificationProvider>
          <DashboardInner>{children}</DashboardInner>
        </NotificationProvider>
      </StaffLocaleProvider>
    </AppProvider>
  );
}

