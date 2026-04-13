import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getRoomEvents, saveRoomEvents } from '../lib/rooms-db.js';

function verifyJwt(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try { jwt.verify(auth.slice(7), process.env.JWT_SECRET || 'hevrutah-rooms-secret-2024'); return true; }
  catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!verifyJwt(req)) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.query as { id: string };

  // ── PUT: update event(s) ────────────────────────────────────────
  if (req.method === 'PUT') {
    const { mode, summary, start, end } = req.body || {};
    const events = await getRoomEvents();

    if (mode === 'series') {
      // id = recurringEventId — update all instances, keeping their dates, replacing time
      const newStart = new Date(start);
      const newEnd = new Date(end);
      const startH = newStart.getHours(), startM = newStart.getMinutes();
      const durationMs = newEnd.getTime() - newStart.getTime();

      const updated = events.map(e => {
        if (e.recurringEventId !== id) return e;
        const d = new Date(e.start);
        const s = new Date(d);
        s.setHours(startH, startM, 0, 0);
        const en = new Date(s.getTime() + durationMs);
        return { ...e, summary, start: s.toISOString(), end: en.toISOString() };
      });
      await saveRoomEvents(updated);
    } else {
      // mode = 'single' — id = event ID
      const updated = events.map(e => e.id === id ? { ...e, summary, start, end } : e);
      await saveRoomEvents(updated);
    }

    return res.status(200).json({ ok: true });
  }

  // ── DELETE: remove event(s) ─────────────────────────────────────
  if (req.method === 'DELETE') {
    const { mode, recurringEventId, from } = req.query as {
      mode?: string; recurringEventId?: string; from?: string;
    };
    let events = await getRoomEvents();

    if (mode === 'series') {
      // id = recurringEventId — delete all instances
      events = events.filter(e => e.recurringEventId !== id);
    } else if (mode === 'following' && recurringEventId && from) {
      // id = current event ID; delete all in series from this date forward
      events = events.filter(e =>
        !(e.recurringEventId === recurringEventId && e.start >= from)
      );
    } else {
      // single delete by event ID
      events = events.filter(e => e.id !== id);
    }

    await saveRoomEvents(events);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
