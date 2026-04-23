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
        } else {
          // Not logged in.
          // If in LINE app, automatically login
          if (liff.isInClient()) {
             liff.login();
          } else {
             // In browser, we keep isReady=false and let the UI show login/mock login buttons
             setIsReady(true); // set ready but profile is null
          }
        }
      } catch (err: any) {
        console.error('LIFF init error:', err);
        setError('Failed to initialize LIFF: ' + err.message);
        setIsReady(true);
      }
    };
    initLiff();
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
    } else {
      setProfile(null);
    }
  };

  const setMockLogin = (userId: string = 'U_MOCK_ADMIN', name: string = 'Mock User') => {
    setProfile({
      userId,
      displayName: name,
      pictureUrl: 'https://ui-avatars.com/api/?name=' + name,
    });
  };

  return { isReady, profile, error, login, logout, setMockLogin };
}
