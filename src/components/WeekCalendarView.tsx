import React, { useRef, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const ROW_H = 48;   // px per hour
const TIME_W = 48;  // px for time column

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOUR_COUNT = HOURS_END - HOURS_START;

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
  weekStart: Date;
  onSlotClick: (room: RoomCalendar, day: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent, room: RoomCalendar) => void;
}

export const WeekCalendarView: React.FC<Props> = ({ rooms, weekStart, onSlotClick, onEventClick }) => {
  // 6 days: Sunday–Friday (skip Saturday = getDay() 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(d => d.getDay() !== 6);
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => HOURS_START + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const bodyRef = useRef<HTMLDivElement>(null);

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = (8 - HOURS_START) * ROW_H;
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      {/* Sticky header: day names */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${TIME_W}px repeat(6, 1fr)`,
        position: 'sticky', top: 0, zIndex: 10,
        background: '#f8fafc', borderBottom: '2px solid #e2e8f0',
        flexShrink: 0,
      }}>
        <div /> {/* empty time corner */}
        {days.map((day, i) => {
          const ds = format(day, 'yyyy-MM-dd');
          const isToday = ds === todayStr;
          return (
            <div key={i} style={{
              textAlign: 'center', padding: '6px 2px',
              direction: 'rtl', borderLeft: '1px solid #e2e8f0',
            }}>
              <div style={{ fontSize: 11, color: '#64748b' }}>{HE_DAYS[day.getDay()]}</div>
              <div style={{
                fontSize: 15, fontWeight: 700,
                width: 28, height: 28, margin: '2px auto 0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: '50%',
                background: isToday ? '#2563eb' : 'transparent',
                color: isToday ? 'white' : '#1e293b',
              }}>
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={bodyRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: `${TIME_W}px repeat(6, 1fr)`,
          minWidth: 500,
        }}>
          {/* Time gutter */}
          <div style={{ position: 'relative' }}>
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
            const ds = format(day, 'yyyy-MM-dd');
            const isToday = ds === todayStr;
            return (
              <div key={dayIdx} style={{
                position: 'relative',
                borderLeft: '1px solid #e2e8f0',
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
                  const color = ROOM_COLORS[roomIdx % ROOM_COLORS.length];
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
    </div>
  );
};
