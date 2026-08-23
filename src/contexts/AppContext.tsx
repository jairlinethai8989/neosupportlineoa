'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { updateOwnProfile } from '@/lib/profiles/updateOwnProfile';
import { supabase } from '@/lib/supabase';
import { getClientCompanySettingsAction } from '@/app/actions/companySettingsActions';
import { getOwnProfileAction } from '@/app/actions/profileSettingsActions';
import {
  getStaffDepartmentsAction,
  getStaffOrganizationsAction,
  getStaffTicketOptionsAction,
} from '@/app/actions/masterSettingsActions';

interface AppContextType {
  authUserId: string | null;
  userProfile: UserProfile | null;
  companySettings: CompanySettings | null;
  organizations: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  loading: boolean;
  refreshData: (type?: 'all' | 'profile' | 'settings' | 'organizations' | 'departments') => Promise<void>;
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

type RefreshScope = 'all' | 'profile' | 'settings' | 'organizations' | 'departments';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const profileBypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_PROFILE_BYPASS_AUTH === '1';
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [organizations, setOrganizations] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const organizationsLoadedRef = React.useRef(false);
  const departmentsLoadedRef = React.useRef(false);

  const fetchProfile = useCallback(async () => {
    const data = await getOwnProfileAction();
    setUserProfile(data as UserProfile | null);
  }, []);

  const fetchSettings = useCallback(async () => {
    const [safeSettings, options] = await Promise.all([
      getClientCompanySettingsAction(),
      getStaffTicketOptionsAction(),
    ]);

    const data = safeSettings as CompanySettings;
    data.modules = options.modules;
    data.issue_types = options.issueTypes;
    data.subject_types = options.subjectTypes;
    
    setCompanySettings(data as CompanySettings);
  }, []);

  const fetchOrganizations = useCallback(async () => {
    const data = await getStaffOrganizationsAction();
    setOrganizations(data);
    organizationsLoadedRef.current = true;
  }, []);

  const fetchDepartments = useCallback(async () => {
    const data = await getStaffDepartmentsAction();
    setDepartments(data);
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
            fetchProfile(),
            fetchSettings(),
            fetchOrganizations(),
            fetchDepartments(),
          ]);
          return;
        }

        if (type === 'profile' && userId) {
          await fetchProfile();
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
    [currentUserId, fetchDepartments, fetchOrganizations, fetchProfile, fetchSettings]
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
        await updateOwnProfile({ status, last_seen: true });
      } catch (err) {
        console.error('Failed to update presence status in database:', err);
      }
    }
  }, [currentUserId, profileBypassAuth]);

  const logout = useCallback(async () => {
    if (currentUserId) {
      try {
        await updateOwnProfile({ status: 'Offline' });
      } catch (err) {
        console.error('Failed to update status to Offline on logout:', err);
      }
    }
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }, [currentUserId, router]);

  // Periodic heartbeat every 2 minutes when user is logged in
  useEffect(() => {
    if (!currentUserId) return;

    const sendHeartbeat = async () => {
      const now = new Date().toISOString();
      
      // Optimistically update local profile, but only if it exists. 
      // If it doesn't exist yet, it will be loaded by fetchProfile shortly with the new DB value (or old, if race condition).
      setUserProfile(prev => prev ? { ...prev, last_seen: now } : null);

      try {
        await updateOwnProfile({ last_seen: true });
      } catch (err) {
        console.error('Failed to send heartbeat in background:', err);
      }
    };

    // Send immediate heartbeat
    void sendHeartbeat();

    // Check-in every 2 minutes
    const intervalId = setInterval(() => {
      void sendHeartbeat();
    }, 120000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUserId]);

  // Supabase Realtime Presence for tracking online staff
  useEffect(() => {
    if (!currentUserId) return;

    const presenceChannel = supabase.channel('online-staff-presence', {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        const ids = Object.keys(state);
        setOnlineUserIds(ids);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({
            id: currentUserId,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      void supabase.removeChannel(presenceChannel);
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
    async function bootstrap() {
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
        
        // Fast path: unblock app immediately before network requests
        setLoading(false);

        // Background data: do not block first paint.
        // Only profile + settings are critical. Organizations/departments are lazy-loaded by pages that need them.
        void fetchProfile().catch(err => console.error('AppProvider profile load error:', err));
        void fetchSettings().catch((err) => {
          console.error('AppProvider settings load error:', err);
        });

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
    };
  }, [fetchDepartments, fetchOrganizations, fetchProfile, fetchSettings, profileBypassAuth]);

  return (
    <AppContext.Provider
      value={{
        authUserId: currentUserId,
        userProfile,
        companySettings,
        organizations,
        departments,
        loading,
        refreshData,
        ensureOrganizations,
        ensureDepartments,
        updateStatus,
        onlineUserIds: currentUserId ? onlineUserIds : [],
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

