import { startOfWeek, endOfWeek, addWeeks, addDays, format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { CalendarEvent, Conflict, RoomCalendar, WeekStats } from './types';
import { HOURS_START, HOURS_END } from './constants';

export function getWeekBounds(baseDate: Date): { start: Date; end: Date } {
  const start = startOfWeek(baseDate, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(baseDate, { weekStartsOn: 1 });
  return { start, end };
}

export function navigateWeek(baseDate: Date, direction: -1 | 1): Date {
  return addWeeks(baseDate, direction);
}

export function navigateDays(baseDate: Date, n: number): Date {
  return addDays(baseDate, n);
}

export function formatWeekLabel(start: Date, end: Date): string {
  return `${format(start, 'dd/MM/yyyy')} – ${format(end, 'dd/MM/yyyy')}`;
}

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function formatViewLabel(viewBase: Date, viewDays: 1 | 3): string {
  if (viewDays === 1) {
    return `יום ${DAY_NAMES_HE[viewBase.getDay()]}, ${format(viewBase, 'dd/MM/yyyy')}`;
  }
  const end = addDays(viewBase, 2);
  return `${format(viewBase, 'dd/MM')} – ${format(end, 'dd/MM')}`;
}

export function detectConflicts(rooms: RoomCalendar[]): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const room of rooms) {
    const events = room.events.filter((e) => e.start && e.end);
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];

        // Only a conflict when two DIFFERENT therapists overlap in the same room
        if (a.summary.trim() === b.summary.trim()) continue;

        const aStart = new Date(a.start).getTime();
        const aEnd   = new Date(a.end).getTime();
        const bStart = new Date(b.start).getTime();
        const bEnd   = new Date(b.end).getTime();

        if (aStart < bEnd && aEnd > bStart) {
          const overlapStart = Math.max(aStart, bStart);
          const overlapEnd   = Math.min(aEnd, bEnd);
          const timeLabel = `${format(new Date(overlapStart), 'HH:mm')}–${format(new Date(overlapEnd), 'HH:mm')}`;
          conflicts.push({
            roomName: room.name,
            roomId: room.id,
            time: timeLabel,
            events: [a, b],
          });
        }
      }
    }
  }

  return conflicts;
}

export function computeWeekStats(rooms: RoomCalendar[], _weekStart: Date, _weekEnd: Date): WeekStats {
  const today = new Date();
  const todayStart = startOfDay(today);
  const todayEnd = endOfDay(today);

  const totalWorkHours = (HOURS_END - HOURS_START) * 7; // per week

  const roomOccupancy: Record<string, number> = {};
  let totalToday = 0;

  for (const room of rooms) {
    let bookedMinutes = 0;

    for (const event of room.events) {
      const start = new Date(event.start);
      const end = new Date(event.end);
      const durationMin = (end.getTime() - start.getTime()) / 60000;
      bookedMinutes += durationMin;

      if (
        isWithinInterval(start, { start: todayStart, end: todayEnd }) ||
        isWithinInterval(end, { start: todayStart, end: todayEnd }) ||
        (start <= todayStart && end >= todayEnd)
      ) {
        totalToday++;
      }
    }

    const bookedHours = bookedMinutes / 60;
    roomOccupancy[room.id] = Math.min(100, Math.round((bookedHours / totalWorkHours) * 100));
  }

  const conflicts = detectConflicts(rooms);

  return {
    roomOccupancy,
    totalToday,
    conflictCount: conflicts.length,
  };
}

/** Returns events that START on the given day (for absolute-positioned rendering). */
export function getEventsForDay(events: CalendarEvent[], dayDate: Date): CalendarEvent[] {
  const dayStr = format(dayDate, 'yyyy-MM-dd');
  return events.filter((e) => {
    const start = new Date(e.start);
    return format(start, 'yyyy-MM-dd') === dayStr;
  });
}
