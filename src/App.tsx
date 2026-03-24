import { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { addDays } from 'date-fns';
import logo from './assets/logo.jpg';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { LoginScreen } from './components/LoginScreen';
import { WeekNav } from './components/WeekNav';
import { WeekGrid } from './components/WeekGrid';
import { EventModal } from './components/EventModal';
import { AdminPage } from './components/AdminPage';
import type { ModalState } from './components/EventModal';
import { useCalendarData } from './useCalendarData';
import type { CalendarEvent, RoomCalendar, UserInfo } from './types';
import { GOOGLE_SCOPES } from './constants';

const LOAD_MORE = 14;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;

// ── Session storage helpers ──────────────────────────────────────

const SESSION_KEY = 'hevrutah_session';
const GOOGLE_TOKEN_KEY = 'hevrutah_google_token';

function loadSession(): { jwt: string; user: UserInfo } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { jwt, user, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(SESSION_KEY); return null; }
    return { jwt, user };
  } catch { return null; }
}

function saveSession(jwt: string, user: UserInfo) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    jwt, user, expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  }));
}

function loadGoogleToken(): string | null {
  try {
    const raw = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    const { token, expires } = JSON.parse(raw);
    if (Date.now() > expires) { localStorage.removeItem(GOOGLE_TOKEN_KEY); return null; }
    return token;
  } catch { return null; }
}

function saveGoogleToken(token: string) {
  localStorage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify({
    token, expires: Date.now() + 55 * 60 * 1000, // 55 min (token valid for 1h)
  }));
}

function clearAllSessions() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(GOOGLE_TOKEN_KEY);
}

// ── Fetch shared Google token from server ─────────────────────────

async function fetchSharedToken(jwt: string): Promise<string | null> {
  try {
    const res = await fetch('/api/calendar/token', {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return null;
    const { accessToken, expiresIn } = await res.json();
    saveGoogleToken(accessToken);
    // Schedule silent refresh slightly before expiry
    setTimeout(() => localStorage.removeItem(GOOGLE_TOKEN_KEY), (expiresIn - 60) * 1000);
    return accessToken;
  } catch { return null; }
}

// ── Admin Google Setup Screen (one-time) ─────────────────────────

function AdminGoogleSetup({
  jwt,
  onConnected,
  onLogout,
}: {
  jwt: string;
  onConnected: (token: string) => void;
  onLogout: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const connectGoogle = useGoogleLogin({
    flow: 'auth-code',
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    onSuccess: async (res) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch('/api/calendar/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({ code: res.code, redirectUri: window.location.origin }),
        });
        const data = await r.json();
        if (data.message === 'MANUAL_SAVE_REQUIRED') {
          setManualToken(data.refreshToken);
          saveGoogleToken(data.accessToken);
          onConnected(data.accessToken);
        } else if (r.ok) {
          const token = await fetchSharedToken(jwt);
          if (token) onConnected(token);
        } else if (data.error === 'NO_REFRESH_TOKEN') {
          setError('לא התקבל refresh token — אנא בטל גישה לאפליקציה ב-Google ונסה שנית.');
        } else {
          setError(data.error || 'שגיאה בחיבור');
        }
      } catch { setError('שגיאת רשת'); }
      setLoading(false);
    },
    onError: () => setError('ההתחברות ל-Google נכשלה. נסה שנית.'),
  });

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif",
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 44,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        maxWidth: 420, width: '90%', textAlign: 'center',
      }}>
        <img src={logo} alt="חברותא" style={{ width: 140, marginBottom: 16, objectFit: 'contain' }} />
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: '0 0 8px' }}>
          הגדרת חיבור Google Calendar
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          חיבור חד-פעמי. לאחר מכן כל המטפלים יתחברו אוטומטית ללא צורך ב-Google.
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 7, fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        {manualToken && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: 12, borderRadius: 8, fontSize: 12, textAlign: 'right', marginBottom: 16 }}>
            <strong>הוסף את ה-Refresh Token הבא ל-Vercel כ-GOOGLE_REFRESH_TOKEN:</strong>
            <pre style={{ marginTop: 8, wordBreak: 'break-all', whiteSpace: 'pre-wrap', fontSize: 10 }}>{manualToken}</pre>
          </div>
        )}

        <button
          onClick={() => connectGoogle()}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '12px 24px',
            background: loading ? '#93c5fd' : '#4285f4', color: 'white',
            border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 600,
            cursor: loading ? 'default' : 'pointer', fontFamily: 'inherit', marginBottom: 10,
          }}
        >
          {loading ? 'מתחבר...' : 'חבר Google Calendar (אדמין)'}
        </button>

        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← התנתק
        </button>
      </div>
    </div>
  );
}

// ── Therapist waiting screen ──────────────────────────────────────

function TherapistWaitingScreen({ onLogout }: { onLogout: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)',
      direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif",
    }}>
      <div style={{
        background: 'white', borderRadius: 16, padding: 44,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        maxWidth: 360, width: '90%', textAlign: 'center',
      }}>
        <img src={logo} alt="חברותא" style={{ width: 140, marginBottom: 16, objectFit: 'contain' }} />
        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: '0 0 12px' }}>
          ממתין להגדרת מנהל
        </h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>
          המנהל טרם חיבר את Google Calendar. אנא פנה למנהל המערכת.
        </p>
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← התנתק
        </button>
      </div>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────

function Dashboard({
  jwt,
  user,
  calendarToken,
  onGoogleExpired,
  onLogout,
}: {
  jwt: string;
  user: UserInfo;
  calendarToken: string;
  onGoogleExpired: () => void;
  onLogout: () => void;
}) {
  const [modal, setModal] = useState<ModalState>(null);
  const [showAdmin, setShowAdmin] = useState(false);

  // ── Infinite scroll days state ────────────────────────────────
  const [days, setDays] = useState<Date[]>(() => {
    const today = new Date();
    return Array.from({ length: 28 }, (_, i) => addDays(today, i - 7));
  });

  const rangeStart = useMemo(() => days[0],               [days]);
  const rangeEnd   = useMemo(() => days[days.length - 1], [days]);

  const { rooms, loading, error, lastRefresh, refetch } = useCalendarData(calendarToken, rangeStart, rangeEnd);

  
  // Detect expired Google token
  useEffect(() => {
    if (error && (error.includes('401') || error.includes('Invalid Credentials'))) {
      localStorage.removeItem(GOOGLE_TOKEN_KEY);
      onGoogleExpired();
    }
  }, [error, onGoogleExpired]);

  // ── Scroll refs ───────────────────────────────────────────────
  const scrollRef    = useRef<HTMLDivElement>(null);
  const topSentinel  = useRef<HTMLDivElement>(null);
  const botSentinel  = useRef<HTMLDivElement>(null);
  const loadingRef   = useRef(false);
  const prependH     = useRef(0); // scrollHeight before prepend

  // Adjust scroll after prepend so view doesn't jump
  useLayoutEffect(() => {
    if (prependH.current > 0 && scrollRef.current) {
      scrollRef.current.scrollTop += scrollRef.current.scrollHeight - prependH.current;
      prependH.current = 0;
    }
  }, [days]);

  // Bottom sentinel → append future days
  useEffect(() => {
    const el = botSentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingRef.current) {
        loadingRef.current = true;
        setDays(prev => {
          const last = prev[prev.length - 1];
          const extra = Array.from({ length: LOAD_MORE }, (_, i) => addDays(last, i + 1));
          return [...prev, ...extra];
        });
        setTimeout(() => { loadingRef.current = false; }, 500);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Top sentinel → prepend past days
  useEffect(() => {
    const el = topSentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingRef.current) {
        loadingRef.current = true;
        prependH.current = scrollRef.current?.scrollHeight ?? 0;
        setDays(prev => {
          const first = prev[0];
          const extra = Array.from({ length: LOAD_MORE }, (_, i) => addDays(first, i - LOAD_MORE));
          return [...extra, ...prev];
        });
        setTimeout(() => { loadingRef.current = false; }, 500);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Scroll to today on mount
  useEffect(() => {
    setTimeout(() => {
      const el = document.querySelector('[data-today-section="true"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  }, []);

  const goToday = useCallback(() => {
    const el = document.querySelector('[data-today-section="true"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleSlotClick = useCallback((room: RoomCalendar, day: Date, hour: number) => {
    setModal({ mode: 'create', room, day, hour });
  }, []);
  const handleEventClick = useCallback((event: CalendarEvent, room: RoomCalendar) => {
    setModal({ mode: 'edit', event, room });
  }, []);

  if (showAdmin && user.isAdmin) {
    return <AdminPage jwt={jwt} user={user} onClose={() => setShowAdmin(false)} />;
  }

  return (
    <div style={{
      width: '100vw', height: '100vh',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', position: 'fixed', top: 0, left: 0,
      fontFamily: "'Segoe UI', 'Arial', sans-serif", direction: 'rtl',
    }}>

      {/* Navbar */}
      <div style={{
        flexShrink: 0,
        background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <img src={logo} alt="חברותא" style={{ height: 36, objectFit: 'contain', borderRadius: 4 }} />
        <span style={{ fontWeight: 800, fontSize: 18 }}>ניהול חדרים</span>
        {loading && <span style={{ fontSize: 12, opacity: 0.8 }}>⟳ מעדכן...</span>}
        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13 }}>{user.name}</span>
          {user.isAdmin && (
            <span style={{ fontSize: 11, background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '1px 8px' }}>
              מנהל
            </span>
          )}
          {user.isAdmin && (
            <button onClick={() => setShowAdmin(true)} style={navBtnStyle}>⚙️ ניהול</button>
          )}
          <button onClick={onLogout} style={navBtnStyle}>יציאה</button>
        </div>
      </div>

      {/* Error bar */}
      {error && !error.includes('401') && !error.includes('Invalid Credentials') && (
        <div style={{
          flexShrink: 0,
          background: '#fef2f2', border: '1px solid #fecaca',
          color: '#dc2626', padding: '8px 16px', fontSize: 13,
        }}>
          ❌ {error}
        </div>
      )}


      {/* Toolbar + Legend — one row */}
      <div style={{ flexShrink: 0, padding: '4px 16px', background: '#f8fafc', display: 'flex', alignItems: 'center', gap: 16, direction: 'rtl', flexWrap: 'wrap' }}>
        <WeekNav onToday={goToday} loading={loading} lastRefresh={lastRefresh} />
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#64748b' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#3b82f6' }} />
            פגישה קבועה
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} />
            פגישה חד-פעמית
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#ef4444' }} />
            ⚠️ חפיפת זמנים
          </span>
        </div>
      </div>

      {/* SCROLLABLE BODY — the only element that scrolls */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'scroll', overflowX: 'hidden' }}>
        <div ref={topSentinel} style={{ height: 1 }} />
        <WeekGrid
          rooms={rooms}
          days={days}
          onSlotClick={handleSlotClick}
          onEventClick={handleEventClick}
        />
        <div ref={botSentinel} style={{ height: 1 }} />
      </div>

      <EventModal
        state={modal}
        rooms={rooms}
        accessToken={calendarToken}
        user={user}
        onClose={() => setModal(null)}
        onSaved={refetch}
      />
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '4px 12px', fontSize: 12,
  background: 'rgba(255,255,255,0.15)', color: 'white',
  border: '1px solid rgba(255,255,255,0.3)', borderRadius: 5,
  cursor: 'pointer', fontFamily: 'inherit',
};

// ── App root ─────────────────────────────────────────────────────

type AppView =
  | { status: 'loading' }
  | { status: 'login' }
  | { status: 'need-setup'; jwt: string; user: UserInfo }      // admin: no Google token configured
  | { status: 'waiting'; jwt: string; user: UserInfo }         // therapist: admin hasn't set up yet
  | { status: 'ok'; jwt: string; user: UserInfo; calendarToken: string };

function AppInner() {
  const [view, setView] = useState<AppView>({ status: 'loading' });

  async function resolveGoogleToken(jwt: string, user: UserInfo) {
    // 1. Try cached token
    const cached = loadGoogleToken();
    if (cached) { setView({ status: 'ok', jwt, user, calendarToken: cached }); return; }
    // 2. Try server shared token
    const token = await fetchSharedToken(jwt);
    if (token) { setView({ status: 'ok', jwt, user, calendarToken: token }); return; }
    // 3. No token available
    if (user.isAdmin) {
      setView({ status: 'need-setup', jwt, user });
    } else {
      setView({ status: 'waiting', jwt, user });
    }
  }

  useEffect(() => {
    const session = loadSession();
    if (!session) { setView({ status: 'login' }); return; }
    resolveGoogleToken(session.jwt, session.user);
  }, []);

  async function handleLogin(jwt: string, username: string, name: string, isAdmin: boolean, therapistName: string | null) {
    const user: UserInfo = { username, name, isAdmin, therapistName };
    saveSession(jwt, user);
    await resolveGoogleToken(jwt, user);
  }

  function handleLogout() {
    clearAllSessions();
    setView({ status: 'login' });
  }

  const loadingScreen = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 18, color: '#64748b' }}>
      טוען...
    </div>
  );

  if (view.status === 'loading') return loadingScreen;
  if (view.status === 'login') return <LoginScreen onLogin={handleLogin} />;

  if (view.status === 'need-setup') {
    return (
      <AdminGoogleSetup
        jwt={view.jwt}
        onConnected={(token) => setView({ status: 'ok', jwt: view.jwt, user: view.user, calendarToken: token })}
        onLogout={handleLogout}
      />
    );
  }

  if (view.status === 'waiting') {
    return <TherapistWaitingScreen onLogout={handleLogout} />;
  }

  return (
    <Dashboard
      jwt={view.jwt}
      user={view.user}
      calendarToken={view.calendarToken}
      onGoogleExpired={async () => {
        localStorage.removeItem(GOOGLE_TOKEN_KEY);
        const token = await fetchSharedToken(view.jwt);
        if (token) setView({ status: 'ok', jwt: view.jwt, user: view.user, calendarToken: token });
        else if (view.user.isAdmin) setView({ status: 'need-setup', jwt: view.jwt, user: view.user });
        else setView({ status: 'waiting', jwt: view.jwt, user: view.user });
      }}
      onLogout={handleLogout}
    />
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AppInner />
    </GoogleOAuthProvider>
  );
}
