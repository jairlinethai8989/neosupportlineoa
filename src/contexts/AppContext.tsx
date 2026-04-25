'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface AppContextType {
  userProfile: any | null;
  companySettings: any | null;
  hospitals: any[];
  departments: any[];
  loading: boolean;
  refreshData: (type?: 'all' | 'profile' | 'settings' | 'hospitals' | 'departments') => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

type RefreshScope = 'all' | 'profile' | 'settings' | 'hospitals' | 'departments';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
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

        if (!user) {
          setCurrentUserId(null);
          setUserProfile(null);
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
  }, [fetchDepartments, fetchHospitals, fetchProfile, fetchSettings]);

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
