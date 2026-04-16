import React, { useRef, useEffect, useState } from 'react';
import { format, addDays } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const ROW_H = 48;   // px per hour
const TIME_W = 48;  // px for time column

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOUR_COUNT = HOURS_END - HOURS_START;
const GRID_COLS = `${TIME_W}px repeat(6, 1fr)`;
const DAY_BORDER = '4px solid #475569';

interface EventWithRoom { event: CalendarEvent; room: RoomCalendar; roomIdx: number }
interface LayedOut extends EventWithRoom { col: number; totalCols: number }

function layoutDay(events: EventWithRoom[]): LayedOut[] {
  if (!events.length) return [];
  const sorted = [...events].sort((a, b) => +new Date(a.event.start) - +new Date(b.event.start));
  const colEnd: number[] = [];
  const assigned: Array<EventWithRoom & { col: number }> = [];
  for (const ev of sorted) {
    const s = +new Date(ev.event.start), e = +new Date(ev.event.end);
    let col = colEnd.findIndex(t => t <= s);
    if (col === -1) { col = colEnd.length; colEnd.push(e); } else colEnd[col] = e;
    assigned.push({ ...ev, col });
  }
  return assigned.map(item => {
    const s = +new Date(item.event.start), e = +new Date(item.event.end);
    const overlapping = assigned.filter(o =>
      s < +new Date(o.event.end) && e > +new Date(o.event.start)
    );
    return { ...item, totalCols: Math.max(...overlapping.map(o => o.col)) + 1 };
  });
}

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

  function eventsForDay(day: Date): EventWithRoom[] {
    const ds = format(day, 'yyyy-MM-dd');
    const result: EventWithRoom[] = [];
    rooms.forEach((room, roomIdx) => {
      room.events.forEach(event => {
        if (format(new Date(event.start), 'yyyy-MM-dd') === ds)
          result.push({ event, room, roomIdx });
      });
    });
    return result;
  }

  if (isMobile) {
    const mDay = days[mobileDayIdx] ?? days[0];
    const laid = mDay ? layoutDay(eventsForDay(mDay)) : [];
    const mIsToday = mDay ? format(mDay, 'yyyy-MM-dd') === todayStr : false;

    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Day selector row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          background: '#f8fafc', borderBottom: '1px solid #e2e8f0',
          padding: '4px 0', overflowX: 'auto',
          flexShrink: 0,
        }}>
          {days.map((day, i) => {
            const isToday = format(day, 'yyyy-MM-dd') === todayStr;
            const isActive = i === mobileDayIdx;
            return (
              <button
                key={i}
                onClick={() => setMobileDayIdx(i)}
                style={{
                  flex: 1, minWidth: 40, padding: '4px 2px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
              >
                <span style={{ fontSize: 10, color: isToday ? '#2563eb' : '#64748b' }}>
                  {HE_DAYS[day.getDay()]}
                </span>
                <span style={{
                  width: 28, height: 28,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? '#2563eb' : isActive ? '#dbeafe' : 'transparent',
                  color: isToday ? 'white' : isActive ? '#1d4ed8' : '#1e293b',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {format(day, 'd')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Single day time grid */}
        <div style={{ flex: 1, overflowY: 'auto' }} ref={scrollRef}>
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${TIME_W}px 1fr` }}>
            {/* Time gutter */}
            <div>
              {hours.map(h => (
                <div key={h} style={{
                  height: ROW_H, boxSizing: 'border-box',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
                  paddingRight: 6, paddingTop: 2,
                  fontSize: 10, color: '#94a3b8',
                  borderTop: '1px solid #f1f5f9',
                }}>
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day column */}
            {mDay && (
              <div style={{
                position: 'relative',
                background: mIsToday ? '#eff6ff' : 'white',
                borderLeft: '1px solid #e2e8f0',
              }}>
                {hours.map(h => (
                  <div
                    key={h}
                    onClick={() => onSlotClick(rooms[0] ?? { id: '', name: '', events: [] }, mDay, h)}
                    style={{ height: ROW_H, boxSizing: 'border-box', borderTop: '1px solid #f1f5f9', cursor: 'pointer' }}
                  />
                ))}
                {laid.map(({ event, room, roomIdx, col, totalCols }) => {
                  const color = roomColor(roomIdx, room);
                  const t = top(event.start);
                  const h = height(event.start, event.end);
                  const w = `calc(${100 / totalCols}% - 4px)`;
                  const l = `calc(${(col / totalCols) * 100}% + 2px)`;
                  return (
                    <div
                      key={event.id}
                      onClick={e => { e.stopPropagation(); onEventClick(event, room); }}
                      title={`${event.summary} | ${room.name}`}
                      style={{
                        position: 'absolute', top: t, height: h, left: l, width: w,
                        background: color, color: 'white',
                        borderRadius: 4, padding: '2px 4px',
                        fontSize: 11, cursor: 'pointer',
                        overflow: 'hidden', boxSizing: 'border-box',
                        zIndex: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    >
                      <div style={{ fontWeight: 700, lineHeight: 1.3, direction: 'rtl', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {event.summary}
                      </div>
                      {h > 30 && (
                        <div style={{ fontSize: 9, opacity: 0.85, direction: 'rtl' }}>
                          {room.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} ref={scrollRef}>
      {/* ── Header (sticky inside scroll container → perfectly aligned) ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        position: 'sticky', top: 0, zIndex: 10,
        background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
        minWidth: 500,
      }}>
        <div /> {/* time corner */}
        {days.map((day, i) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          return (
            <div key={i} style={{
              textAlign: 'center', padding: '6px 2px',
              direction: 'rtl', borderLeft: DAY_BORDER,
            }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{HE_DAYS[day.getDay()]}</div>
              <div
                onClick={() => onDayClick?.(day)}
                title="עבור לתצוגה יומית"
                style={{
                  fontSize: 15, fontWeight: 700,
                  width: 28, height: 28, margin: '2px auto 0',
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

      {/* ── Body grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: GRID_COLS,
        minWidth: 500,
      }}>
        {/* Time gutter */}
        <div>
          {hours.map(h => (
            <div key={h} style={{
              height: ROW_H, boxSizing: 'border-box',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
              paddingRight: 6, paddingTop: 2,
              fontSize: 10, color: '#94a3b8',
              borderTop: '1px solid #f1f5f9',
            }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIdx) => {
          const laid = layoutDay(eventsForDay(day));
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          return (
            <div key={dayIdx} style={{
              position: 'relative',
              borderLeft: DAY_BORDER,
              background: isToday ? '#eff6ff' : 'white',
            }}>
              {/* Hour grid lines — clickable slots */}
              {hours.map(h => (
                <div
                  key={h}
                  onClick={() => onSlotClick(rooms[0] ?? { id: '', name: '', events: [] }, day, h)}
                  style={{
                    height: ROW_H, boxSizing: 'border-box',
                    borderTop: '1px solid #f1f5f9',
                    cursor: 'pointer',
                  }}
                />
              ))}

              {/* Events */}
              {laid.map(({ event, room, roomIdx, col, totalCols }) => {
                const color = roomColor(roomIdx, room);
                const t = top(event.start);
                const h = height(event.start, event.end);
                const w = `calc(${100 / totalCols}% - 4px)`;
                const l = `calc(${(col / totalCols) * 100}% + 2px)`;
                return (
                  <div
                    key={event.id}
                    onClick={e => { e.stopPropagation(); onEventClick(event, room); }}
                    title={`${event.summary} | ${room.name}`}
                    style={{
                      position: 'absolute', top: t, height: h,
                      left: l, width: w,
                      background: color, color: 'white',
                      borderRadius: 4, padding: '2px 4px',
                      fontSize: 10, cursor: 'pointer',
                      overflow: 'hidden', boxSizing: 'border-box',
                      zIndex: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ fontWeight: 700, lineHeight: 1.2, direction: 'rtl' }}>
                      {event.summary}
                    </div>
                    {h > 28 && (
                      <div style={{ fontSize: 9, opacity: 0.85, direction: 'rtl' }}>
                        {room.name}
                      </div>
                    )}
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
