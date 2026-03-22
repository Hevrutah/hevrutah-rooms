import type { CalendarEvent, RoomCalendar } from './types';
import { ROOM_CALENDARS } from './constants';

const BASE_URL = 'https://www.googleapis.com/calendar/v3';


async function fetchCalendarList(accessToken: string): Promise<{ id: string; summary: string }[]> {
  const res = await fetch(`${BASE_URL}/users/me/calendarList?maxResults=250`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Calendar list fetch failed: ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

async function fetchEventsForCalendar(
  accessToken: string,
  calendarId: string,
  roomName: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '2500',
  });

  const res = await fetch(`${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    console.error(`Failed to fetch events for ${roomName}: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items = data.items || [];

  return items
    .filter((item: any) => item.status !== 'cancelled' && (item.start?.dateTime || item.start?.date))
    .map((item: any): CalendarEvent => ({
      id: item.id,
      summary: item.summary || '(ללא שם)',
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      calendarId,
      roomName,
      isRecurring: !!item.recurringEventId,
      recurringEventId: item.recurringEventId,
      creatorEmail: item.creator?.email,
    }));
}

export type RecurringOptions = {
  freq: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  until?: string; // YYYY-MM-DD
} | null;

function buildRRule(options: RecurringOptions): string | null {
  if (!options) return null;
  let rule = 'RRULE:FREQ=';
  if (options.freq === 'BIWEEKLY') {
    rule += 'WEEKLY;INTERVAL=2';
  } else {
    rule += options.freq;
  }
  if (options.until) {
    const untilStr = options.until.replace(/-/g, '') + 'T235959Z';
    rule += `;UNTIL=${untilStr}`;
  }
  return rule;
}

export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  summary: string,
  startDateTime: string,
  endDateTime: string,
  recurringOptions: RecurringOptions = null
): Promise<void> {
  const body: Record<string, unknown> = {
    summary,
    start: { dateTime: startDateTime, timeZone: 'Asia/Jerusalem' },
    end: { dateTime: endDateTime, timeZone: 'Asia/Jerusalem' },
  };
  const rrule = buildRRule(recurringOptions);
  if (rrule) {
    body.recurrence = [rrule];
  }
  const res = await fetch(`${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `שגיאה ביצירת אירוע: ${res.status}`);
  }
}

export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  summary: string,
  startDateTime: string,
  endDateTime: string
): Promise<void> {
  const body = {
    summary,
    start: { dateTime: startDateTime, timeZone: 'Asia/Jerusalem' },
    end: { dateTime: endDateTime, timeZone: 'Asia/Jerusalem' },
  };
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `שגיאה בעדכון אירוע: ${res.status}`);
  }
}

export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const res = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 204) {
    throw new Error(`שגיאה במחיקת אירוע: ${res.status}`);
  }
}

export async function deleteCalendarEventSeries(
  accessToken: string,
  calendarId: string,
  recurringEventId: string
): Promise<void> {
  await deleteCalendarEvent(accessToken, calendarId, recurringEventId);
}

export async function deleteCalendarEventAndFollowing(
  accessToken: string,
  calendarId: string,
  eventId: string,
  recurringEventId: string,
  eventStartISO: string
): Promise<void> {
  // Fetch master event to get current RRULE
  const masterRes = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(recurringEventId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!masterRes.ok) throw new Error(`שגיאה בטעינת אירוע: ${masterRes.status}`);
  const master = await masterRes.json();

  // Set UNTIL to day before this event
  const eventStart = new Date(eventStartISO);
  const until = new Date(eventStart);
  until.setDate(until.getDate() - 1);
  const untilStr = until.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const recurrence: string[] = master.recurrence || ['RRULE:FREQ=WEEKLY'];
  const updatedRecurrence = recurrence.map((rule: string) => {
    if (rule.startsWith('RRULE:')) {
      return rule.replace(/;UNTIL=[^;]+/, '').replace(/;COUNT=\d+/, '') + `;UNTIL=${untilStr}`;
    }
    return rule;
  });

  // PATCH master event with new UNTIL
  const patchRes = await fetch(
    `${BASE_URL}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(recurringEventId)}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ recurrence: updatedRecurrence }),
    }
  );
  if (!patchRes.ok) {
    const err = await patchRes.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message || `שגיאה בעדכון סדרה: ${patchRes.status}`);
  }

  // Delete current instance (may exist as an exception)
  await deleteCalendarEvent(accessToken, calendarId, eventId);
}

export async function fetchAllRoomEvents(
  accessToken: string,
  weekStart: Date,
  weekEnd: Date
): Promise<RoomCalendar[]> {
  const timeMin = weekStart.toISOString();
  const timeMax = weekEnd.toISOString();

  // First resolve calendar IDs from names
  const allCalendars = await fetchCalendarList(accessToken);

  const resolvedRooms = ROOM_CALENDARS.map((room) => {
    const found = allCalendars.find(
      (c) => c.summary?.trim() === room.name.trim()
    );
    return {
      name: room.name,
      id: found?.id || '',
    };
  });

  const results = await Promise.all(
    resolvedRooms.map(async (room) => {
      if (!room.id) {
        console.warn(`Calendar not found for room: ${room.name}`);
        return { id: room.name, name: room.name, events: [] };
      }
      const events = await fetchEventsForCalendar(
        accessToken,
        room.id,
        room.name,
        timeMin,
        timeMax
      );
      return { id: room.id, name: room.name, events };
    })
  );

  return results;
}
