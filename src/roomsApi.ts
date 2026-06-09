import type { RoomCalendar, Tenant } from './types';
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

// ── Fetch ordered room names from server ─────────────────────────

export async function fetchRoomNames(jwt: string): Promise<string[]> {
  try {
    const res = await apiFetch(jwt, '/api/rooms?_action=rooms');
    const data = await res.json() as { names: string[] };
    return data.names;
  } catch {
    return ROOM_CALENDARS.map(r => r.name);
  }
}

// ── Rename a room (updates all events server-side) ────────────────

export async function renameRoom(jwt: string, oldName: string, newName: string): Promise<void> {
  await apiFetch(jwt, '/api/rooms?_action=rename', {
    method: 'PUT',
    body: JSON.stringify({ oldName, newName }),
  });
}

// ── Fetch events in date range, grouped by room ──────────────────

export async function fetchRoomEvents(
  jwt: string, start: Date, end: Date,
  roomNames?: string[],   // ordered list — controls column order + empty rooms
): Promise<RoomCalendar[]> {
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

  // Group by room — use provided roomNames (or ROOM_CALENDARS) to control order + show empty rooms
  const orderedNames = roomNames ?? ROOM_CALENDARS.map(r => r.name);
  const roomMap = new Map<string, RoomCalendar>();
  for (const name of orderedNames) {
    roomMap.set(name, { id: name, name, events: [] });
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
  recurring: RecurringOptions = null,
  tenantId?: string | null
): Promise<void> {
  await apiFetch(jwt, '/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ summary, start, end, calendarId, roomName: calendarId, recurring, tenantId: tenantId ?? null }),
  });
}

// ── Tenants ────────────────────────────────────────────────────────────────

export async function getTenants(jwt: string): Promise<Tenant[]> {
  const res = await apiFetch(jwt, '/api/rooms?_action=tenants');
  return res.json();
}

// ── Update single event ──────────────────────────────────────────

export async function updateRoomEvent(
  jwt: string,
  eventId: string,
  summary: string,
  start: string,
  end: string,
  newCalendarId?: string,   // pass to move event to a different room
): Promise<void> {
  await apiFetch(jwt, `/api/rooms/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify({ mode: 'single', summary, start, end, ...(newCalendarId ? { calendarId: newCalendarId } : {}) }),
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
