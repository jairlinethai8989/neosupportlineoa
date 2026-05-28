import React from 'react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="portal-container">
      <header className="portal-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="portal-logo-box">
            <span className="portal-logo-text">NEO</span>
          </div>
          <h1 className="portal-title-text">Support Center</h1>
        </div>
        <div id="portal-header-action"></div>
      </header>

      <main className="portal-main">
        {children}
      </main>

      <footer className="portal-footer">
        <p className="portal-footer-text">© 2026 NEO Support. Powered by Omni AI.</p>
      </footer>
    </div>
  );
}
