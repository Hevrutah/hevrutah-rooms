import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getUsers, saveUsers } from '../lib/users-db.js';
import { sendWelcomeEmail } from '../lib/email.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const caller = verifyToken(req);
  if (!caller) return res.status(403).json({ error: 'גישה נדחתה' });

  const isAdmin = caller.role === 'admin';

  // GET — list users
  if (req.method === 'GET') {
    const users = await getUsers();
    const list = isAdmin ? users : users.filter(u => u.username === caller.username);
    return res.status(200).json(
      list.map(u => ({ id: u.id, name: u.name, username: u.username, email: u.email ?? null, role: u.role, therapistName: u.therapistName ?? null }))
    );
  }

  // POST — create user (admin only)
  if (req.method === 'POST') {
    if (!isAdmin) return res.status(403).json({ error: 'רק מנהל יכול להוסיף משתמשים' });

    const { name, username, password, role, therapistName, email } = req.body || {};
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
      email: email || null,
      passwordHash,
      role: role as 'admin' | 'therapist',
      therapistName: therapistName || null,
    };

    users.push(newUser);
    try {
      await saveUsers(users);
    } catch {
      return res.status(503).json({ error: 'מסד נתונים לא מוגדר' });
    }

    // Send welcome email if address provided
    if (email) {
      sendWelcomeEmail(email, name, username, password).catch(() => {});
    }

    return res.status(201).json({ id: newUser.id, name, username, email: newUser.email, role, therapistName: newUser.therapistName });
  }

  // PATCH — edit user (admin only)
  if (req.method === 'PATCH') {
    if (!isAdmin) return res.status(403).json({ error: 'רק מנהל יכול לערוך משתמשים' });

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'חסר ID' });

    const users = await getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const { name, password, role, email, therapistName } = req.body || {};

    if (name) {
      users[idx].name = name;
      // For therapists, therapistName must match the event name in Google Calendar
      if (users[idx].role === 'therapist') users[idx].therapistName = name;
    }
    if (email !== undefined) users[idx].email = email || null;
    if (therapistName !== undefined) users[idx].therapistName = therapistName || null;
    if (role && ['admin', 'therapist'].includes(role)) {
      users[idx].role = role;
      if (role === 'therapist' && !users[idx].therapistName) {
        users[idx].therapistName = users[idx].name;
      }
      if (role === 'admin') users[idx].therapistName = null;
    }
    if (password) {
      users[idx].passwordHash = await bcrypt.hash(password, 12);
    }

    try {
      await saveUsers(users);
    } catch {
      return res.status(503).json({ error: 'מסד נתונים לא מוגדר' });
    }

    const u = users[idx];
    return res.status(200).json({ id: u.id, name: u.name, username: u.username, email: u.email ?? null, role: u.role, therapistName: u.therapistName ?? null });
  }

  // DELETE — remove user
  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'חסר ID' });

    const users = await getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'משתמש לא נמצא' });

    const targetUser = users[idx];
    if (!isAdmin && targetUser.username !== caller.username) {
      return res.status(403).json({ error: 'מטפל יכול למחוק רק את עצמו' });
    }
    if (isAdmin && targetUser.username === caller.username) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }

    users.splice(idx, 1);
    try {
      await saveUsers(users);
    } catch {
      return res.status(503).json({ error: 'מסד נתונים לא מוגדר' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
