import { useState, useMemo } from 'react';
import { fetchRoomEvents } from '../roomsApi';
import type { CalendarEvent } from '../types';

interface Props {
  jwt: string;
  onClose: () => void;
}

interface RenterEntry {
  name: string;
  totalHours: number;
  events: CalendarEvent[];
}

function eventDurationHours(e: CalendarEvent): number {
  return (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000;
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins === 0 ? `${whole}ש׳` : `${whole}ש׳ ${mins}ד׳`;
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit', weekday: 'short' });
}

function formatEventTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

export function HoursReport({ jwt, onClose }: Props) {
  const [fromDate, setFromDate] = useState(firstOfMonthStr);
  const [toDate, setToDate] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [events, setEvents] = useState<CalendarEvent[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRenter, setSelectedRenter] = useState<string | null>(null);

  async function fetchReport() {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    setEvents(null);
    setSelectedRenter(null);
    try {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      end.setDate(end.getDate() + 1);
      const rooms = await fetchRoomEvents(jwt, start, end);
      setEvents(rooms.flatMap(r => r.events));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  const renters = useMemo<RenterEntry[]>(() => {
    if (!events) return [];
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const name = e.summary?.trim() || '(ללא שם)';
      if (!map.has(name)) map.set(name, []);
      map.get(name)!.push(e);
    }
    return Array.from(map.entries())
      .map(([name, evs]) => ({
        name,
        totalHours: evs.reduce((s, e) => s + eventDurationHours(e), 0),
        events: evs.sort((a, b) => a.start.localeCompare(b.start)),
      }))
      .sort((a, b) => b.totalHours - a.totalHours);
  }, [events]);

  const filtered = useMemo(() => {
    if (!search.trim()) return renters;
    const q = search.trim().toLowerCase();
    return renters.filter(r => r.name.toLowerCase().includes(q));
  }, [renters, search]);

  const selected = selectedRenter ? renters.find(r => r.name === selectedRenter) : null;

  const totalHours = useMemo(() => renters.reduce((s, r) => s + r.totalHours, 0), [renters]);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '20px 12px',
      overflowY: 'auto',
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'white', borderRadius: 16, width: '100%', maxWidth: 860,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', direction: 'rtl',
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
          color: 'white', borderRadius: '16px 16px 0 0',
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>📊</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>דו"ח שעות שכירות</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>סיכום שעות לפי שוכר בטווח תאריכים</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, cursor: 'pointer', padding: '2px 10px', lineHeight: 1.4 }}
          >✕</button>
        </div>

        {/* Filters */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              מתאריך
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit' }}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#64748b', fontWeight: 600 }}>
              עד תאריך
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit' }}
              />
            </label>
            <button
              onClick={() => void fetchReport()}
              disabled={loading || !fromDate || !toDate}
              style={{
                padding: '8px 20px', background: '#2563eb', color: 'white',
                border: 'none', borderRadius: 8, fontFamily: 'inherit', fontWeight: 700,
                fontSize: 14, cursor: 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >{loading ? '⟳ טוען...' : '🔍 הפק דו"ח'}</button>

            {events && (
              <input
                type="search"
                placeholder="חיפוש לפי שם..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  padding: '7px 12px', borderRadius: 8, border: '1px solid #cbd5e1',
                  fontSize: 14, fontFamily: 'inherit', minWidth: 180,
                }}
              />
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 340 }}>
          {/* Left: renter list */}
          <div style={{
            width: 260, flexShrink: 0, borderLeft: '1px solid #e2e8f0',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
          }}>
            {error && (
              <div style={{ padding: 16, color: '#dc2626', fontSize: 13 }}>❌ {error}</div>
            )}
            {!events && !loading && !error && (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, margin: 'auto' }}>
                בחר טווח תאריכים ולחץ "הפק דו"ח"
              </div>
            )}
            {events && events.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13, margin: 'auto' }}>
                אין אירועים בטווח זה
              </div>
            )}
            {filtered.length > 0 && (
              <>
                <div style={{
                  padding: '10px 14px', background: '#eff6ff', fontSize: 12,
                  color: '#1e3a5f', fontWeight: 700, borderBottom: '1px solid #dbeafe',
                  display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{filtered.length} שוכרים</span>
                  <span>סה"כ {formatHours(totalHours)}</span>
                </div>
                {filtered.map(r => (
                  <div
                    key={r.name}
                    onClick={() => setSelectedRenter(r.name === selectedRenter ? null : r.name)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                      background: r.name === selectedRenter ? '#eff6ff' : 'white',
                      borderRight: r.name === selectedRenter ? '3px solid #2563eb' : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => { if (r.name !== selectedRenter) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (r.name !== selectedRenter) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1e293b', marginBottom: 2 }}>{r.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                      <span>{r.events.length} אירועים</span>
                      <span style={{ fontWeight: 700, color: '#2563eb' }}>{formatHours(r.totalHours)}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Right: event breakdown */}
          <div style={{ flex: 1, overflowY: 'auto', padding: selected ? 0 : 24 }}>
            {!selected && (
              <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, paddingTop: 60 }}>
                {filtered.length > 0 ? 'לחץ על שוכר לצפייה בפירוט' : ''}
              </div>
            )}
            {selected && (
              <>
                <div style={{
                  padding: '14px 20px', background: '#eff6ff', borderBottom: '1px solid #dbeafe',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#1e3a5f' }}>{selected.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                      {selected.events.length} אירועים · סה"כ {formatHours(selected.totalHours)}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const rows = [['תאריך', 'חדר', 'שעת התחלה', 'שעת סיום', 'שעות'].join('\t'),
                        ...selected.events.map(e => [
                          formatEventDate(e.start), e.roomName,
                          formatEventTime(e.start), formatEventTime(e.end),
                          eventDurationHours(e).toFixed(2),
                        ].join('\t')),
                      ].join('\n');
                      navigator.clipboard.writeText(rows).catch(() => {});
                    }}
                    style={{
                      background: 'white', border: '1px solid #bfdbfe', borderRadius: 7,
                      padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', color: '#1e3a5f',
                    }}
                    title="העתק לאקסל"
                  >📋 העתק לאקסל</button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['תאריך', 'חדר', 'שעות התחלה–סיום', 'משך'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'right', color: '#64748b', fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.events.map(e => (
                      <tr key={e.id} style={{ borderBottom: '1px solid #f1f5f9' }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={ev => (ev.currentTarget.style.background = 'white')}
                      >
                        <td style={{ padding: '8px 14px', color: '#1e293b' }}>{formatEventDate(e.start)}</td>
                        <td style={{ padding: '8px 14px', color: '#475569' }}>{e.roomName}</td>
                        <td style={{ padding: '8px 14px', color: '#475569', direction: 'ltr', textAlign: 'left' }}>
                          {formatEventTime(e.start)} – {formatEventTime(e.end)}
                        </td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#2563eb' }}>
                          {formatHours(eventDurationHours(e))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#eff6ff', fontWeight: 700 }}>
                      <td colSpan={3} style={{ padding: '10px 14px', color: '#1e3a5f' }}>סה"כ</td>
                      <td style={{ padding: '10px 14px', color: '#2563eb', fontSize: 15 }}>{formatHours(selected.totalHours)}</td>
                    </tr>
                  </tfoot>
                </table>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
