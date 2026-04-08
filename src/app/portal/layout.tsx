'use client';

import React from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-container">
      <header className="portal-glass" style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--portal-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(255, 255, 255, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: '#1e293b', 
            padding: '8px 12px', 
            borderRadius: '12px', 
            boxShadow: '0 4px 10px rgba(0, 0, 0, 0.1)' 
          }}>
            <span style={{ fontWeight: '900', color: 'white', fontSize: '16px' }}>NEO</span>
          </div>
          <h1 style={{ fontSize: '15px', fontWeight: '800', letterSpacing: '0.2px', color: '#1e293b' }}>Support Center</h1>
        </div>
        <div id="portal-header-action"></div>
      </header>

      <main style={{ flex: 1, padding: '24px 20px' }}>
        {children}
      </main>

      <footer style={{ 
        padding: '32px 24px', 
        textAlign: 'center', 
        borderTop: '1px solid var(--portal-border)',
        marginTop: 'auto'
      }}>
        <p style={{ color: 'var(--portal-text-muted)', fontSize: '11px', fontWeight: '600' }}>© 2026 NEO Support. Powered by Omni AI.</p>
      </footer>
    </div>
  );
}
