import React from 'react';
import { DashboardHomeClient } from '@/components/dashboard/DashboardHomeClient';
import { getRequestDashboardBootstrap } from '@/lib/server/dashboardBootstrap';
import {
  getDashboardSummaryData,
  getDefaultBangkokWeekWindow,
  type DashboardSummaryPayload,
} from '@/lib/server/dashboardSummary';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const initialWindow = getDefaultBangkokWeekWindow();
  let initialSummary: DashboardSummaryPayload | null = null;
  let initialProjectId = 'all';

  try {
    const bootstrap = await getRequestDashboardBootstrap();
    if (bootstrap) {
      initialProjectId = bootstrap.initialSelectedProjectId;
      const { payload } = await getDashboardSummaryData({
        fromIso: initialWindow.fromIso,
        toIso: initialWindow.toIso,
        includeLogs: true,
        scopedProjectIds: bootstrap.scopedProjectIds,
      });
      initialSummary = payload;
    }
  } catch (err) {
    if (
      err &&
      typeof err === 'object' &&
      'digest' in err &&
      (err as { digest?: string }).digest === 'DYNAMIC_SERVER_USAGE'
    ) {
      throw err;
    }
    console.warn('Dashboard HomePage SSR summary fallback to client SWR:', err);
  }

  return (
    <DashboardHomeClient
      initialSummary={initialSummary}
      initialWindow={initialWindow}
      initialProjectId={initialProjectId}
    />
  );
}
