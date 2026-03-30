'use client';

import React from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="glass" style={{
        padding: '16px 24px',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10, 14, 20, 0.8)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ 
            background: 'var(--primary)', 
            padding: '8px', 
            borderRadius: '10px', 
            boxShadow: '0 0 15px rgba(0, 242, 254, 0.3)' 
          }}>
            <span style={{ fontWeight: '900', color: '#0a0e14', fontSize: '18px' }}>NEO</span>
          </div>
          <h1 style={{ fontSize: '16px', fontWeight: '800', letterSpacing: '0.5px' }}>Support Center</h1>
        </div>
        <div id="portal-header-action"></div>
      </header>

      <main style={{ flex: 1, padding: '20px' }}>
        {children}
      </main>

      <footer style={{ 
        padding: '24px', 
        textAlign: 'center', 
        borderTop: '1px solid var(--border)',
        marginTop: 'auto'
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>© 2026 NEO Support. Powered by Omni AI.</p>
      </footer>

      <style jsx global>{`
        .portal-container {
          background: #0a0e14;
          color: white;
          font-family: var(--font-prompt), 'Inter', sans-serif;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
