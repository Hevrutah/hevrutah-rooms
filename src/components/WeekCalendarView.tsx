import React, { useRef, useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const ROW_H = 60;   // px per hour (was 48)
const TIME_W = 56;  // px for time column (was 48)

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOUR_COUNT = HOURS_END - HOURS_START;
const DAY_BORDER = '1px solid #e5e7eb';     // subtle light grey, like Google Calendar
const HOUR_BORDER = '1px solid #e5e7eb';    // top of each hour row


function top(iso: string) {
  const d = new Date(iso);
  return Math.max(0, ((d.getHours() - HOURS_START) * 60 + d.getMinutes()) / 60 * ROW_H);
}
function height(s: string, e: string) {
  return Math.max((+new Date(e) - +new Date(s)) / 60000 / 60 * ROW_H, 18);
}

interface Props {
  rooms: RoomCalendar[];
  allRooms: RoomCalendar[];
  weekStart: Date;
  onSlotClick: (room: RoomCalendar, day: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent, room: RoomCalendar) => void;
  onDayClick?: (day: Date) => void;
}

export const WeekCalendarView: React.FC<Props> = ({ rooms, allRooms, weekStart, onSlotClick, onEventClick, onDayClick }) => {
  function roomColor(roomIdx: number, room: RoomCalendar): string {
    const origIdx = allRooms.findIndex(r => r.id === room.id);
    return ROOM_COLORS[(origIdx === -1 ? roomIdx : origIdx) % ROOM_COLORS.length];
  }

  // 6 days: Sunday–Friday (skip Saturday = getDay() 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(d => d.getDay() !== 6);
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => HOURS_START + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const scrollRef = useRef<HTMLDivElement>(null);

  const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 639px)') : null;
  const [isMobile, setIsMobile] = useState(() => mq?.matches ?? false);
  useEffect(() => {
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mobile: selected day index
  const todayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);
  const [mobileDayIdx, setMobileDayIdx] = useState(() => todayIdx >= 0 ? todayIdx : 0);
  useEffect(() => {
    const ti = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr);
    if (ti >= 0) setMobileDayIdx(ti);
  }, [weekStart]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = (8 - HOURS_START) * ROW_H;
    }
  }, []);


  if (isMobile) {
    const mDay = days[mobileDayIdx] ?? days[0];
    const ds = mDay ? format(mDay, 'yyyy-MM-dd') : '';
    const ROOM_W = 92; // px per room column

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Day selector row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          padding: '4px 0', overflowX: 'auto', flexShrink: 0,
        }}>
          {days.map((day, i) => {
            const isToday = format(day, 'yyyy-MM-dd') === todayStr;
            const isActive = i === mobileDayIdx;
            const hasEvents = rooms.some(r =>
              r.events.some(e => format(new Date(e.start), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd'))
            );
            return (
              <button key={i} onClick={() => setMobileDayIdx(i)} style={{
                flex: 1, minWidth: 40, padding: '4px 2px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              }}>
                <span style={{ fontSize: 11, color: isToday ? '#2563eb' : '#64748b', fontWeight: isActive ? 700 : 400 }}>
                  {HE_DAYS[day.getDay()]}
                </span>
                <span style={{
                  width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? '#2563eb' : isActive ? '#dbeafe' : 'transparent',
                  color: isToday ? 'white' : isActive ? '#1d4ed8' : '#1e293b',
                  fontSize: 15, fontWeight: 700,
                }}>{format(day, 'd')}</span>
                {/* dot for days with events */}
                <div style={{
                  width: 4, height: 4, borderRadius: '50%', marginTop: -1,
                  background: hasEvents ? (isToday ? '#2563eb' : isActive ? '#1d4ed8' : '#94a3b8') : 'transparent',
                }} />
              </button>
            );
          })}
        </div>

        {/* Room-based day grid — scrolls vertically and horizontally */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} ref={scrollRef}>
          <div style={{ display: 'flex', minWidth: TIME_W + rooms.length * ROOM_W }}>

            {/* Sticky time gutter */}
            <div style={{ width: TIME_W, flexShrink: 0, position: 'sticky', left: 0, zIndex: 3, background: 'white' }}>
              <div style={{ height: 36, borderBottom: '1px solid #e5e7eb' }} />
              {hours.map(h => (
                <div key={h} style={{
                  height: ROW_H, boxSizing: 'border-box',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                  paddingRight: 6, paddingTop: 4, fontSize: 11, color: '#64748b', fontWeight: 500,
                  borderTop: HOUR_BORDER,
                }}>{String(h).padStart(2, '0')}:00</div>
              ))}
            </div>

            {/* One column per room */}
            {rooms.map((room, roomIdx) => {
              const color = roomColor(roomIdx, room);
              const roomEvts = room.events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === ds);
              return (
                <div key={room.id} style={{ width: ROOM_W, flexShrink: 0 }}>
                  {/* Room header */}
                  <div style={{
                    height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: color, color: 'white',
                    fontSize: 10, fontWeight: 700, textAlign: 'center',
                    padding: '0 3px', direction: 'rtl',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    borderBottom: '1px solid rgba(255,255,255,0.25)',
                    borderLeft: '1px solid rgba(0,0,0,0.08)',
                  }}>
                    {room.name}
                  </div>
                  {/* Hour slots + events */}
                  <div style={{ position: 'relative' }}>
                    {hours.map(h => (
                      <div
                        key={h}
                        onClick={() => mDay && onSlotClick(room, mDay, h)}
                        style={{
                          height: ROW_H, boxSizing: 'border-box',
                          borderTop: HOUR_BORDER, borderLeft: DAY_BORDER,
                          cursor: 'pointer',
                          backgroundImage: `linear-gradient(to bottom, transparent calc(50% - 1px), #f1f5f9 calc(50% - 1px), #f1f5f9 50%, transparent 50%)`,
                          backgroundRepeat: 'no-repeat',
                        }}
                      />
                    ))}
                    {roomEvts.map(event => {
                      const t = top(event.start);
                      const h = height(event.start, event.end);
                      return (
                        <div
                          key={event.id}
                          onClick={e => { e.stopPropagation(); onEventClick(event, room); }}
                          title={event.summary}
                          style={{
                            position: 'absolute', top: t, height: h,
                            left: 2, right: 2,
                            background: color, color: 'white',
                            borderRadius: 5, padding: '3px 4px',
                            fontSize: 11, lineHeight: 1.25, cursor: 'pointer',
                            overflow: 'hidden', boxSizing: 'border-box',
                            zIndex: 5, boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            direction: 'rtl',
                          }}
                        >
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {event.summary}
                          </div>
                          {h > 30 && (
                            <div style={{ fontSize: 10, opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                              {format(new Date(event.start), 'HH:mm')}–{format(new Date(event.end), 'HH:mm')}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop: room × day matrix ──────────────────────────────────────────
  const CELL_H = 84;
  const ROOM_LABEL_W = 110;
  const DAY_RANGE = HOURS_END - HOURS_START;

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} ref={scrollRef}>
      {/* ── Header: day names ── */}
      <div style={{
        display: 'flex', position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: '1px solid #e5e7eb', minWidth: 500,
      }}>
        <div style={{ width: ROOM_LABEL_W, flexShrink: 0 }} />
        {days.map((day, i) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          return (
            <div key={i} style={{
              flex: 1, minWidth: 0,
              textAlign: 'center', padding: '8px 2px 10px',
              direction: 'rtl', borderLeft: DAY_BORDER,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: isToday ? '#2563eb' : '#64748b', letterSpacing: 0.3 }}>
                {HE_DAYS[day.getDay()]}
              </div>
              <div
                onClick={() => onDayClick?.(day)}
                title="עבור לתצוגה יומית"
                style={{
                  fontSize: 22, fontWeight: 500,
                  width: 38, height: 38, margin: '4px auto 0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? '#2563eb' : 'transparent',
                  color: isToday ? 'white' : '#1e293b',
                  cursor: onDayClick ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!isToday) (e.currentTarget as HTMLElement).style.background = '#dbeafe'; }}
                onMouseLeave={e => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Body: one row per room ── */}
      <div style={{ minWidth: 500 }}>
        {rooms.map((room, roomIdx) => {
          const color = roomColor(roomIdx, room);
          return (
            <div key={room.id} style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
              {/* Room label */}
              <div style={{
                width: ROOM_LABEL_W, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 10, paddingLeft: 4,
                fontSize: 12, fontWeight: 700, color: 'white',
                background: color, direction: 'rtl',
                borderRight: '2px solid rgba(0,0,0,0.1)',
              }}>
                {room.name}
              </div>

              {/* Day cells */}
              {days.map((day, dayIdx) => {
                const isToday = format(day, 'yyyy-MM-dd') === todayStr;
                const ds = format(day, 'yyyy-MM-dd');
                const dayEvts = room.events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === ds);
                return (
                  <div
                    key={dayIdx}
                    onClick={() => onSlotClick(room, day, HOURS_START)}
                    style={{
                      flex: 1, minWidth: 0, height: CELL_H,
                      borderLeft: DAY_BORDER, position: 'relative',
                      background: isToday ? '#eff6ff' : 'white',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {dayEvts.map(event => {
                      const startH = new Date(event.start).getHours() + new Date(event.start).getMinutes() / 60;
                      const endH = new Date(event.end).getHours() + new Date(event.end).getMinutes() / 60;
                      const topPct = Math.max(0, (startH - HOURS_START) / DAY_RANGE * 100);
                      const hPct = Math.max(5, (endH - startH) / DAY_RANGE * 100);
                      return (
                        <div
                          key={event.id}
                          onClick={e => { e.stopPropagation(); onEventClick(event, room); }}
                          title={`${event.summary}  ${format(new Date(event.start), 'HH:mm')}–${format(new Date(event.end), 'HH:mm')}`}
                          style={{
                            position: 'absolute',
                            top: `${topPct}%`, height: `${hPct}%`,
                            left: 2, right: 2,
                            background: color, color: 'white',
                            borderRadius: 4, padding: '1px 4px',
                            fontSize: 10, lineHeight: 1.3,
                            overflow: 'hidden', cursor: 'pointer',
                            whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                            direction: 'rtl', zIndex: 1,
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                          }}
                        >
                          {event.summary}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
