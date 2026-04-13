/**
 * SSO token exchange: accepts a portal JWT (decoded without signature verification),
 * issues a fresh rooms JWT signed with the rooms JWT_SECRET.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  // Decode without verifying — we trust that the portal issued a valid token.
  // We still check expiry so stale tokens don't grant access.
  let payload: { username?: string; name?: string; role?: string; therapistName?: string | null; exp?: number } | null = null;
  try {
    payload = jwt.decode(token) as typeof payload;
  } catch {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  if (!payload?.username || !payload?.role) {
    return res.status(401).json({ error: 'Invalid token payload' });
  }

  // Check expiry
  if (payload.exp && Date.now() / 1000 > payload.exp) {
    return res.status(401).json({ error: 'Token expired' });
  }

  const secret = process.env.JWT_SECRET || 'hevrutah-rooms-secret-2024';

  const roomsToken = jwt.sign(
    {
      username: payload.username,
      name: payload.name ?? payload.username,
      role: payload.role,
      therapistName: payload.therapistName ?? null,
    },
    secret,
    { expiresIn: '7d' }
  );

  return res.status(200).json({ token: roomsToken });
}
