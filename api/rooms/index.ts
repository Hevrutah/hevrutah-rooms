import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getRoomEvents, saveRoomEvents, type RoomEvent } from '../lib/rooms-db';

function verifyJwt(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET!); return true; }
  catch { return false; }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function expandRecurring(
  summary: string,
  startISO: string,
  endISO: string,
  calendarId: string,
  roomName: string,
  freq: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY',
  until: string  // YYYY-MM-DD
): RoomEvent[] {
  const events: RoomEvent[] = [];
  const recurringEventId = generateId();
  const start = new Date(startISO);
  const end = new Date(endISO);
  const durationMs = end.getTime() - start.getTime();
  const untilDate = new Date(until + 'T23:59:59');

  let current = new Date(start);
  while (current <= untilDate) {
    const eventEnd = new Date(current.getTime() + durationMs);
    events.push({
      id: generateId(),
      summary,
      start: current.toISOString(),
      end: eventEnd.toISOString(),
      calendarId,
      roomName: roomName || calendarId,
      isRecurring: true,
      recurringEventId,
    });
    const next = new Date(current);
    if (freq === 'WEEKLY')       next.setDate(next.getDate() + 7);
    else if (freq === 'BIWEEKLY') next.setDate(next.getDate() + 14);
    else                          next.setMonth(next.getMonth() + 1);
    current = next;
  }
  return events;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyJwt(req)) return res.status(401).json({ error: 'Unauthorized' });

  if (req.method === 'GET') {
    try {
      const { timeMin, timeMax } = req.query as { timeMin?: string; timeMax?: string };
      let events = await getRoomEvents();
      if (timeMin) events = events.filter(e => e.end > timeMin);
      if (timeMax) events = events.filter(e => e.start < timeMax);
      return res.status(200).json(events);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return res.status(500).json({ error: msg });
    }
  }

  if (req.method === 'POST') {
    const { summary, start, end, calendarId, roomName, recurring } = req.body || {};
    if (!summary || !start || !end || !calendarId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const events = await getRoomEvents();

    if (recurring?.freq) {
      const until = recurring.until || (() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        return d.toISOString().slice(0, 10);
      })();
      events.push(...expandRecurring(summary, start, end, calendarId, roomName || calendarId, recurring.freq, until));
    } else {
      events.push({
        id: generateId(),
        summary,
        start,
        end,
        calendarId,
        roomName: roomName || calendarId,
        isRecurring: false,
      });
    }

    await saveRoomEvents(events);
    return res.status(201).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
