'use client';

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import {
  STAFF_LOCALE_STORAGE_KEY,
  type StaffLocale,
  getStaffMessage,
} from '@/lib/i18n/staff';

interface StaffLocaleContextValue {
  locale: StaffLocale;
  setLocale: (locale: StaffLocale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
}

const StaffLocaleContext = createContext<StaffLocaleContextValue | undefined>(undefined);

export function StaffLocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<StaffLocale>(() => {
    if (typeof window === 'undefined') return 'th';
    const saved = window.localStorage.getItem(STAFF_LOCALE_STORAGE_KEY);
    return saved === 'th' || saved === 'en' ? saved : 'th';
  });

  const setLocale = useCallback((nextLocale: StaffLocale) => {
    setLocaleState(nextLocale);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STAFF_LOCALE_STORAGE_KEY, nextLocale);
    }
  }, []);

  const toggleLocale = useCallback(() => {
    setLocale(locale === 'th' ? 'en' : 'th');
  }, [locale, setLocale]);

  const t = useCallback((key: string) => getStaffMessage(locale, key), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, toggleLocale, t }),
    [locale, setLocale, toggleLocale, t]
  );

  return <StaffLocaleContext.Provider value={value}>{children}</StaffLocaleContext.Provider>;
}

export function useStaffLocale() {
  const context = useContext(StaffLocaleContext);
  if (!context) {
    throw new Error('useStaffLocale must be used within a StaffLocaleProvider');
  }
  return context;
}
