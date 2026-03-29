import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUsers, saveUsers } from '../lib/users-db.js';

interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  role: 'admin' | 'therapist';
}

function verifyToken(req: VercelRequest): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as JwtPayload;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const caller = verifyToken(req);
  if (!caller) return res.status(403).json({ error: 'גישה נדחתה' });

  const isAdmin = caller.role === 'admin';

  if (req.method === 'GET') {
    const users = await getUsers();
    const list = isAdmin
      ? users
      : users.filter(u => u.username === caller.username);
    return res.status(200).json(
      list.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, therapistName: u.therapistName ?? null }))
    );
  }

  if (req.method === 'POST') {
    // Only admins can create users
    if (!isAdmin) return res.status(403).json({ error: 'רק מנהל יכול להוסיף משתמשים' });

    const { name, username, password, role, therapistName } = req.body || {};
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'כל השדות נדרשים' });
    }
    if (!['admin', 'therapist'].includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא חוקי' });
    }

    const users = await getUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'שם משתמש כבר קיים' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: Date.now().toString(),
      name,
      username,
      passwordHash,
      role: role as 'admin' | 'therapist',
      therapistName: therapistName || null,
    };

    users.push(newUser);
    try {
      await saveUsers(users);
    } catch {
      return res.status(503).json({ error: 'מסד נתונים לא מוגדר. נא להגדיר Upstash Redis.' });
    }

    return res.status(201).json({ id: newUser.id, name, username, role, therapistName: newUser.therapistName });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'חסר ID' });

    const users = await getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const targetUser = users[idx];

    // Therapists can only delete themselves
    if (!isAdmin && targetUser.username !== caller.username) {
      return res.status(403).json({ error: 'מטפל יכול למחוק רק את עצמו' });
    }

    // Nobody can delete their own account while logged in as admin (prevent lockout)
    if (isAdmin && targetUser.username === caller.username) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }

    users.splice(idx, 1);
    try {
      await saveUsers(users);
    } catch {
      return res.status(503).json({ error: 'מסד נתונים לא מוגדר. נא להגדיר Upstash Redis.' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
