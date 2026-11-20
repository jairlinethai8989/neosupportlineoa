'use client';
import { useState, useEffect } from 'react';
import liff from '@line/liff';
import { syncLiffCustomerProfileAction } from '@/app/actions/portalActions';
import type { ProjectPublicConfig } from '@/types/project';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export interface PortalOrgOption {
  id: string;
  name: string;
  abbreviation?: string | null;
  project_id?: string | null;
}

export const canUseMockLogin =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_LIFF_MOCK === 'true';

function detectPortalContext(): { projectSlug: string | null; ticketId: string | null } {
  if (typeof window === 'undefined') {
    return { projectSlug: null, ticketId: null };
  }
  const params = new URLSearchParams(window.location.search);
  const projectSlug = params.get('project')?.trim() || null;
  const ticketMatch = /^\/portal\/tickets\/([^/?#]+)/.exec(window.location.pathname);
  const ticketId = ticketMatch?.[1] || null;
  return { projectSlug, ticketId };
}

export function useLiff(explicitProjectSlug?: string | null) {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [projectConfig, setProjectConfig] = useState<ProjectPublicConfig | null>(null);
  const [projectOrganizations, setProjectOrganizations] = useState<PortalOrgOption[]>([]);
  const [projectSubjectTypes, setProjectSubjectTypes] = useState<string[]>([]);

  useEffect(() => {
    if (!profile?.userId || !projectConfig) return;
    const currentProfile = profile;
    const currentProjectId =
      projectConfig.id && projectConfig.id !== 'default-env-fallback'
        ? projectConfig.id
        : null;
    let isCancelled = false;

    async function syncCustomerProfile() {
      const result = await syncLiffCustomerProfileAction({
        lineUserId: currentProfile.userId,
        idToken,
        projectId: currentProjectId,
        projectSlug: projectConfig?.slug || null,
        displayName: currentProfile.displayName,
        pictureUrl: currentProfile.pictureUrl || null,
      });

      if (!isCancelled && !result.success) {
        console.warn('LIFF profile sync skipped or failed');
      }
    }

    void syncCustomerProfile();
    return () => {
      isCancelled = true;
    };
  }, [profile, idToken, projectConfig]);

  useEffect(() => {
    let cancelled = false;

    const initLiff = async () => {
      try {
        const ctx = detectPortalContext();
        const slugToLoad = explicitProjectSlug ?? ctx.projectSlug;
        const qs = new URLSearchParams();
        if (slugToLoad) qs.set('project', slugToLoad);
        if (!slugToLoad && ctx.ticketId) qs.set('ticketId', ctx.ticketId);
        const queryString = qs.toString();

        let resolvedProject: ProjectPublicConfig | null = null;
        try {
          const res = await fetch(
            `/api/portal/project-config${queryString ? `?${queryString}` : ''}`,
            { cache: 'no-store' }
          );
          if (res.ok) {
            const payload = (await res.json()) as {
              project?: ProjectPublicConfig;
              organizations?: PortalOrgOption[];
              subjectTypes?: string[];
            };
            if (!cancelled && payload.project) {
              resolvedProject = payload.project;
              setProjectConfig(payload.project);
              setProjectOrganizations(payload.organizations || []);
              setProjectSubjectTypes(payload.subjectTypes || []);
            }
          }
        } catch (cfgErr) {
          console.warn('Portal project-config fetch failed, using env fallback:', cfgErr);
        }

        const liffId = resolvedProject?.line_liff_id || process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          if (!cancelled) {
            setError('LIFF ID is missing in project settings or environment.');
            setIsReady(true);
          }
          return;
        }

        await liff.init({ liffId });
        if (cancelled) return;

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          if (cancelled) return;
          setProfile({
            userId: p.userId,
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
          });
          try {
            setIdToken(liff.getIDToken() || null);
          } catch {
            setIdToken(null);
          }
          setIsReady(true);
          return;
        }

        if (liff.isInClient()) {
          liff.login();
          return;
        }

        setIsReady(true);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('LIFF init error:', err);
        if (!cancelled) {
          setError('Failed to initialize LIFF: ' + message);
          setIsReady(true);
        }
      }
    };

    void initLiff();
    return () => {
      cancelled = true;
    };
  }, [explicitProjectSlug]);

  const login = () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const logout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
    }
  };

  const getIdToken = () => {
    if (idToken) return idToken;
    try {
      return liff.getIDToken() || null;
    } catch {
      return null;
    }
  };

  const setMockLogin = (userId = 'U_MOCK_ADMIN', displayName = 'Mock Test User') => {
    if (!canUseMockLogin) {
      setError('Mock login is disabled in production.');
      return;
    }
    setProfile({ userId, displayName });
    setIdToken(null);
    setError(null);
    setIsReady(true);
  };

  return {
    profile,
    idToken,
    isReady,
    error,
    projectConfig,
    projectOrganizations,
    projectSubjectTypes,
    login,
    logout,
    getIdToken,
    setMockLogin,
  };
}
