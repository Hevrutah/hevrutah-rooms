import React, { useRef, useState } from 'react';
import { format } from 'date-fns';
import type { RoomCalendar, CalendarEvent } from '../types';
import { getEventsForDay } from '../utils';
import { HOURS_START, HOURS_END, ROOM_COLORS } from '../constants';

const ROW_H  = 40;
const TIME_W = 60;

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

interface Props {
  rooms: RoomCalendar[];
  allRooms: RoomCalendar[];
  days: Date[];
  onSlotClick: (room: RoomCalendar, day: Date, hour: number) => void;
  onEventClick: (event: CalendarEvent, room: RoomCalendar) => void;
  onEventMove?: (event: CalendarEvent, targetRoomName: string) => void;
  onRoomRename?: (oldName: string, newName: string) => void;
  isAdmin?: boolean;
}

interface EventLayout { event: CalendarEvent; col: number; totalCols: number }

function computeEventLayout(events: CalendarEvent[]): EventLayout[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const colEnd: number[] = [];
  const assigned: { event: CalendarEvent; col: number }[] = [];
  for (const event of sorted) {
    const s = +new Date(event.start), e = +new Date(event.end);
    let col = colEnd.findIndex(t => t <= s);
    if (col === -1) { col = colEnd.length; colEnd.push(e); } else colEnd[col] = e;
    assigned.push({ event, col });
  }
  return assigned.map(({ event, col }) => {
    const s = +new Date(event.start), e = +new Date(event.end);
    const overlapping = assigned.filter(({ event: e2 }) => s < +new Date(e2.end) && e > +new Date(e2.start));
    const totalCols = Math.max(...overlapping.map(o => o.col)) + 1;
    return { event, col, totalCols };
  });
}

function calcTop(iso: string) {
  const d = new Date(iso);
  return Math.max(0, ((d.getHours() - HOURS_START) * 60 + d.getMinutes()) / 60 * ROW_H);
}
function calcHeight(s: string, e: string) {
  return Math.max((+new Date(e) - +new Date(s)) / 60000 / 60 * ROW_H, 22);
}

const HOUR_COUNT = HOURS_END - HOURS_START;

export const WeekGrid: React.FC<Props> = ({
  rooms, allRooms, days, onSlotClick, onEventClick,
  onEventMove, onRoomRename, isAdmin,
}) => {
  function roomColor(room: RoomCalendar): string {
    const idx = allRooms.findIndex(r => r.id === room.id);
    return ROOM_COLORS[(idx === -1 ? 0 : idx) % ROOM_COLORS.length];
  }
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => HOURS_START + i);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // ── Drag & drop state ──────────────────────────────────────────
  const draggedEvent = useRef<{ event: CalendarEvent; sourceRoom: RoomCalendar } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null); // roomName being hovered

  // ── Room rename state ──────────────────────────────────────────
  const [renamingRoom, setRenamingRoom] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const numRooms = rooms.length || 1;
  const gridCols = `${TIME_W}px repeat(${numRooms}, 1fr)`;
  const bodyH    = HOUR_COUNT * ROW_H;

  if (rooms.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8', direction: 'rtl' }}>
        אין נתונים להצגה
      </div>
    );
  }

  return (
    <div>
      {days.map((day, dIdx) => {
        const isToday = format(day, 'yyyy-MM-dd') === todayStr;

        return (
          <div
            key={dIdx}
            data-today-section={isToday ? 'true' : undefined}
            data-date={format(day, 'yyyy-MM-dd')}
            style={{ borderBottom: '3px solid #cbd5e1' }}
          >
            {/* Day header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              background: isToday ? '#eff6ff' : '#f8fafc',
              borderBottom: '2px solid #e2e8f0',
              position: 'sticky', top: 0, zIndex: 10,
            }}>
              <div style={{ width: TIME_W, borderRight: '1px solid #e2e8f0' }} />
              <div style={{
                gridColumn: `2 / span ${numRooms}`,
                textAlign: 'center',
                fontSize: 13, fontWeight: 700,
                padding: '5px 4px',
                color: isToday ? '#2563eb' : '#374151',
                direction: 'rtl',
              }}>
                {HE_DAYS[day.getDay()]} {format(day, 'dd/MM')}
                {isToday && <span style={{ marginRight: 6, fontSize: 11, background: '#2563eb', color: 'white', borderRadius: 10, padding: '1px 8px' }}>היום</span>}
              </div>
            </div>

            {/* Room headers — click to rename (admin only) */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              background: isToday ? '#eff6ff' : '#f1f5f9',
              borderBottom: '1px solid #e2e8f0',
              position: 'sticky', top: 28, zIndex: 9,
            }}>
              <div style={{ width: TIME_W, borderRight: '1px solid #e2e8f0' }} />
              {rooms.map((room, rIdx) => (
                <div
                  key={rIdx}
                  style={{
                    padding: '3px 4px', textAlign: 'center',
                    fontSize: 10, fontWeight: 700,
                    color: 'white',
                    background: roomColor(room),
                    borderRight: rIdx < numRooms - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none',
                    direction: 'rtl',
                  }}
                >
                  {isAdmin && onRoomRename && renamingRoom === room.name ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && renameValue.trim() && renameValue.trim() !== room.name) {
                          onRoomRename(room.name, renameValue.trim());
                          setRenamingRoom(null);
                        } else if (e.key === 'Escape') {
                          setRenamingRoom(null);
                        }
                      }}
                      onBlur={() => {
                        if (renameValue.trim() && renameValue.trim() !== room.name) {
                          onRoomRename(room.name, renameValue.trim());
                        }
                        setRenamingRoom(null);
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: '90%', fontSize: 10, fontFamily: 'inherit',
                        background: 'rgba(255,255,255,0.9)', color: '#1e293b',
                        border: 'none', borderRadius: 3, padding: '1px 4px', direction: 'rtl',
                      }}
                    />
                  ) : (
                    <span
                      title={isAdmin ? 'לחץ פעמיים לשינוי שם' : room.name}
                      onDoubleClick={isAdmin && onRoomRename ? () => { setRenamingRoom(room.name); setRenameValue(room.name); } : undefined}
                      style={{
                        display: 'block', overflow: 'hidden', whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        cursor: isAdmin && onRoomRename ? 'text' : 'default',
                      }}
                    >
                      {room.name}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Time grid */}
            <div style={{ position: 'relative', height: bodyH }}>

              {/* Hour rows */}
              {hours.map(hour => (
                <div
                  key={hour}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: gridCols,
                    height: ROW_H,
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div style={{
                    fontSize: 10, color: '#94a3b8',
                    textAlign: 'center', paddingTop: 4,
                    borderRight: '1px solid #e2e8f0',
                  }}>
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  {rooms.map((room, rIdx) => {
                    const isDrop = dropTarget === room.name;
                    return (
                      <div
                        key={rIdx}
                        onClick={() => onSlotClick(room, day, hour)}
                        onDragOver={onEventMove ? e => { e.preventDefault(); setDropTarget(room.name); } : undefined}
                        onDragLeave={onEventMove ? () => setDropTarget(null) : undefined}
                        onDrop={onEventMove ? e => {
                          e.preventDefault();
                          setDropTarget(null);
                          const d = draggedEvent.current;
                          if (d && d.sourceRoom.name !== room.name) {
                            onEventMove(d.event, room.name);
                          }
                          draggedEvent.current = null;
                        } : undefined}
                        style={{
                          borderRight: rIdx < numRooms - 1 ? '1px solid #e2e8f0' : 'none',
                          background: isDrop ? '#dbeafe' : 'white',
                          cursor: 'pointer',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => { if (!isDrop) (e.currentTarget as HTMLDivElement).style.background = '#f0f9ff'; }}
                        onMouseLeave={e => { if (!isDrop) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                      />
                    );
                  })}
                </div>
              ))}

              {/* Event overlay */}
              <div style={{
                position: 'absolute', inset: 0,
                display: 'grid', gridTemplateColumns: gridCols,
                pointerEvents: 'none',
              }}>
                <div /> {/* time column spacer */}
                {rooms.map((room, rIdx) => {
                  const dayEvents = getEventsForDay(room.events, day);
                  const seen = new Set<string>();
                  const unique  = dayEvents.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
                  const layouts = computeEventLayout(unique);

                  return (
                    <div
                      key={rIdx}
                      style={{ position: 'relative', height: '100%', pointerEvents: 'none' }}
                    >
                      {layouts.map(({ event, col, totalCols: tc }) => {
                        const color   = roomColor(room);
                        const top     = calcTop(event.start);
                        const height  = calcHeight(event.start, event.end);
                        const sFmt    = format(new Date(event.start), 'HH:mm');
                        const eFmt    = format(new Date(event.end),   'HH:mm');
                        // use full column width per room, subdivide only for overlaps
                        const slotW   = (100 / tc);
                        const leftPct = col * slotW;

                        return (
                          <div
                            key={event.id}
                            draggable={!!onEventMove}
                            onDragStart={onEventMove ? e => {
                              draggedEvent.current = { event, sourceRoom: room };
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', event.id);
                            } : undefined}
                            onDragEnd={onEventMove ? () => { draggedEvent.current = null; setDropTarget(null); } : undefined}
                            onClick={e => { e.stopPropagation(); onEventClick(event, room); }}
                            title={`${event.summary}\n${sFmt}–${eFmt}\nלחץ לעריכה${onEventMove ? ' • גרור לחדר אחר' : ''}`}
                            style={{
                              position: 'absolute',
                              top, height: height - 2,
                              left: `calc(${leftPct}% + 1px)`,
                              width: `calc(${slotW}% - 2px)`,
                              background: color, color: 'white',
                              borderRadius: 3, padding: '2px 3px',
                              fontSize: 10, fontWeight: 600,
                              overflow: 'hidden', cursor: onEventMove ? 'grab' : 'pointer',
                              pointerEvents: 'auto', zIndex: 2, direction: 'rtl',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.18)', boxSizing: 'border-box',
                            }}
                          >
                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {tc > 1 && col === 1 && '⚠️ '}{event.summary}
                            </div>
                            {height >= 36 && (
                              <div style={{ fontSize: 9, opacity: 0.88, marginTop: 1 }}>{sFmt}–{eFmt}</div>
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
      })}
    </div>
  );
};
