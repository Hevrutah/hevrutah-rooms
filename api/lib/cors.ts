import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLOWED = [
  'https://hevrutah-portal.vercel.app',
  'https://hevrutah-referrals.vercel.app',
  'https://hevrutah-rooms.vercel.app',
];

export function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin;
  if (origin && ALLOWED.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}
