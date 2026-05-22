import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Redis } from '@upstash/redis';
import { getUsers } from '../lib/users-db.js';
import { setCorsHeaders } from '../lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not configured');

// Rate limit: 5 failed attempts → 15 min lockout per username
const RL_MAX_ATTEMPTS = 5;
const RL_WINDOW_SECONDS = 15 * 60;

function getRedis(): Redis | null {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  return new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}
async function checkRateLimit(key: string): Promise<{ blocked: boolean; remainingSeconds: number }> {
  const redis = getRedis();
  if (!redis) return { blocked: false, remainingSeconds: 0 };
  const count = (await redis.get<number>(key)) || 0;
  if (count >= RL_MAX_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    return { blocked: true, remainingSeconds: ttl > 0 ? ttl : RL_WINDOW_SECONDS };
  }
  return { blocked: false, remainingSeconds: 0 };
}
async function recordFailedAttempt(key: string): Promise<void> {
  const redis = getRedis(); if (!redis) return;
  const count = ((await redis.get<number>(key)) || 0) + 1;
  await redis.set(key, count, { ex: RL_WINDOW_SECONDS });
}
async function clearRateLimit(key: string): Promise<void> {
  const redis = getRedis(); if (!redis) return;
  await redis.del(key);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'חסרים שם משתמש או סיסמה' });
  }

  const rlKey = `hevrutah:rl:login-rooms:${(username as string).toLowerCase()}`;
  const rl = await checkRateLimit(rlKey);
  if (rl.blocked) {
    const mins = Math.ceil(rl.remainingSeconds / 60);
    return res.status(429).json({ error: `יותר מדי ניסיונות כניסה. נסה/י שוב בעוד ${mins} דקות.` });
  }

  const users = await getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    await recordFailedAttempt(rlKey);
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    await recordFailedAttempt(rlKey);
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  await clearRateLimit(rlKey);

  const secret = JWT_SECRET;

  const therapistName = user.therapistName ?? null;
  const airtableAccess = user.airtableAccess ?? false;

  const token = jwt.sign(
    { userId: user.id, username: user.username, name: user.name, role: user.role, therapistName, airtableAccess },
    secret,
    { expiresIn: '7d' }
  );

  return res.status(200).json({
    token,
    user: { username: user.username, name: user.name, role: user.role, therapistName, airtableAccess },
  });
}
