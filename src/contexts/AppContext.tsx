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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<any | null>(null);
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async (type: 'all' | 'profile' | 'settings' | 'hospitals' | 'departments' = 'all') => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const promises: Promise<any>[] = [];
      const fetchActions: string[] = [];

      if (type === 'all' || type === 'profile') {
        promises.push(supabase.from('profiles').select('*').eq('id', user.id).maybeSingle());
        fetchActions.push('profile');
      }
      
      if (type === 'all' || type === 'settings') {
        promises.push(supabase.from('company_settings').select('*').limit(1).maybeSingle());
        fetchActions.push('settings');
      }

      if (type === 'all' || type === 'hospitals') {
        promises.push(supabase.from('hospitals').select('*').order('name'));
        fetchActions.push('hospitals');
      }

      if (type === 'all' || type === 'departments') {
        promises.push(supabase.from('departments').select('*').order('name'));
        fetchActions.push('departments');
      }

      const results = await Promise.all(promises);

      results.forEach((res, index) => {
        const action = fetchActions[index];
        if (res.error) {
           console.error(`Error fetching ${action}:`, res.error);
           return;
        }

        if (action === 'profile') setUserProfile(res.data);
        if (action === 'settings') setCompanySettings(res.data);
        if (action === 'hospitals') setHospitals(res.data || []);
        if (action === 'departments') setDepartments(res.data || []);
      });

    } catch (err) {
      console.error('AppProvider general error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Subscribe to changes in core tables to keep context fresh
    const profileChannel = supabase.channel('profile-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
          fetchData('profile');
      })
      .subscribe();

    const settingsChannel = supabase.channel('settings-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_settings' }, payload => {
          fetchData('settings');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(settingsChannel);
    };
  }, [fetchData]);

  const refreshData = async (type: 'all' | 'profile' | 'settings' | 'hospitals' | 'departments' = 'all') => {
    await fetchData(type);
  };

  return (
    <AppContext.Provider value={{
      userProfile,
      companySettings,
      hospitals,
      departments,
      loading,
      refreshData
    }}>
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
