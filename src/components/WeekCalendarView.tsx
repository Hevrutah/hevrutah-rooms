import React, { useRef } from 'react';
import { format, addDays } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const DAY_BORDER = '1px solid #e5e7eb';

const CELL_H = 84;         // px height per day-row cell
const DAY_LABEL_W = 72;    // px width of the day label column
const DAY_RANGE = HOURS_END - HOURS_START;

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

  // Sun–Fri (skip Sat)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter(d => d.getDay() !== 6);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }} ref={scrollRef}>

      {/* ── Sticky header: room names as columns ── */}
      <div style={{
        display: 'flex', position: 'sticky', top: 0, zIndex: 10,
        background: 'white', borderBottom: '2px solid #e5e7eb', minWidth: 400,
      }}>
        <div style={{ width: DAY_LABEL_W, flexShrink: 0 }} /> {/* corner */}
        {rooms.map((room, roomIdx) => {
          const color = roomColor(roomIdx, room);
          return (
            <div key={room.id} style={{
              flex: 1, minWidth: 80,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '10px 4px',
              background: color, color: 'white',
              fontSize: 12, fontWeight: 700,
              textAlign: 'center', direction: 'rtl',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}>
              {room.name}
            </div>
          );
        })}
      </div>

      {/* ── Body: one row per day ── */}
      <div style={{ minWidth: 400 }}>
        {days.map((day) => {
          const isToday = format(day, 'yyyy-MM-dd') === todayStr;
          const ds = format(day, 'yyyy-MM-dd');
          return (
            <div key={ds} style={{ display: 'flex', borderBottom: DAY_BORDER }}>

              {/* Day label */}
              <div
                onClick={() => onDayClick?.(day)}
                title="עבור לתצוגה יומית"
                style={{
                  width: DAY_LABEL_W, flexShrink: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 2,
                  background: isToday ? '#eff6ff' : '#f8fafc',
                  borderRight: '1px solid #e5e7eb',
                  cursor: onDayClick ? 'pointer' : 'default',
                  padding: '6px 0',
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 500, color: isToday ? '#2563eb' : '#64748b' }}>
                  {HE_DAYS[day.getDay()]}
                </span>
                <span style={{
                  width: 34, height: 34,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? '#2563eb' : 'transparent',
                  color: isToday ? 'white' : '#1e293b',
                  fontSize: 18, fontWeight: 700,
                }}>
                  {format(day, 'd')}
                </span>
              </div>

              {/* Room cells */}
              {rooms.map((room, roomIdx) => {
                const color = roomColor(roomIdx, room);
                const dayEvts = room.events.filter(e => format(new Date(e.start), 'yyyy-MM-dd') === ds);
                return (
                  <div
                    key={room.id}
                    onClick={() => onSlotClick(room, day, HOURS_START)}
                    style={{
                      flex: 1, minWidth: 80, height: CELL_H,
                      borderLeft: DAY_BORDER, position: 'relative',
                      background: isToday ? '#eff6ff' : 'white',
                      cursor: 'pointer', overflow: 'hidden',
                    }}
                  >
                    {dayEvts.map(event => {
                      const startH = new Date(event.start).getHours() + new Date(event.start).getMinutes() / 60;
                      const endH   = new Date(event.end).getHours()   + new Date(event.end).getMinutes()   / 60;
                      const topPct = Math.max(0, (startH - HOURS_START) / DAY_RANGE * 100);
                      const hPct   = Math.max(5, (endH - startH)        / DAY_RANGE * 100);
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
