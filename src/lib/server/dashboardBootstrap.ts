import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ProjectSummary } from '@/types/project';

export const SELECTED_PROJECT_COOKIE_KEY = 'neo_selected_project_id_v1';

const SAFE_PROJECT_COLUMNS = `
  id,
  slug,
  name,
  code,
  organization_label,
  logo_url,
  primary_color,
  line_liff_id,
  line_bot_id,
  line_staff_group_id,
  notify_on_customer_message,
  is_default,
  is_active
`;

export interface DashboardBootstrapData {
  userId: string | null;
  userProfile: Record<string, unknown> | null;
  companySettings: Record<string, unknown> | null;
  projects: ProjectSummary[];
  isAdmin: boolean;
  initialSelectedProjectId: string;
  scopedProjectIds: string[] | null;
  counts: {
    newTicketsCount: number;
    inboxCount: number;
  };
}

function stripSensitiveSettings(
  rawSettings: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  if (!rawSettings) return {};
  const { gemini_api_key: _geminiApiKey, ...safe } = rawSettings;
  void _geminiApiKey;
  return safe;
}

const getCachedGlobalMasterData = unstable_cache(
  async () => {
    const [settingsRes, modulesRes, issuesRes, subjectsRes, projectsRes] = await Promise.all([
      supabaseAdmin.from('company_settings').select('*').limit(1).maybeSingle(),
      supabaseAdmin.from('ticket_modules').select('name').eq('is_active', true),
      supabaseAdmin.from('ticket_issue_types').select('name').eq('is_active', true),
      supabaseAdmin.from('ticket_subject_types').select('name').eq('is_active', true),
      supabaseAdmin
        .from('projects')
        .select(SAFE_PROJECT_COLUMNS)
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true }),
    ]);

    const safeSettings = stripSensitiveSettings(
      (settingsRes.data as Record<string, unknown> | null) || null
    );
    safeSettings.modules = (modulesRes.data || []).map((d) => d.name);
    safeSettings.issue_types = (issuesRes.data || []).map((d) => d.name);
    safeSettings.subject_types = (subjectsRes.data || []).map((d) => d.name);

    return {
      companySettings: safeSettings,
      activeProjects: (projectsRes.data || []) as ProjectSummary[],
    };
  },
  ['neo-global-master-data-v1'],
  { revalidate: 30, tags: ['master-data'] }
);

export async function getDashboardBootstrapForUser(
  userId: string,
  requestedProjectId?: string | null
): Promise<DashboardBootstrapData> {
  const [profileRes, membershipsRes, globalMaster] = await Promise.all([
    supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabaseAdmin
      .from('project_members')
      .select('project_id, project_role')
      .eq('profile_id', userId),
    getCachedGlobalMasterData(),
  ]);

  const userProfile = (profileRes.data as Record<string, unknown> | null) || null;
  const role = typeof userProfile?.role === 'string' ? userProfile.role : 'Viewer';
  const isAdmin = role === 'Administrator';

  const allProjects = globalMaster.activeProjects;
  let userProjects: ProjectSummary[] = [];

  if (isAdmin) {
    userProjects = allProjects.map((project) => ({
      ...project,
      project_role: 'admin' as const,
    }));
  } else {
    const projectMap = new Map(allProjects.map((p) => [p.id, p]));
    for (const row of (membershipsRes.data || []) as Array<{
      project_id: string;
      project_role: 'lead' | 'agent' | 'viewer';
    }>) {
      const project = projectMap.get(row.project_id);
      if (project) {
        userProjects.push({
          ...project,
          project_role: row.project_role,
        });
      }
    }
    userProjects.sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  let effectiveSelected = requestedProjectId?.trim() || 'all';
  if (effectiveSelected !== 'all' && !userProjects.some((p) => p.id === effectiveSelected)) {
    effectiveSelected = 'all';
  }
  if (!isAdmin && userProjects.length === 1 && effectiveSelected === 'all') {
    effectiveSelected = userProjects[0].id;
  }

  let scopedProjectIds: string[] | null = null;
  if (effectiveSelected && effectiveSelected !== 'all') {
    scopedProjectIds = [effectiveSelected];
  } else if (isAdmin) {
    scopedProjectIds = null;
  } else {
    scopedProjectIds = userProjects.map((p) => p.id);
  }

  let newTicketsCount = 0;
  let inboxCount = 0;

  if (!Array.isArray(scopedProjectIds) || scopedProjectIds.length > 0) {
    let ticketsCountQuery = supabaseAdmin
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .or('status.ilike.new,status.ilike.New');

    let inboxCountQuery = supabaseAdmin
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    if (scopedProjectIds && scopedProjectIds.length > 0) {
      ticketsCountQuery = ticketsCountQuery.in('project_id', scopedProjectIds);
      inboxCountQuery = inboxCountQuery.in('project_id', scopedProjectIds);
    }

    const [tCountRes, iCountRes] = await Promise.all([ticketsCountQuery, inboxCountQuery]);
    newTicketsCount = tCountRes.count ?? 0;
    inboxCount = iCountRes.count ?? 0;
  }

  return {
    userId,
    userProfile,
    companySettings: globalMaster.companySettings,
    projects: userProjects,
    isAdmin,
    initialSelectedProjectId: effectiveSelected,
    scopedProjectIds,
    counts: {
      newTicketsCount,
      inboxCount,
    },
  };
}

/**
 * Per-request memoized bootstrap loader shared between DashboardLayout and DashboardPage.
 */
export const getRequestDashboardBootstrap = cache(
  async (): Promise<DashboardBootstrapData | null> => {
    const profileBypassAuth =
      process.env.NODE_ENV !== 'production' &&
      process.env.PROFILE_BYPASS_AUTH === '1';

    const cookieStore = await cookies();
    const selectedProjectCookie =
      cookieStore.get(SELECTED_PROJECT_COOKIE_KEY)?.value || 'all';

    if (profileBypassAuth) {
      const globalMaster = await getCachedGlobalMasterData();
      return {
        userId: null,
        userProfile: {
          id: 'profile-bypass',
          role: 'Administrator',
          full_name: 'Profiling User',
          permissions: null,
        },
        companySettings: globalMaster.companySettings,
        projects: globalMaster.activeProjects.map((p) => ({ ...p, project_role: 'admin' as const })),
        isAdmin: true,
        initialSelectedProjectId: selectedProjectCookie,
        scopedProjectIds:
          selectedProjectCookie !== 'all' ? [selectedProjectCookie] : null,
        counts: { newTicketsCount: 0, inboxCount: 0 },
      };
    }

    const supabaseServer = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabaseServer.auth.getUser();

    if (!user) {
      return null;
    }

    return getDashboardBootstrapForUser(user.id, selectedProjectCookie);
  }
);
