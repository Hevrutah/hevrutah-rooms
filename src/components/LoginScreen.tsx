import React, { useState } from 'react';
import logo from '../assets/logo.jpg';

import type { UserRole } from '../types';

interface Props {
  onLogin: (jwt: string, username: string, name: string, isAdmin: boolean, therapistName: string | null, role: UserRole) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot password state
  const [showForgot, setShowForgot] = useState(false);
  const [forgotUsername, setForgotUsername] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'שגיאה בהתחברות');
        return;
      }
      onLogin(data.token, data.user.username, data.user.name, data.user.role === 'admin', data.user.therapistName ?? null, data.user.role);
    } catch {
      setError('שגיאת רשת. בדוק חיבור לאינטרנט.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotUsername.trim()) return;
    setForgotLoading(true);
    setForgotMsg(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotUsername.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgotMsg(data.error || 'שגיאה');
      } else {
        setForgotMsg('אם קיים מייל לחשבון זה, הסיסמה החדשה נשלחה אליו.');
      }
    } catch {
      setForgotMsg('שגיאת רשת.');
    } finally {
      setForgotLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px',
    border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: 15, fontFamily: 'inherit',
    direction: 'rtl', boxSizing: 'border-box',
    outline: 'none',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 44, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', maxWidth: 380, width: '90%', textAlign: 'center' }}>
        <img src={logo} alt="חברותא" style={{ width: 160, marginBottom: 20, objectFit: 'contain' }} />
        <p style={{ color: '#64748b', marginBottom: 28, fontSize: 14 }}>ניהול חדרים – מרכז טיפולי</p>

        {!showForgot ? (
          <>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '9px 12px', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'right' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>שם משתמש</label>
                <input style={inputStyle} value={username} onChange={e => setUsername(e.target.value)} placeholder="הכנס שם משתמש" autoFocus autoComplete="username" disabled={loading} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>סיסמה</label>
                <input type="password" style={inputStyle} value={password} onChange={e => setPassword(e.target.value)} placeholder="הכנס סיסמה" autoComplete="current-password" disabled={loading} />
              </div>
              <button type="submit" disabled={loading || !username.trim() || !password} style={{ width: '100%', padding: '12px', background: loading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', marginTop: 4, transition: 'background 0.2s' }}>
                {loading ? 'מתחבר...' : 'כניסה'}
              </button>
            </form>

            <button onClick={() => { setShowForgot(true); setForgotUsername(username); setForgotMsg(null); }} style={{ marginTop: 18, background: 'none', border: 'none', color: '#2563eb', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              שכחתי סיסמה
            </button>
          </>
        ) : (
          <>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#1e293b' }}>שכחתי סיסמה</h3>
            <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20 }}>הכנס שם משתמש ונשלח לך סיסמה חדשה למייל הרשום.</p>

            {forgotMsg && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', padding: '9px 12px', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
                {forgotMsg}
              </div>
            )}

            <form onSubmit={handleForgot} style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'right' }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 5 }}>שם משתמש</label>
                <input style={inputStyle} value={forgotUsername} onChange={e => setForgotUsername(e.target.value)} placeholder="הכנס שם משתמש" autoFocus disabled={forgotLoading} />
              </div>
              <button type="submit" disabled={forgotLoading || !forgotUsername.trim()} style={{ width: '100%', padding: '12px', background: forgotLoading ? '#93c5fd' : '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: forgotLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {forgotLoading ? 'שולח...' : 'שלח סיסמה חדשה'}
              </button>
            </form>

            <button onClick={() => { setShowForgot(false); setForgotMsg(null); }} style={{ marginTop: 18, background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
              חזרה להתחברות
            </button>
          </>
        )}
      </div>
    </div>
  );
};
