'use client';
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable jsx-a11y/alt-text */
import React, { useState, useEffect } from 'react';
import { Noto_Sans_Thai } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import { Menu, X, Bell, User as UserIcon } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const notoThai = Noto_Sans_Thai({ subsets: ["latin", "thai"], weight: ['300', '400', '500', '600', '700', '800'] });

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    async function fetchProfile() {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single();
          setAgent(p || user);
       }
    }
    fetchProfile();
  }, []);

  return (
    <div className={`main-layout ${notoThai.className}`}>
      {/* Sidebar Mobile Toggle Overlay */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Persistent Sidebar */}
      <div 
        className={`sidebar ${isSidebarOpen ? 'open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
        style={{ 
          width: isSidebarCollapsed ? '80px' : '280px',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s ease'
        }}
      >
         <Sidebar isCollapsed={isSidebarCollapsed} onClickLink={() => setIsSidebarOpen(false)} />
      </div>

      <main className="content-area">
        <header className="top-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button 
              onClick={() => {
                if (window.innerWidth > 1024) {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                } else {
                  setIsSidebarOpen(!isSidebarOpen);
                }
              }}
              className="glass-interactive flex-center"
              style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', color: 'white', marginRight: '8px' }}
            >
              {(window.innerWidth > 1024 ? isSidebarCollapsed : isSidebarOpen) ? <Menu size={20} /> : <X size={20} />}
            </button>
            <div className="show-desktop">
               <h2 style={{ fontSize: '18px', fontWeight: '800', display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                 <span>ระบบจัดการอัจฉริยะ</span>
                 <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600' }}>NEO INTELLIGENCE SUITE</span>
               </h2>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <button className="glass-interactive" style={{ padding: '8px', borderRadius: '8px', border: 'none', position: 'relative' }}>
                <Bell size={18} color="var(--text-muted)" />
                <span style={{ position: 'absolute', top: '8px', right: '8px', width: '6px', height: '6px', background: 'var(--accent)', borderRadius: '50%' }} />
             </button>
             
             <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: '8px', padding: '4px 12px 4px 4px', borderRadius: '30px', border: '1px solid var(--border)' }} className="glass-interactive">
                {agent?.avatar_url ? (
                  <img src={agent.avatar_url} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ 
                    width: '32px', 
                    height: '32px', 
                    borderRadius: '50%', 
                    background: 'var(--secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '800',
                    fontSize: '12px',
                    boxShadow: '0 0 10px rgba(115, 103, 240, 0.4)'
                  }}>{agent?.full_name?.charAt(0) || 'A'}</div>
                )}
                <div className="show-desktop">
                   <p style={{ fontSize: '12px', fontWeight: '800' }}>{agent?.full_name || 'Agent'}</p>
                </div>
             </div>
          </div>
        </header>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto', position: 'relative' }}>
          {children}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (min-width: 1025px) {
          /* No hide toggle on desktop anymore as we use it for collapse */
        }
        .sidebar.collapsed {
          width: 80px !important;
        }
      `}} />
    </div>
  );
}
