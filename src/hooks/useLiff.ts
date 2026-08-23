'use client';
import { useState, useEffect } from 'react';
import liff from '@line/liff';

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
    if (!profile?.userId || !idToken) return;
    const currentIdToken = idToken;
    let isCancelled = false;

    async function syncCustomerProfile() {
      try {
        const { syncPortalCustomerAction } = await import('@/app/actions/portalActions');
        await syncPortalCustomerAction(currentIdToken);
      } catch (syncError) {
        if (!isCancelled) {
          console.error('LIFF profile sync error:', syncError);
        }
      }
    }

    void syncCustomerProfile();
    return () => {
      isCancelled = true;
    };
  }, [idToken, profile]);

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
          const verifiedIdToken = liff.getIDToken();
          setProfile({
            userId: p.userId,
            displayName: p.displayName,
            pictureUrl: p.pictureUrl,
          });
          setIdToken(verifiedIdToken);
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
      setIdToken(null);
      window.location.reload();
      return;
    }
    setProfile(null);
    setIdToken(null);
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

  return { isReady, profile, idToken, error, login, logout, setMockLogin, canUseMockLogin };
}
