import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { writeFileSync } from 'fs';
import { join } from 'path';
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

  const { code, redirectUri } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code' });

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri || '',
    }),
  });

  const data = await r.json();
  if (!r.ok) {
    return res.status(500).json({ error: 'Failed to exchange code', details: data });
  }

  if (!data.refresh_token) {
    // No refresh token — user must revoke app access in Google and try again
    return res.status(400).json({ error: 'NO_REFRESH_TOKEN', accessToken: data.access_token });
  }

  // Save refresh token (local dev: file, Vercel prod: manual env var setup)
  try {
    writeFileSync(
      join(process.cwd(), 'data', 'google-token.json'),
      JSON.stringify({ refreshToken: data.refresh_token }, null, 2)
    );
    return res.status(200).json({ success: true, accessToken: data.access_token });
  } catch {
    // Vercel production — can't write files, return token for manual setup
    return res.status(202).json({
      message: 'MANUAL_SAVE_REQUIRED',
      refreshToken: data.refresh_token,
      accessToken: data.access_token,
    });
  }
}
