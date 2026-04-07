import { useState, useCallback, useEffect, useRef, useLayoutEffect, useMemo } from 'react';
import { addDays } from 'date-fns';
import logo from './assets/logo.jpg';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import { WeekNav } from './components/WeekNav';
import { WeekGrid } from './components/WeekGrid';
import { EventModal } from './components/EventModal';
import { AdminPage } from './components/AdminPage';
import type { ModalState } from './components/EventModal';
import { useCalendarData } from './useCalendarData';
import { fetchAllRoomEvents } from './googleCalendar';
import { importFromGoogle } from './roomsApi';
import type { CalendarEvent, RoomCalendar, UserInfo } from './types';
import { GOOGLE_SCOPES } from './constants';

const LOAD_MORE = 14;
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string || '504708739043-4c9j52bcvtofeul3u2vims5pp01ht1lp.apps.googleusercontent.com';

// ── Session storage helpers ──────────────────────────────────────

const SESSION_KEY = 'hevrutah_session';

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


// ── Import button: admin-only, one-time Google Calendar import ───

function ImportCalendarButton({ jwt, onImported }: { jwt: string; onImported: () => void }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doImport = useGoogleLogin({
    scope: GOOGLE_SCOPES,
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      setError(null);
      try {
        const start = new Date();
        start.setFullYear(start.getFullYear() - 1);
        const end = new Date();
        end.setFullYear(end.getFullYear() + 2);

        const roomData = await fetchAllRoomEvents(tokenResponse.access_token, start, end);
        const events = roomData.flatMap(r => r.events);
        await importFromGoogle(jwt, events);
        setDone(true);
        setTimeout(() => setDone(false), 5000);
        onImported();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'שגיאה בייבוא');
      } finally {
        setLoading(false);
      }
    },
    onError: () => setError('ההתחברות נכשלה'),
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {error && <span style={{ fontSize: 11, color: '#fca5a5' }}>{error}</span>}
      {done && <span style={{ fontSize: 11, color: '#86efac' }}>✓ יובא בהצלחה</span>}
      <button
        onClick={() => doImport()}
        disabled={loading}
        style={{ ...navBtnStyle, background: 'rgba(16,185,129,0.3)', borderColor: 'rgba(16,185,129,0.6)' }}
        title="ייבוא חד-פעמי מ-Google Calendar"
      >
        {loading ? '⟳ מייבא...' : '📥 ייבא מ-Google Calendar'}
      </button>
    </div>
  );
}


// ── Main Dashboard ───────────────────────────────────────────────

function Dashboard({ jwt, user, onUnauthorized }: { jwt: string; user: UserInfo; onUnauthorized: () => void; }) {
  const [modal, setModal] = useState<ModalState>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [importKey, setImportKey] = useState(0);

  const [days, setDays] = useState<Date[]>(() => {
    const today = new Date();
    return Array.from({ length: 28 }, (_, i) => addDays(today, i - 7));
  });

  const rangeStart = useMemo(() => days[0],               [days]);
  const rangeEnd   = useMemo(() => days[days.length - 1], [days]);

  const { rooms, loading, error, lastRefresh, refetch } = useCalendarData(jwt, rangeStart, rangeEnd);

  // When token is expired/invalid — show re-login button instead of auto-logout loop
  const isUnauthorized = !!(error && error.toLowerCase().includes('unauthorized'));

  useEffect(() => {
    if (importKey > 0) refetch();
  }, [importKey, refetch]);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const topSentinel = useRef<HTMLDivElement>(null);
  const botSentinel = useRef<HTMLDivElement>(null);
  const loadingRef  = useRef(false);
  const prependH    = useRef(0);

  useLayoutEffect(() => {
    if (prependH.current > 0 && scrollRef.current) {
      scrollRef.current.scrollTop += scrollRef.current.scrollHeight - prependH.current;
      prependH.current = 0;
    }
  }, [days]);

  useEffect(() => {
    const el = botSentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingRef.current) {
        loadingRef.current = true;
        setDays(prev => {
          const last = prev[prev.length - 1];
          return [...prev, ...Array.from({ length: LOAD_MORE }, (_, i) => addDays(last, i + 1))];
        });
        setTimeout(() => { loadingRef.current = false; }, 500);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const el = topSentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loadingRef.current) {
        loadingRef.current = true;
        prependH.current = scrollRef.current?.scrollHeight ?? 0;
        setDays(prev => {
          const first = prev[0];
          return [...Array.from({ length: LOAD_MORE }, (_, i) => addDays(first, i - LOAD_MORE)), ...prev];
        });
        setTimeout(() => { loadingRef.current = false; }, 500);
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
          {user.isAdmin && (
            <ImportCalendarButton jwt={jwt} onImported={() => setImportKey(k => k + 1)} />
          )}
        </div>
      </div>

      {/* Error bar */}
      {isUnauthorized && (
        <div style={{ flexShrink: 0, background: '#fef9c3', border: '1px solid #fde68a', color: '#92400e', padding: '8px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12 }}>
          ⚠️ פג תוקף הכניסה —
          <button onClick={() => { localStorage.removeItem(SESSION_KEY); onUnauthorized(); }}
            style={{ padding: '3px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
            כנס מחדש
          </button>
        </div>
      )}
      {error && !isUnauthorized && (
        <div style={{
          flexShrink: 0,
          background: '#fef2f2', border: '1px solid #fecaca',
          color: '#dc2626', padding: '8px 16px', fontSize: 13,
        }}>
          ❌ {error}
        </div>
      )}

      {/* Toolbar + Legend */}
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

      {/* Scrollable body */}
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

// ── "Go to portal" screen ────────────────────────────────────────

function GoToPortal() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)', fontFamily: "'Segoe UI', Arial, sans-serif", direction: 'rtl' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 44, textAlign: 'center', maxWidth: 360, width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <img src={logo} alt="חברותא" style={{ width: 140, marginBottom: 20, objectFit: 'contain' }} />
        <h2 style={{ margin: '0 0 10px', fontSize: 18, color: '#1e293b' }}>ניהול חדרים</h2>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 28 }}>כניסה דרך פורטל חברותא בלבד</p>
        <button
          onClick={() => { window.location.href = 'https://hevrutah-portal.vercel.app'; }}
          style={{ width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          כניסה לפורטל →
        </button>
      </div>
    </div>
  );
}

// ── App root ─────────────────────────────────────────────────────

type AppView =
  | { status: 'loading' }
  | { status: 'no-session' }
  | { status: 'ready'; jwt: string; user: UserInfo };

function AppInner() {
  const [view, setView] = useState<AppView>({ status: 'loading' });

  useEffect(() => {
    // ── Check for portal SSO token in URL (?token=JWT) ────────────
    const params = new URLSearchParams(window.location.search);
    const portalToken = params.get('token');
    if (portalToken) {
      try {
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
        window.history.replaceState({}, '', window.location.pathname);
        setView({ status: 'ready', jwt: portalToken, user });
        return;
      } catch {
        // invalid token — fall through
      }
    }

    // ── Restore saved session ─────────────────────────────────────
    const session = loadSession();
    if (!session) { setView({ status: 'no-session' }); return; }
    setView({ status: 'ready', jwt: session.jwt, user: session.user });
  }, []);

  if (view.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontSize: 18, color: '#64748b' }}>
        טוען...
      </div>
    );
  }

  if (view.status === 'no-session') return <GoToPortal />;

  return <Dashboard jwt={view.jwt} user={view.user} onUnauthorized={() => { localStorage.removeItem(SESSION_KEY); setView({ status: 'no-session' }); }} />;
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={CLIENT_ID}>
      <AppInner />
    </GoogleOAuthProvider>
  );
}
