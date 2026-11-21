import React from 'react';
import { DashboardShell } from '@/components/layout/DashboardShell';
import {
  getRequestDashboardBootstrap,
  type DashboardBootstrapData,
} from '@/lib/server/dashboardBootstrap';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let initialBootstrap: DashboardBootstrapData | null = null;
  try {
    initialBootstrap = await getRequestDashboardBootstrap();
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
    ) {
      throw err;
    }
    console.warn('DashboardLayout SSR bootstrap fallback to client:', err);
  }

  return <DashboardShell initialBootstrap={initialBootstrap}>{children}</DashboardShell>;
}
