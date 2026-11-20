import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { ProjectCredentials, ProjectPublicConfig } from '@/types/project';

const PROJECT_SELECT_COLUMNS = `
  id,
  slug,
  name,
  code,
  organization_label,
  logo_url,
  primary_color,
  line_channel_id,
  line_channel_secret,
  line_channel_access_token,
  line_liff_id,
  line_bot_id,
  line_staff_group_id,
  notify_on_customer_message,
  is_default,
  is_active
`;

const CACHE_TTL_MS = 30_000;
const projectCache = new Map<string, { value: ProjectCredentials; expiresAt: number }>();

export function invalidateProjectResolverCache() {
  projectCache.clear();
}

function getEnvFallbackProject(): ProjectCredentials {
  return {
    id: 'default-env-fallback',
    slug: 'default',
    name: 'Neo Support (Default)',
    code: 'NEO',
    organization_label: 'โรงพยาบาล',
    logo_url: null,
    primary_color: '#0066ff',
    line_channel_id: process.env.LINE_LOGIN_CHANNEL_ID?.trim() || null,
    line_channel_secret: process.env.LINE_CHANNEL_SECRET || null,
    line_channel_access_token: process.env.LINE_CHANNEL_ACCESS_TOKEN || null,
    line_liff_id: process.env.NEXT_PUBLIC_LIFF_ID?.trim() || null,
    line_bot_id: process.env.NEXT_PUBLIC_LINE_BOT_ID?.trim() || null,
    line_staff_group_id: process.env.LINE_GROUP_ID?.trim() || null,
    notify_on_customer_message: false,
    is_default: true,
    is_active: true,
  };
}

function withEnvCredentialFallbacks(row: ProjectCredentials): ProjectCredentials {
  if (!row.is_default) return row;
  return {
    ...row,
    line_channel_secret: row.line_channel_secret || process.env.LINE_CHANNEL_SECRET || null,
    line_channel_access_token:
      row.line_channel_access_token || process.env.LINE_CHANNEL_ACCESS_TOKEN || null,
    line_liff_id: row.line_liff_id || process.env.NEXT_PUBLIC_LIFF_ID?.trim() || null,
    line_bot_id: row.line_bot_id || process.env.NEXT_PUBLIC_LINE_BOT_ID?.trim() || null,
    line_channel_id: row.line_channel_id || process.env.LINE_LOGIN_CHANNEL_ID?.trim() || null,
    line_staff_group_id: row.line_staff_group_id || process.env.LINE_GROUP_ID?.trim() || null,
  };
}

function readCache(key: string): ProjectCredentials | null {
  const entry = projectCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    projectCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key: string, value: ProjectCredentials) {
  projectCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function resolveProjectBySlug(slug?: string | null): Promise<ProjectCredentials | null> {
  const normalizedSlug = slug?.trim().toLowerCase() || '';
  const cacheKey = `slug:${normalizedSlug || '__default__'}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    let query = supabaseAdmin
      .from('projects')
      .select(PROJECT_SELECT_COLUMNS)
      .eq('is_active', true);

    if (normalizedSlug) {
      query = query.eq('slug', normalizedSlug);
    } else {
      query = query.order('is_default', { ascending: false }).order('created_at', { ascending: true });
    }

    const { data, error } = await query.limit(1).maybeSingle();
    if (error) {
      console.warn('[projectResolver] Query failed, falling back to env if default:', error.message);
      if (!normalizedSlug || normalizedSlug === 'default') {
        return getEnvFallbackProject();
      }
      return null;
    }

    if (!data) {
      if (!normalizedSlug) {
        return getEnvFallbackProject();
      }
      return null;
    }

    const resolved = withEnvCredentialFallbacks(data as ProjectCredentials);
    writeCache(cacheKey, resolved);
    writeCache(`id:${resolved.id}`, resolved);
    return resolved;
  } catch (err) {
    console.warn('[projectResolver] Unexpected error:', err);
    if (!normalizedSlug || normalizedSlug === 'default') {
      return getEnvFallbackProject();
    }
    return null;
  }
}

export async function resolveProjectById(projectId?: string | null): Promise<ProjectCredentials | null> {
  const normalizedId = projectId?.trim() || '';
  if (!normalizedId || normalizedId === 'default-env-fallback') {
    return resolveProjectBySlug(null);
  }

  const cacheKey = `id:${normalizedId}`;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  try {
    const { data, error } = await supabaseAdmin
      .from('projects')
      .select(PROJECT_SELECT_COLUMNS)
      .eq('id', normalizedId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const resolved = withEnvCredentialFallbacks(data as ProjectCredentials);
    writeCache(cacheKey, resolved);
    writeCache(`slug:${resolved.slug}`, resolved);
    return resolved;
  } catch {
    return null;
  }
}

export function toProjectPublicConfig(project: ProjectCredentials): ProjectPublicConfig {
  return {
    id: project.id,
    slug: project.slug,
    name: project.name,
    code: project.code,
    organization_label: project.organization_label || 'หน่วยงาน',
    logo_url: project.logo_url || null,
    primary_color: project.primary_color || '#0066ff',
    line_liff_id: project.line_liff_id || null,
    line_bot_id: project.line_bot_id || null,
    is_default: project.is_default,
    is_active: project.is_active,
  };
}
