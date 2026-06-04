'use client';
import React from 'react';
import { SWRConfig } from 'swr';

// A generic global fetcher if needed
const globalFetcher = (url: string) => fetch(url).then((res) => {
  if (!res.ok) throw new Error('Failed to fetch data');
  return res.json();
});

export function SWRProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig 
      value={{
        fetcher: globalFetcher,
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        refreshInterval: 0, // no automatic polling by default unless specified per hook
        dedupingInterval: 2000,
        keepPreviousData: true, // IMPORTANT: Prevents flashing/white screens when swapping keys
      }}
    >
      {children}
    </SWRConfig>
  );
}
