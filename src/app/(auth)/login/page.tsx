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

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: '#f6f9fc',
      padding: '20px'
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
            fontSize: '32px', 
            fontWeight: '900', 
            margin: '0 0 10px', 
            color: '#0066ff',
            letterSpacing: '-1.5px',
            lineHeight: '1.1'
          }}>
            Neo Support Intelligence
          </h1>
          <p style={{ 
            color: '#707070', 
            fontSize: '16px', 
            fontWeight: '600',
            letterSpacing: '0.5px'
          }}>
            ระบบ support NeoHos
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
              opacity: loading ? 0.7 : 1,
              marginBottom: '10px'
            }}
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <p style={{ fontSize: '13px', color: '#999999', marginTop: '20px', marginBottom: '30px' }}>
          สำหรับเจ้าหน้าที่เท่านั้น หากลืมรหัสผ่านกรุณาติดต่อผู้ดูแลระบบ
        </p>

        <div style={{ 
          marginTop: '20px', 
          paddingTop: '20px', 
          borderTop: '1px solid #f0f0f0',
          fontSize: '12px',
          color: '#bbbbbb',
          fontWeight: '500'
        }}>
          Powered by NeoNetwork <span style={{ marginLeft: '8px', color: '#dddddd' }}>v2.1.2</span>
        </div>

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
