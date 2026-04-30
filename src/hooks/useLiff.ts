'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';
import liff from '@line/liff';
import { supabase } from '@/lib/supabase';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

const canUseMockLogin =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_LIFF_MOCK === 'true';

export function useLiff() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.userId) return;
    const currentProfile = profile;
    let isCancelled = false;

    async function syncCustomerProfile() {
      const payload = {
        line_user_id: currentProfile.userId,
        display_name: currentProfile.displayName,
        updated_at: new Date().toISOString(),
      };

      const { error: syncError } = await supabase
        .from('customers')
        .upsert(payload, { onConflict: 'line_user_id' });

      if (!isCancelled && syncError) {
        console.error('LIFF profile sync error:', syncError);
      }
    }

    void syncCustomerProfile();
    return () => {
      isCancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          setError('LIFF ID is missing in environment (NEXT_PUBLIC_LIFF_ID).');
          return;
        }

        await liff.init({ liffId });

        if (liff.isLoggedIn()) {
          const p = await liff.getProfile();
          setProfile({
            userId: p.userId,
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
          });
          setIsReady(true);
          return;
        }

        if (liff.isInClient()) {
          liff.login();
          return;
        }

        setIsReady(true);
      } catch (err: any) {
        console.error('LIFF init error:', err);
        setError('Failed to initialize LIFF: ' + (err?.message || 'Unknown error'));
        setIsReady(true);
      }
    };

    void initLiff();
  }, []);

  const login = () => {
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  };

  const logout = () => {
    if (liff.isLoggedIn()) {
      liff.logout();
      window.location.reload();
      return;
    }
    setProfile(null);
  };

  const setMockLogin = (userId: string = 'U_MOCK_ADMIN', name: string = 'Mock User') => {
    if (!canUseMockLogin) {
      setError('Mock login is disabled in production.');
      return;
    }
    setProfile({
      userId,
      displayName: name,
      pictureUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}`,
    });
  };

  return { isReady, profile, error, login, logout, setMockLogin, canUseMockLogin };
}
