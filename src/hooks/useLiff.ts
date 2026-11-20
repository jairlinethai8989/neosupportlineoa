'use client';
import { useState, useEffect } from 'react';
import liff from '@line/liff';
import { supabase } from '@/lib/supabase';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export const canUseMockLogin =
  process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_ENABLE_LIFF_MOCK === 'true';

export function useLiff() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.userId) return;
    const currentProfile = profile;
    let isCancelled = false;

    async function syncCustomerProfile() {
      const payload = {
        line_user_id: currentProfile.userId,
        display_name: currentProfile.displayName,
        avatar_url: currentProfile.pictureUrl || null,
        metadata: {
          line_profile: {
            display_name: currentProfile.displayName,
            picture_url: currentProfile.pictureUrl || null,
            synced_at: new Date().toISOString(),
          },
        },
        updated_at: new Date().toISOString(),
      };

      let { error: syncError } = await supabase
        .from('customers')
        .upsert(payload, { onConflict: 'line_user_id' });

      if (syncError?.code === 'PGRST204' && String(syncError.message || '').includes('avatar_url')) {
        const fallbackPayload = {
          line_user_id: currentProfile.userId,
          display_name: currentProfile.displayName,
          metadata: payload.metadata,
          updated_at: new Date().toISOString(),
        };
        const fallback = await supabase
          .from('customers')
          .upsert(fallbackPayload, { onConflict: 'line_user_id' });
        syncError = fallback.error;
      }

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
        setError('Failed to initialize LIFF: ' + message);
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

  const getIdToken = (): string | null => {
    try {
      if (liff.isLoggedIn()) {
        const freshToken = liff.getIDToken();
        if (freshToken) return freshToken;
      }
    } catch {
      // Ignore LIFF SDK errors in mock/non-LIFF environments
    }
    return idToken;
  };

  return { isReady, profile, idToken, getIdToken, error, login, logout, setMockLogin, canUseMockLogin };
}
