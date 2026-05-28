import React, { useRef, useEffect } from 'react';
import { format, addDays } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const ROW_H     = 64;   // px per hour
const TIME_W    = 52;   // time gutter width
const MIN_DAY_W = 130;  // minimum px per day column
const HE_DAYS   = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOUR_COUNT  = HOURS_END - HOURS_START;
const DAY_BORDER  = '1px solid #e5e7eb';
const HOUR_BORDER = '1px solid #e5e7eb';

interface EventWithRoom { event: CalendarEvent; room: RoomCalendar; roomIdx: number }
interface LayedOut      extends EventWithRoom  { col: number; totalCols: number }

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
    const overlapping = assigned.filter(o => s < +new Date(o.event.end) && e > +new Date(o.event.start));
    return { ...item, totalCols: Math.max(...overlapping.map(o => o.col)) + 1 };
  });
}

function top(iso: string) {
  const d = new Date(iso);
  return Math.max(0, ((d.getHours() - HOURS_START) * 60 + d.getMinutes()) / 60 * ROW_H);
}
function eventHeight(s: string, e: string) {
  return Math.max((+new Date(e) - +new Date(s)) / 60000 / 60 * ROW_H, 20);
}

interface Props {
  rooms: RoomCalendar[];
  allRooms: RoomCalendar[];
  weekStart: Date;
  onSlotClick: (room: RoomCalendar, day: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent, room: RoomCalendar) => void;
  onDayClick?: (day: Date) => void;
}

export const WeekCalendarView: React.FC<Props> = ({
  rooms, allRooms, weekStart, onSlotClick, onEventClick, onDayClick,
}) => {
  function roomColor(roomIdx: number, room: RoomCalendar): string {
    const origIdx = allRooms.findIndex(r => r.id === room.id);
    return ROOM_COLORS[(origIdx === -1 ? roomIdx : origIdx) % ROOM_COLORS.length];
  }

  const days     = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(d => d.getDay() !== 6);
  const hours    = Array.from({ length: HOUR_COUNT }, (_, i) => HOURS_START + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const scrollRef = useRef<HTMLDivElement>(null);
  const totalMinW = TIME_W + days.length * MIN_DAY_W;

  // Scroll to 08:00 on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (8 - HOURS_START) * ROW_H;
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
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} ref={scrollRef}>

      {/* ── Sticky header: day names ── */}
      <div style={{
        display: 'flex', position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: '1px solid #e5e7eb',
        minWidth: totalMinW,
      }}>
        <div style={{ width: TIME_W, flexShrink: 0 }} />
        {days.map((day, i) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          return (
            <div key={i} style={{
              flex: 1, minWidth: MIN_DAY_W,
              textAlign: 'center', padding: '8px 4px 10px',
              direction: 'rtl', borderLeft: DAY_BORDER,
            }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: isToday ? '#2563eb' : '#64748b' }}>
                {HE_DAYS[day.getDay()]}
              </div>
              <div
                onClick={() => onDayClick?.(day)}
                title="עבור לתצוגה יומית"
                style={{
                  fontSize: 22, fontWeight: 600,
                  width: 40, height: 40, margin: '4px auto 0',
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

      {/* ── Body ── */}
      <div style={{ display: 'flex', minWidth: totalMinW }}>

        {/* Sticky time gutter */}
        <div style={{
          width: TIME_W, flexShrink: 0,
          position: 'sticky', left: 0,
          background: 'white', zIndex: 2,
          borderRight: '1px solid #e5e7eb',
        }}>
          {hours.map(h => (
            <div key={h} style={{
              height: ROW_H, boxSizing: 'border-box',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
              paddingRight: 8, paddingTop: 4,
              fontSize: 11, color: '#64748b', fontWeight: 500,
              borderTop: HOUR_BORDER,
            }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, dayIdx) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          const laid    = layoutDay(eventsForDay(day));
          return (
            <div key={dayIdx} style={{
              flex: 1, minWidth: MIN_DAY_W,
              position: 'relative',
              background: isToday ? '#eff6ff' : 'white',
              borderLeft: DAY_BORDER,
            }}>
              {/* Hour rows */}
              {hours.map(h => (
                <div
                  key={h}
                  onClick={() => onSlotClick(rooms[0] ?? { id: '', name: '', events: [] }, day, h)}
                  style={{
                    height: ROW_H, boxSizing: 'border-box',
                    borderTop: HOUR_BORDER, cursor: 'pointer',
                    backgroundImage: `linear-gradient(to bottom, transparent calc(50% - 1px), #f1f5f9 calc(50% - 1px), #f1f5f9 50%, transparent 50%)`,
                    backgroundRepeat: 'no-repeat',
                  }}
                />
              ))}

              {/* Events */}
              {laid.map(({ event, room, roomIdx, col, totalCols }) => {
                const color = roomColor(roomIdx, room);
                const t = top(event.start);
                const h = eventHeight(event.start, event.end);
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
                      borderRadius: 4, padding: '2px 3px',
                      fontSize: 9, lineHeight: 1.25, cursor: 'pointer',
                      overflow: 'hidden', boxSizing: 'border-box',
                      zIndex: 5, boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                    }}
                  >
                    <div style={{ fontWeight: 700, direction: 'rtl', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {event.summary}
                    </div>
                    {h > 28 && (
                      <div style={{ fontSize: 9, opacity: 0.9, direction: 'rtl', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                        {room.name}
                      </div>
                    )}
                    {h > 44 && (
                      <div style={{ fontSize: 9, opacity: 0.8, direction: 'rtl', marginTop: 1 }}>
                        {format(new Date(event.start), 'HH:mm')}–{format(new Date(event.end), 'HH:mm')}
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
