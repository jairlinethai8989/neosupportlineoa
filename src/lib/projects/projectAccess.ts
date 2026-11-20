import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ProjectSummary } from '@/types/project';

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

export interface UserProjectScope {
  userId: string;
  role: string;
  isAdmin: boolean;
  projectIds: string[];
  projects: ProjectSummary[];
}

export async function getUserProjectScope(userId: string): Promise<UserProjectScope> {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  const role = profile?.role || 'Viewer';
  const isAdmin = role === 'Administrator';

  if (isAdmin) {
    const { data: allProjects, error } = await supabaseAdmin
      .from('projects')
      .select(SAFE_PROJECT_COLUMNS)
      .eq('is_active', true)
      .order('is_default', { ascending: false })
      .order('name', { ascending: true });

    if (error) {
      return { userId, role, isAdmin, projectIds: [], projects: [] };
    }

    const projects = ((allProjects || []) as ProjectSummary[]).map((project) => ({
      ...project,
      project_role: 'admin' as const,
    }));

    return {
      userId,
      role,
      isAdmin,
      projectIds: projects.map((p) => p.id),
      projects,
    };
  }

  const { data: memberships, error: memberError } = await supabaseAdmin
    .from('project_members')
    .select(`project_role, projects (${SAFE_PROJECT_COLUMNS})`)
    .eq('profile_id', userId);

  if (memberError || !memberships) {
    return { userId, role, isAdmin: false, projectIds: [], projects: [] };
  }

  const projects: ProjectSummary[] = [];
  for (const row of memberships as unknown as Array<{
    project_role: 'lead' | 'agent' | 'viewer';
    projects: ProjectSummary | ProjectSummary[] | null;
  }>) {
    const project = Array.isArray(row.projects) ? row.projects[0] : row.projects;
    if (project && project.is_active) {
      projects.push({
        ...project,
        project_role: row.project_role,
      });
    }
  }

  projects.sort((a, b) => {
    if (a.is_default !== b.is_default) return a.is_default ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return {
    userId,
    role,
    isAdmin: false,
    projectIds: projects.map((p) => p.id),
    projects,
  };
}

/**
 * Resolves the effective project IDs for queries given an optional client filter ('all' or UUID).
 * Throws an Error if a non-admin user requests a project they do not belong to.
 */
export async function resolveScopedProjectIds(
  userId: string,
  requestedProjectId?: string | null
): Promise<{ scope: UserProjectScope; projectIds: string[] | null }> {
  const scope = await getUserProjectScope(userId);
  const cleanRequested = requestedProjectId?.trim();

  if (cleanRequested && cleanRequested !== 'all') {
    if (!scope.isAdmin && !scope.projectIds.includes(cleanRequested)) {
      throw new Error('Forbidden: You do not have access to the requested project');
    }
    return { scope, projectIds: [cleanRequested] };
  }

  // Admin querying "all" -> null means unrestricted (all projects) when projects table is active
  if (scope.isAdmin) {
    return { scope, projectIds: null };
  }

  return { scope, projectIds: scope.projectIds };
}

export async function assertUserProjectAccess(userId: string, projectId: string | null | undefined): Promise<void> {
  if (!projectId) return;
  const scope = await getUserProjectScope(userId);
  if (scope.isAdmin) return;
  if (!scope.projectIds.includes(projectId)) {
    throw new Error('Forbidden: You do not have permission for this project');
  }
}
