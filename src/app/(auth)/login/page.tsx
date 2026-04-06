'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react/no-unescaped-entities */
import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { 
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let finalEmail = email;
      if (!email.includes('@')) {
        finalEmail = `${email}@neo.local`;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: finalEmail,
        password,
      });

      if (signInError) throw signInError;
      
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirectTo') || '/';
      router.push(redirectTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'รหัสผ่านหรือชื่อผู้ใช้ไม่ถูกต้อง');
    } finally {
      setLoading(false);
    }
  };

  const handleLineLogin = () => {
    // Placeholder for LINE Login
    // supabase.auth.signInWithOAuth({ provider: 'line' });
    alert('ระบบเชื่อมต่อ LINE Login จะเปิดให้บริการเร็วๆ นี้');
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f6f9fc',
      padding: '20px',
      fontFamily: '"Inter", "Noto Sans Thai", sans-serif'
    }}>
      <div style={{ 
        width: '100%', 
        maxWidth: '430px', 
        padding: '50px 40px', 
        background: '#ffffff',
        borderRadius: '32px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.05)',
        textAlign: 'center',
        animation: 'slideUp 0.6s ease-out'
      }}>
        {/* Logo/Title */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ 
            fontSize: '38px', 
            fontWeight: '850', 
            margin: '0 0 10px', 
            color: '#0066ff',
            letterSpacing: '-1px'
          }}>
            NEO Support
          </h1>
          <p style={{ 
            color: '#707070', 
            fontSize: '15px', 
            fontWeight: '500' 
          }}>
            ระบบจัดการงาน IT สำหรับโรงพยาบาล
          </p>
        </div>

        {error && (
          <div style={{ 
            background: '#fff5f5', 
            border: '1px solid #fee2e2',
            padding: '12px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '24px',
            color: '#e53e3e',
            fontSize: '13px',
            fontWeight: '600'
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <div style={{ marginBottom: '22px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '700', 
              color: '#333333',
              marginBottom: '10px' 
            }}>
              ชื่อผู้ใช้งาน (Username)
            </label>
            <input 
              type="text" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin"
              style={{
                width: '100%',
                background: '#eff6ff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px 20px',
                color: '#333333',
                fontSize: '15px',
                fontWeight: '500',
                outlineColor: '#0066ff'
              }}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '700', 
              color: '#333333',
              marginBottom: '10px' 
            }}>
              รหัสผ่าน (Password)
            </label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              style={{
                width: '100%',
                background: '#eff6ff',
                border: 'none',
                borderRadius: '14px',
                padding: '16px 20px',
                color: '#333333',
                fontSize: '15px',
                fontWeight: '500',
                outlineColor: '#0066ff'
              }}
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '100%',
              background: '#0066ff',
              color: '#ffffff',
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              fontWeight: '800',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 10px 20px rgba(0, 102, 255, 0.2)',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          margin: '30px 0', 
          gap: '15px' 
        }}>
          <div style={{ flex: 1, height: '1px', background: '#eeeeee' }} />
          <span style={{ fontSize: '13px', color: '#999999', fontWeight: '600' }}>หรือ</span>
          <div style={{ flex: 1, height: '1px', background: '#eeeeee' }} />
        </div>

        <button 
          type="button" 
          onClick={handleLineLogin}
          style={{
            width: '100%',
            background: '#00c300',
            color: '#ffffff',
            padding: '16px',
            borderRadius: '14px',
            border: 'none',
            fontWeight: '800',
            fontSize: '16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 8px 15px rgba(0, 195, 0, 0.15)',
            transition: 'all 0.2s ease',
            marginBottom: '35px'
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 10.304c0-4.577-4.705-8.304-10.5-8.304-5.795 0-10.5 3.727-10.5 8.304 0 4.1 3.732 7.531 8.776 8.192.342.073.806.226.924.518.106.262.069.673.033 0.938-.036.265-.174 1.042-.212 1.342-.064.506-.296 1.977 1.277 1.079 1.573-.898 8.491-5.001 11.579-8.57 2.053-2.373 3.124-4.838 3.124-7.5zm-5.022 5.029c0 .16-.131.291-.292.291h-1.545c-.161 0-.292-.131-.292-.291v-3.921l-1.895 2.502c-.053.07-.138.113-.231.113h-.011c-.092 0-.177-.042-.23-.112l-1.894-2.502v3.921c0 .16-.131.291-.292.291h-1.545c-.161 0-.292-.131-.292-.291v-4.993c0-.161.131-.292.292-.292h1.545c.161 0 .292.131.292.292l2.136 2.822 2.135-2.822c.161 0 .292.131.292.292v4.993z" />
          </svg>
          เข้าสู่ระบบด้วย LINE
        </button>

        <p style={{ fontSize: '14px', color: '#999999' }}>
          ยังไม่มีบัญชี? <a href="#" style={{ color: '#0066ff', fontWeight: '800', textDecoration: 'none' }}>สมัครสมาชิกใหม่</a>
        </p>

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes animate-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .animate-spin {
            animation: animate-spin 1s linear infinite;
          }
          button:hover {
            transform: translateY(-2px);
            filter: brightness(1.1);
          }
          input:focus {
             box-shadow: 0 0 0 4px rgba(0, 102, 255, 0.1);
          }
        `}} />
      </div>
    </div>
  );
}
