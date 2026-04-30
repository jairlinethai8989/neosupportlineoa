'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AppContextType {
  userProfile: UserProfile | null;
  companySettings: CompanySettings | null;
  hospitals: Array<Record<string, unknown>>;
  departments: Array<Record<string, unknown>>;
  loading: boolean;
  refreshData: (type?: 'all' | 'profile' | 'settings' | 'hospitals' | 'departments') => Promise<void>;
}
interface UserProfile {
  id?: string;
  role?: string;
  full_name?: string;
  avatar_url?: string | null;
  permissions?: Record<string, string> | null;
  [key: string]: unknown;
}
interface CompanySettings {
  company_name?: string | null;
  logo_url?: string | null;
  subject_types?: string[] | null;
  issue_types?: string[] | null;
  report_tags?: string[] | null;
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

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw error;
    setUserProfile(data);
  }, []);

  const fetchSettings = useCallback(async () => {
    const { data, error } = await supabase.from('company_settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    setCompanySettings(data);
  }, []);

  const fetchHospitals = useCallback(async () => {
    const { data, error } = await supabase.from('hospitals').select('*').order('name');
    if (error) throw error;
    setHospitals(data || []);
  }, []);

  const fetchDepartments = useCallback(async () => {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) throw error;
    setDepartments(data || []);
  }, []);

  const refreshData = useCallback(
    async (type: RefreshScope = 'all') => {
      const userId =
        currentUserId ||
        (await supabase.auth.getUser()).data.user?.id ||
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
          data: { user },
        } = await supabase.auth.getUser();

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

        // Fast path: unblock app as soon as profile is loaded.
        await fetchProfile(user.id);
        if (cancelled) return;
        setLoading(false);

        // Background data: do not block first paint.
        void Promise.all([fetchSettings(), fetchHospitals(), fetchDepartments()]).catch((err) => {
          console.error('AppProvider background load error:', err);
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
        userProfile,
        companySettings,
        hospitals,
        departments,
        loading,
        refreshData,
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

