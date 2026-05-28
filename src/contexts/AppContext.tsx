'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AppContextType {
  authUserId: string | null;
  userProfile: UserProfile | null;
  companySettings: CompanySettings | null;
  hospitals: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  loading: boolean;
  refreshData: (type?: 'all' | 'profile' | 'settings' | 'hospitals' | 'departments') => Promise<void>;
  ensureHospitals: () => Promise<void>;
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

type RefreshScope = 'all' | 'profile' | 'settings' | 'hospitals' | 'departments';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const profileBypassAuth =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_PROFILE_BYPASS_AUTH === '1';
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [hospitals, setHospitals] = useState<Array<Record<string, unknown>>>([]);
  const [departments, setDepartments] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const hospitalsLoadedRef = React.useRef(false);
  const departmentsLoadedRef = React.useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    setUserProfile(data);
  }, []);

  const fetchSettings = useCallback(async () => {
    const [settingsRes, modulesRes, issuesRes, subjectsRes] = await Promise.all([
      supabase.from('company_settings').select('*').limit(1).maybeSingle(),
      supabase.from('ticket_modules').select('name').eq('is_active', true),
      supabase.from('ticket_issue_types').select('name').eq('is_active', true),
      supabase.from('ticket_subject_types').select('name').eq('is_active', true)
    ]);
    
    if (settingsRes.error) throw settingsRes.error;
    
    const data = settingsRes.data || {};
    data.modules = modulesRes.data?.map(d => d.name) || [];
    data.issue_types = issuesRes.data?.map(d => d.name) || [];
    data.subject_types = subjectsRes.data?.map(d => d.name) || [];
    
    setCompanySettings(data as CompanySettings);
  }, []);

  const fetchHospitals = useCallback(async () => {
    const { data, error } = await supabase.from('hospitals').select('*').order('name');
    if (error) throw error;
    setHospitals(data || []);
    hospitalsLoadedRef.current = true;
  }, []);

  const fetchDepartments = useCallback(async () => {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) throw error;
    setDepartments(data || []);
    departmentsLoadedRef.current = true;
  }, []);

  const ensureHospitals = useCallback(async () => {
    if (hospitalsLoadedRef.current) return;
    await fetchHospitals();
  }, [fetchHospitals]);

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
            fetchHospitals(),
            fetchDepartments(),
          ]);
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

        if (type === 'hospitals') {
          await fetchHospitals();
          return;
        }

        if (type === 'departments') {
          await fetchDepartments();
        }
      } catch (err) {
        console.error('AppProvider refresh error:', err);
      }
    },
    [currentUserId, fetchDepartments, fetchHospitals, fetchProfile, fetchSettings]
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
          
        // Re-fetch to guarantee local state is fresh, avoiding race conditions 
        // with the initial load sequence
        const { data } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
        if (data) {
          setUserProfile(prev => ({ ...prev, ...data, last_seen: now }));
        }
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
    if (!currentUserId) {
      setOnlineUserIds([]);
      return;
    }

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
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;
    const settingsChannel = supabase
      .channel('settings-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, () => {
        void fetchSettings().catch((err) => console.error('AppProvider settings refresh error:', err));
      })
      .subscribe();

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
          void Promise.all([fetchSettings(), fetchHospitals(), fetchDepartments()]).catch((err) => {
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
        // Only profile + settings are critical. Hospitals/departments are lazy-loaded by pages that need them.
        void fetchProfile(user.id).catch(err => console.error('AppProvider profile load error:', err));
        void fetchSettings().catch((err) => {
          console.error('AppProvider settings load error:', err);
        });

        profileChannel = supabase
          .channel(`profile-updates-${user.id}`)
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
            () => {
              void fetchProfile(user.id).catch((err) => console.error('AppProvider profile refresh error:', err));
            }
          )
          .subscribe();
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
      supabase.removeChannel(settingsChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, [fetchDepartments, fetchHospitals, fetchProfile, fetchSettings, profileBypassAuth]);

  return (
    <AppContext.Provider
      value={{
        authUserId: currentUserId,
        userProfile,
        companySettings,
        hospitals,
        departments,
        loading,
        refreshData,
        ensureHospitals,
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

