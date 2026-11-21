import React from 'react';
import { InboxWorkspaceClient } from '@/components/inbox/InboxWorkspaceClient';
import { getRequestDashboardBootstrap } from '@/lib/server/dashboardBootstrap';
import {
  getInitialInboxBootstrap,
  type InitialInboxBootstrap,
} from '@/lib/server/inboxBootstrap';

export const dynamic = 'force-dynamic';

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ cid?: string; tid?: string }>;
}) {
  const resolvedParams = await searchParams;
  let initialInbox: InitialInboxBootstrap | null = null;

  try {
    const bootstrap = await getRequestDashboardBootstrap();
    if (bootstrap) {
      initialInbox = await getInitialInboxBootstrap({
        selectedProjectId: bootstrap.initialSelectedProjectId,
        scopedProjectIds: bootstrap.scopedProjectIds,
        cid: resolvedParams?.cid || null,
        tid: resolvedParams?.tid || null,
        pageSize: 10,
      });
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
    console.warn('InboxPage SSR bootstrap fallback to client:', err);
  }

  return <InboxWorkspaceClient initialInbox={initialInbox} />;
}
