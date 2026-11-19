'use client';
import { useState, useEffect } from 'react';
import liff from '@line/liff';

export interface LiffProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
}

export function useLiff() {
  const [isReady, setIsReady] = useState(false);
  const [profile, setProfile] = useState<LiffProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        console.error('LIFF init error:', err);
        setError('Failed to initialize LIFF: ' + getErrorMessage(err));
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
