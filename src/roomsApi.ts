import type { RoomCalendar } from './types';
import { ROOM_CALENDARS } from './constants';

export type RecurringOptions = {
  freq: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  until?: string; // YYYY-MM-DD
} | null;

async function apiFetch(jwt: string, path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `שגיאה: ${res.status}`);
  }
  return res;
}

// ── Fetch events in date range, grouped by room ──────────────────

export async function fetchRoomEvents(jwt: string, start: Date, end: Date): Promise<RoomCalendar[]> {
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  });
  const res = await apiFetch(jwt, `/api/rooms?${params}`);
  const events = await res.json() as Array<{
    id: string; summary: string; start: string; end: string;
    calendarId: string; roomName: string;
    isRecurring: boolean; recurringEventId?: string | null; creatorEmail?: string | null;
  }>;

  // Group by room, preserving order from ROOM_CALENDARS
  const roomMap = new Map<string, RoomCalendar>();
  for (const r of ROOM_CALENDARS) {
    roomMap.set(r.name, { id: r.name, name: r.name, events: [] });
  }
  for (const event of events) {
    if (!roomMap.has(event.roomName)) {
      roomMap.set(event.roomName, { id: event.roomName, name: event.roomName, events: [] });
    }
    roomMap.get(event.roomName)!.events.push({
      ...event,
      recurringEventId: event.recurringEventId ?? undefined,
      creatorEmail: event.creatorEmail ?? undefined,
    });
  }
  return Array.from(roomMap.values());
}

// ── Create event (with optional recurring expansion on server) ───

export async function createRoomEvent(
  jwt: string,
  calendarId: string,
  summary: string,
  start: string,
  end: string,
  recurring: RecurringOptions = null
): Promise<void> {
  await apiFetch(jwt, '/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ summary, start, end, calendarId, roomName: calendarId, recurring }),
  });
}

// ── Update single event ──────────────────────────────────────────

export async function updateRoomEvent(
  jwt: string,
  eventId: string,
  summary: string,
  start: string,
  end: string
): Promise<void> {
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify({ mode: 'single', summary, start, end }),
  });
}

// ── Update entire series (id = recurringEventId) ─────────────────
// Keeps each instance's date; replaces time-of-day from startTime/endTime (HH:MM)

export async function updateRoomEventSeries(
  jwt: string,
  recurringEventId: string,
  summary: string,
  startTime: string, // HH:MM
  endTime: string    // HH:MM
): Promise<void> {
  // Build ISO strings using today's date just to carry HH:MM through to the server
  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(`${today}T${startTime}`).toISOString();
  const end   = new Date(`${today}T${endTime}`).toISOString();
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(recurringEventId)}`, {
    method: 'PUT',
    body: JSON.stringify({ mode: 'series', summary, start, end }),
  });
}

// ── Delete single event ──────────────────────────────────────────

export async function deleteRoomEvent(jwt: string, eventId: string): Promise<void> {
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(eventId)}?mode=single`, { method: 'DELETE' });
}

// ── Delete entire series (id = recurringEventId) ─────────────────

export async function deleteRoomEventSeries(jwt: string, recurringEventId: string): Promise<void> {
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(recurringEventId)}?mode=series`, { method: 'DELETE' });
}

// ── Delete this event and all following ──────────────────────────

export async function deleteRoomEventAndFollowing(
  jwt: string,
  eventId: string,
  recurringEventId: string,
  from: string // ISO start of the current event
): Promise<void> {
  const qs = new URLSearchParams({
    mode: 'following',
    recurringEventId,
    from,
  });
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(eventId)}?${qs}`, { method: 'DELETE' });
}

// ── One-time import from Google Calendar ─────────────────────────

export async function importFromGoogle(jwt: string, events: unknown[]): Promise<number> {
  const res = await apiFetch(jwt, '/api/rooms/import', {
    method: 'POST',
    body: JSON.stringify({ events }),
  });
  const data = await res.json() as { count: number };
  return data.count;
}
