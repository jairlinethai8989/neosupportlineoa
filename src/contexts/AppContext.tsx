'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectSummary } from '@/types/project';
import type { DashboardBootstrapData } from '@/lib/server/dashboardBootstrap';

const SELECTED_PROJECT_STORAGE_KEY = 'neo_selected_project_id_v1';

function persistSelectedProject(nextId: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, nextId);
  document.cookie = `${SELECTED_PROJECT_STORAGE_KEY}=${encodeURIComponent(nextId)}; path=/; max-age=31536000; SameSite=Lax`;
}

interface AppContextType {
  authUserId: string | null;
  userProfile: UserProfile | null;
  companySettings: CompanySettings | null;
  organizations: Array<Record<string, unknown>>;
  scopedOrganizations: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  projects: ProjectSummary[];
  projectsLoaded: boolean;
  selectedProjectId: string;
  setSelectedProjectId: (id: string) => void;
  effectiveProjectIds: string[] | null;
  activeProject: ProjectSummary | null;
  initialCounts: { newTicketsCount: number; inboxCount: number } | null;
  loading: boolean;
  refreshData: (type?: 'all' | 'profile' | 'settings' | 'organizations' | 'departments' | 'projects') => Promise<void>;
  ensureOrganizations: () => Promise<void>;
  ensureDepartments: () => Promise<void>;
  updateStatus: (status: 'Active' | 'Busy') => Promise<void>;
  onlineUserIds: string[];
  logout: () => Promise<void>;
}
export interface UserProfile {
  id?: string;
  role?: string;
  full_name?: string;
  avatar_url?: string | null;
  permissions?: Record<string, string> | null;
  status?: string;
  last_seen?: string | null;
  department?: string | null;
  quick_replies?: string[] | null;
  resolution_templates?: string[] | null;
  auto_logout_minutes?: number | null;
  [key: string]: unknown;
}
export interface CompanySettings {
  company_name?: string | null;
  logo_url?: string | null;
  modules?: string[] | null;
  subject_types?: string[] | null;
  issue_types?: string[] | null;
  report_tags?: string[] | null;
  active_threshold_minutes?: number;
  global_quick_replies?: Array<{id: string, title: string, content: string, category: string}> | null;
  global_resolution_templates?: Array<{id: string, title: string, content: string, category: string}> | null;
  [key: string]: unknown;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

type RefreshScope = 'all' | 'profile' | 'settings' | 'organizations' | 'departments' | 'projects';

export function AppProvider({
  children,
  initialBootstrap = null,
}: {
  children: React.ReactNode;
  initialBootstrap?: DashboardBootstrapData | null;
}) {
  const profileBypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_PROFILE_BYPASS_AUTH === '1';
  const [userProfile, setUserProfile] = useState<UserProfile | null>(
    () => (initialBootstrap?.userProfile as UserProfile | null) ?? null
  );
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(
    () => (initialBootstrap?.companySettings as CompanySettings | null) ?? null
  );
  const [organizations, setOrganizations] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>(
    () => initialBootstrap?.projects ?? []
  );
  const [isProjectAdmin, setIsProjectAdmin] = useState(
    () => initialBootstrap?.isAdmin ?? false
  );
  const [projectsLoaded, setProjectsLoaded] = useState(() => Boolean(initialBootstrap));
  const [selectedProjectId, setSelectedProjectIdState] = useState<string>(() => {
    if (initialBootstrap?.initialSelectedProjectId) {
      return initialBootstrap.initialSelectedProjectId;
    }
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY) || 'all';
  });
  const [loading, setLoading] = useState(() => !initialBootstrap);
  const [currentUserId, setCurrentUserId] = useState<string | null>(
    () => initialBootstrap?.userId ?? null
  );
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const organizationsLoadedRef = React.useRef(false);
  const departmentsLoadedRef = React.useRef(false);
  const hasServerBootstrapRef = React.useRef(Boolean(initialBootstrap));

  const setSelectedProjectId = useCallback((id: string) => {
    const nextId = id || 'all';
    setSelectedProjectIdState(nextId);
    persistSelectedProject(nextId);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedLocal = localStorage.getItem(SELECTED_PROJECT_STORAGE_KEY);
    if (
      savedLocal &&
      savedLocal !== selectedProjectId &&
      (savedLocal === 'all' || projects.some((p) => p.id === savedLocal))
    ) {
      setSelectedProjectIdState(savedLocal);
      persistSelectedProject(savedLocal);
    } else if (selectedProjectId) {
      persistSelectedProject(selectedProjectId);
    }
    // Sync localStorage -> cookie once on initial hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch('/api/projects/mine', { cache: 'no-store' });
      if (!res.ok) {
        setProjectsLoaded(true);
        return;
      }
      const data = (await res.json()) as {
        isAdmin?: boolean;
        projects?: ProjectSummary[];
      };
      const loadedProjects = data.projects || [];
      setProjects(loadedProjects);
      setIsProjectAdmin(Boolean(data.isAdmin));
      setSelectedProjectIdState((prev) => {
        if (prev !== 'all' && !loadedProjects.some((p) => p.id === prev)) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(SELECTED_PROJECT_STORAGE_KEY, 'all');
          }
          return 'all';
        }
        if (!data.isAdmin && loadedProjects.length === 1 && prev === 'all') {
          return loadedProjects[0].id;
        }
        return prev;
      });
    } catch (err) {
      console.warn('AppProvider projects load skipped:', err);
    } finally {
      setProjectsLoaded(true);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    setUserProfile(data);
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap', { cache: 'no-store' });
      if (res.ok) {
        const boot = (await res.json()) as DashboardBootstrapData;
        if (boot.companySettings) {
          setCompanySettings(boot.companySettings as CompanySettings);
          return;
        }
      }
    } catch {
      // Fallback to direct query without exposing gemini_api_key
    }

    const [settingsRes, modulesRes, issuesRes, subjectsRes] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('ticket_modules').select('name').eq('is_active', true),
      supabase.from('ticket_issue_types').select('name').eq('is_active', true),
      supabase.from('ticket_subject_types').select('name').eq('is_active', true),
    ]);

    if (settingsRes.error) throw settingsRes.error;

    const raw = (settingsRes.data || {}) as Record<string, unknown>;
    const { gemini_api_key: _geminiApiKey, ...data } = raw;
    void _geminiApiKey;
    data.modules = modulesRes.data?.map((d) => d.name) || [];
    data.issue_types = issuesRes.data?.map((d) => d.name) || [];
    data.subject_types = subjectsRes.data?.map((d) => d.name) || [];

    setCompanySettings(data as CompanySettings);
  }, []);

  const fetchOrganizations = useCallback(async () => {
    const { data, error } = await supabase.from('organizations').select('*').order('name');
    if (error) throw error;
    setOrganizations(data || []);
    organizationsLoadedRef.current = true;
  }, []);

  const fetchDepartments = useCallback(async () => {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) throw error;
    setDepartments(data || []);
    departmentsLoadedRef.current = true;
  }, []);

  const ensureOrganizations = useCallback(async () => {
    if (organizationsLoadedRef.current) return;
    await fetchOrganizations();
  }, [fetchOrganizations]);

  const ensureDepartments = useCallback(async () => {
    if (departmentsLoadedRef.current) return;
    await fetchDepartments();
  }, [fetchDepartments]);

  const refreshData = useCallback(
    async (type: RefreshScope = 'all') => {
      const userId =
        currentUserId ||
        (await supabase.auth.getSession()).data.session?.user?.id ||
        null;

      if (!userId && (type === 'all' || type === 'profile')) {
        setUserProfile(null);
        setLoading(false);
        return;
      }

      try {
        if (type === 'all') {
          await Promise.all([
            fetchProfile(userId as string),
            fetchSettings(),
            fetchOrganizations(),
            fetchDepartments(),
            fetchProjects(),
          ]);
          return;
        }

        if (type === 'projects') {
          await fetchProjects();
          return;
        }

        if (type === 'profile' && userId) {
          await fetchProfile(userId);
          return;
        }

        if (type === 'settings') {
          await fetchSettings();
          return;
        }

        if (type === 'organizations') {
          await fetchOrganizations();
          return;
        }

        if (type === 'departments') {
          await fetchDepartments();
        }
      } catch (err) {
        console.error('AppProvider refresh error:', err);
      }
    },
    [currentUserId, fetchDepartments, fetchOrganizations, fetchProfile, fetchProjects, fetchSettings]
  );

  const updateStatus = useCallback(async (status: 'Active' | 'Busy') => {
    if (!currentUserId && !profileBypassAuth) return;

    const now = new Date().toISOString();

    // Optimistically update local profile state
    setUserProfile(prev => prev ? {
      ...prev,
      status,
      last_seen: now
    } : null);

    if (currentUserId) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ status, last_seen: now })
          .eq('id', currentUserId);
        if (error) throw error;
      } catch (err) {
        console.error('Failed to update presence status in database:', err);
      }
    }
  }, [currentUserId, profileBypassAuth]);

  const logout = useCallback(async () => {
    if (currentUserId) {
      try {
        await supabase
          .from('profiles')
          .update({ status: 'Offline' })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Failed to update status to Offline on logout:', err);
      }
    }
    await supabase.auth.signOut();
    window.location.href = '/login';
  }, [currentUserId]);

  // Periodic heartbeat every 2 minutes when user is logged in
  useEffect(() => {
    if (!currentUserId) return;

    const sendHeartbeat = async () => {
      const now = new Date().toISOString();
      
      // Optimistically update local profile, but only if it exists. 
      // If it doesn't exist yet, it will be loaded by fetchProfile shortly with the new DB value (or old, if race condition).
      setUserProfile(prev => prev ? { ...prev, last_seen: now } : null);

      try {
        await supabase
          .from('profiles')
          .update({ last_seen: now })
          .eq('id', currentUserId);
      } catch (err) {
        console.error('Failed to send heartbeat in background:', err);
      }
    };

    // Defer initial heartbeat slightly so first paint & charts aren't contested
    const initialBeatTimer = setTimeout(() => {
      void sendHeartbeat();
    }, 1500);

    // Check-in every 2 minutes
    const intervalId = setInterval(() => {
      void sendHeartbeat();
    }, 120000);

    return () => {
      clearTimeout(initialBeatTimer);
      clearInterval(intervalId);
    };
  }, [currentUserId]);

  // Supabase Realtime Presence for tracking online staff (deferred slightly after first paint)
  useEffect(() => {
    if (!currentUserId) {
      setOnlineUserIds([]);
      return;
    }

    let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
    const timer = setTimeout(() => {
      presenceChannel = supabase.channel('online-staff-presence', {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      });

      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          if (!presenceChannel) return;
          const state = presenceChannel.presenceState();
          const ids = Object.keys(state);
          setOnlineUserIds(ids);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && presenceChannel) {
            await presenceChannel.track({
              id: currentUserId,
              online_at: new Date().toISOString(),
            });
          }
        });
    }, 1500);

    return () => {
      clearTimeout(timer);
      if (presenceChannel) {
        void supabase.removeChannel(presenceChannel);
      }
    };
  }, [currentUserId]);

  // Inactivity (Auto Logout) Tracker
  useEffect(() => {
    if (!currentUserId || !userProfile?.auto_logout_minutes) return;

    const timeoutMinutes = Number(userProfile.auto_logout_minutes);
    if (timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        console.log('Inactivity timeout reached. Logging out...');
        void logout();
      }, timeoutMs);
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [currentUserId, userProfile?.auto_logout_minutes, logout]);

  useEffect(() => {
    let cancelled = false;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    let settingsChannel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeRealtime = (uid: string | null) => {
      settingsChannel = supabase
        .channel('settings-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, () => {
          void fetchSettings().catch((err) => console.error('AppProvider settings refresh error:', err));
        })
        .subscribe();

      if (uid) {
        profileChannel = supabase
          .channel(`profile-updates-${uid}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${uid}` },
            () => {
              void fetchProfile(uid).catch((err) => console.error('AppProvider profile refresh error:', err));
            }
          )
          .subscribe();
      }
    };

    async function bootstrap() {
      // Fast path: server layout already hydrated profile, settings, and projects
      if (hasServerBootstrapRef.current) {
        setTimeout(() => {
          if (!cancelled) subscribeRealtime(currentUserId);
        }, 1200);
        return;
      }

      try {
        const res = await fetch(
          `/api/bootstrap?projectId=${encodeURIComponent(selectedProjectId || 'all')}`,
          { cache: 'no-store' }
        );
        if (res.ok && !cancelled) {
          const boot = (await res.json()) as DashboardBootstrapData;
          setCurrentUserId(boot.userId);
          setUserProfile(boot.userProfile as UserProfile | null);
          setCompanySettings(boot.companySettings as CompanySettings | null);
          setProjects(boot.projects || []);
          setIsProjectAdmin(Boolean(boot.isAdmin));
          setProjectsLoaded(true);
          setLoading(false);
          subscribeRealtime(boot.userId);
          return;
        }
      } catch (err) {
        console.warn('Bootstrap API fallback to client queries:', err);
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user ?? null;

        if (cancelled) return;

        if (!user && !profileBypassAuth) {
          setCurrentUserId(null);
          setUserProfile(null);
          setLoading(false);
          return;
        }

        if (!user && profileBypassAuth) {
          setCurrentUserId(null);
          setUserProfile({
            id: 'profile-bypass',
            role: 'Administrator',
            full_name: 'Profiling User',
            permissions: null,
          });
          setLoading(false);
          void Promise.all([fetchSettings(), fetchOrganizations(), fetchDepartments()]).catch((err) => {
            console.error('AppProvider profile bypass background load error:', err);
          });
          return;
        }

        if (!user) {
          setLoading(false);
          return;
        }

        setCurrentUserId(user.id);
        setLoading(false);

        void fetchProfile(user.id).catch((err) => console.error('AppProvider profile load error:', err));
        void fetchSettings().catch((err) => console.error('AppProvider settings load error:', err));
        void fetchProjects();
        subscribeRealtime(user.id);
      } catch (err) {
        console.error('AppProvider bootstrap error:', err);
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (settingsChannel) supabase.removeChannel(settingsChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
    // Run once on mount; real-time channels stay subscribed for session lifetime
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const effectiveProjectIds = useMemo<string[] | null>(() => {
    if (!projectsLoaded) return null;
    if (selectedProjectId && selectedProjectId !== 'all') {
      return [selectedProjectId];
    }
    if (isProjectAdmin || userProfile?.role === 'Administrator') {
      return null;
    }
    return projects.map((p) => p.id);
  }, [isProjectAdmin, projects, projectsLoaded, selectedProjectId, userProfile?.role]);

  const activeProject = useMemo<ProjectSummary | null>(() => {
    if (selectedProjectId && selectedProjectId !== 'all') {
      return projects.find((p) => p.id === selectedProjectId) || null;
    }
    if (projects.length === 1) return projects[0];
    return null;
  }, [projects, selectedProjectId]);

  const scopedOrganizations = useMemo(() => {
    if (!effectiveProjectIds) return organizations;
    if (effectiveProjectIds.length === 0) return [];
    const allowed = new Set(effectiveProjectIds);
    return organizations.filter((org) => {
      const pid = org.project_id as string | null | undefined;
      return !pid || allowed.has(pid);
    });
  }, [effectiveProjectIds, organizations]);

  return (
    <AppContext.Provider
      value={{
        authUserId: currentUserId,
        userProfile,
        companySettings,
        organizations,
        scopedOrganizations,
        departments,
        projects,
        projectsLoaded,
        selectedProjectId,
        setSelectedProjectId,
        effectiveProjectIds,
        activeProject,
        initialCounts: initialBootstrap?.counts ?? null,
        loading,
        refreshData,
        ensureOrganizations,
        ensureDepartments,
        updateStatus,
        onlineUserIds,
        logout,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

