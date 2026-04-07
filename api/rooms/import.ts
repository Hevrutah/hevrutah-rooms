import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { saveRoomEvents } from '../lib/rooms-db.js';
import type { RoomEvent } from '../lib/rooms-db.js';

function verifyAdmin(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as { role: string };
    return payload.role === 'admin';
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const { events } = req.body || {};
  if (!Array.isArray(events)) return res.status(400).json({ error: 'events must be an array' });

  await saveRoomEvents(events as RoomEvent[]);
  return res.status(200).json({ ok: true, count: events.length });
}
