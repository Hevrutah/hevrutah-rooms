import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { join } from 'path';

interface User {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'therapist';
  therapistName?: string | null;
}

function loadUsers(): User[] {
  try {
    const filePath = join(process.cwd(), 'data', 'users.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'חסרים שם משתמש או סיסמה' });
  }

  const users = loadUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return res.status(401).json({ error: 'שם משתמש או סיסמה שגויים' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const therapistName = user.therapistName ?? null;

  const token = jwt.sign(
    { userId: user.id, username: user.username, name: user.name, role: user.role, therapistName },
    secret,
    { expiresIn: '7d' }
  );

  return res.status(200).json({
    token,
    user: { username: user.username, name: user.name, role: user.role, therapistName },
  });
}
