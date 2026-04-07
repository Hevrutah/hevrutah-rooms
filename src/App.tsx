import { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { addDays } from 'date-fns';
import logo from './assets/logo.jpg';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { LoginScreen } from './components/LoginScreen';
import { WeekNav } from './components/WeekNav';
import { WeekGrid } from './components/WeekGrid';
import { EventModal } from './components/EventModal';
import { AdminPage } from './components/AdminPage';
import type { ModalState } from './components/EventModal';
import { useCalendarData } from './useCalendarData';
import type { CalendarEvent, RoomCalendar, UserInfo } from './types';

const LOAD_MORE = 14;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string || '504708739043-4c9j52bcvtofeul3u2vims5pp01ht1lp.apps.googleusercontent.com';

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


// ── Main Dashboard ───────────────────────────────────────────────

function Dashboard({
  jwt,
  user,
  calendarToken,
  onGoogleExpired,
}: {
  jwt: string;
  user: UserInfo;
  calendarToken: string;
  onGoogleExpired: () => void;
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
        <button
          onClick={() => { window.location.href = 'https://hevrutah-portal.vercel.app'; }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 8 }}
          title="חזרה לפורטל"
        >
          <img src={logo} alt="חברותא" style={{ height: 36, objectFit: 'contain', borderRadius: 4 }} />
        </button>
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
        jwt={jwt}
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
    // ── Check for portal SSO token in URL (?token=JWT) ────────────
    const params = new URLSearchParams(window.location.search);
    const portalToken = params.get('token');
    if (portalToken) {
      try {
        // Decode JWT payload (server verifies on each API call)
        const base64 = portalToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(json) as {
          username: string; name: string; role: string; therapistName: string | null;
        };
        const user: UserInfo = {
          username: payload.username,
          name: payload.name,
          role: payload.role === 'admin' ? 'admin' : 'hevrutah',
          isAdmin: payload.role === 'admin',
          therapistName: payload.therapistName ?? null,
        };
        saveSession(portalToken, user);
        // Clean URL without page reload
        window.history.replaceState({}, '', window.location.pathname);
        void resolveGoogleToken(portalToken, user);
        return;
      } catch {
        // Invalid token — fall through to normal login
      }
    }

    // ── Normal session restore ─────────────────────────────────────
    const session = loadSession();
    if (!session) { setView({ status: 'login' }); return; }
    void resolveGoogleToken(session.jwt, session.user);
  }, []);

  async function handleLogin(jwt: string, username: string, name: string, isAdmin: boolean, therapistName: string | null, role: UserInfo['role'] = 'hevrutah') {
    const user: UserInfo = { username, name, role, isAdmin, therapistName };
    saveSession(jwt, user);
    await resolveGoogleToken(jwt, user);
  }


  const loadingScreen = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 18, color: '#64748b' }}>
      טוען...
    </div>
  );

  if (view.status === 'loading') return loadingScreen;
  if (view.status === 'login') return <LoginScreen onLogin={handleLogin} />;

  if (view.status === 'need-setup') {
    // Skip Google Calendar setup — show calendar without events until admin connects Google
    return (
      <Dashboard
        jwt={view.jwt}
        user={view.user}
        calendarToken=""
        onGoogleExpired={() => {}}
      />
    );
  }

  if (view.status === 'waiting') {
    // Non-admin without Google token — show dashboard with empty calendar
    return (
      <Dashboard
        jwt={view.jwt}
        user={view.user}
        calendarToken=""
        onGoogleExpired={async () => {
          const token = await fetchSharedToken(view.jwt);
          if (token) setView({ status: 'ok', jwt: view.jwt, user: view.user, calendarToken: token });
        }}
      />
    );
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
