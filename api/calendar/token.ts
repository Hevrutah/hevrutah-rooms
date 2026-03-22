import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';

function getRefreshToken(): string | null {
  if (process.env.GOOGLE_REFRESH_TOKEN) return process.env.GOOGLE_REFRESH_TOKEN;
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'data', 'google-token.json'), 'utf-8'));
    return data.refreshToken || null;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(auth.slice(7), process.env.JWT_SECRET!);
  } catch { return res.status(401).json({ error: 'Invalid token' }); }

  const refreshToken = getRefreshToken();
  if (!refreshToken) return res.status(503).json({ error: 'NO_GOOGLE_TOKEN' });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.VITE_GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await r.json();
  if (!r.ok || !data.access_token) {
    return res.status(500).json({ error: 'Failed to refresh token', details: data });
  }

  return res.status(200).json({ accessToken: data.access_token, expiresIn: data.expires_in ?? 3600 });
}
