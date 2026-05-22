import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { saveRoomEvents } from '../lib/rooms-db.js';
import type { RoomEvent } from '../lib/rooms-db.js';
import { setCorsHeaders } from '../lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not configured');

function verifyAdmin(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { role: string };
    return payload.role === 'admin';
  } catch { return false; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Admin only' });

  const { events } = req.body || {};
  if (!Array.isArray(events)) return res.status(400).json({ error: 'events must be an array' });

  await saveRoomEvents(events as RoomEvent[]);
  return res.status(200).json({ ok: true, count: events.length });
}
