import React from 'react';
import { Prompt } from 'next/font/google';
import '@/app/globals.css';

const prompt = Prompt({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['thai', 'latin'],
  variable: '--font-prompt',
  display: 'swap',
});

export const metadata = {
  title: 'NeoSupport | Escalation Portal',
  description: 'External Department Escalation Portal for NeoSupport',
};

import { StaffLocaleProvider } from '@/contexts/StaffLocaleContext';

export default function EscalateLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" data-theme="light">
      <body
        className={prompt.variable}
        style={{
          background: '#f1f5f9', // Light slate
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          color: '#0f172a',
        }}
      >
        <StaffLocaleProvider>
          <div style={{ padding: '24px 0', textAlign: 'center', width: '100%' }}>
            <h1 style={{ fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
              Neo<span style={{ color: '#0f172a' }}>Support</span>
            </h1>
            <p style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>External Department Portal</p>
          </div>

          <main style={{ flex: 1, width: '100%', maxWidth: '1200px', padding: '0 20px', paddingBottom: '60px' }}>
            {children}
          </main>
        </StaffLocaleProvider>
      </body>
    </html>
  );
}
