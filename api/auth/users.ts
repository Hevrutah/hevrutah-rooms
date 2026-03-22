import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface User {
  id: string;
  name: string;
  username: string;
  passwordHash: string;
  role: 'admin' | 'therapist';
  therapistName?: string | null;
}

interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  role: 'admin' | 'therapist';
}

function loadUsers(): User[] {
  try {
    const filePath = join(process.cwd(), 'data', 'users.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function saveUsers(users: User[]): void {
  const filePath = join(process.cwd(), 'data', 'users.json');
  writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
}

function verifyAdmin(req: VercelRequest): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    return payload.role === 'admin' ? payload : null;
  } catch {
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const admin = verifyAdmin(req);
  if (!admin) return res.status(403).json({ error: 'גישה נדחתה' });

  if (req.method === 'GET') {
    const users = loadUsers();
    return res.status(200).json(
      users.map(u => ({ id: u.id, name: u.name, username: u.username, role: u.role, therapistName: u.therapistName ?? null }))
    );
  }

  if (req.method === 'POST') {
    const { name, username, password, role, therapistName } = req.body || {};
    if (!name || !username || !password || !role) {
      return res.status(400).json({ error: 'כל השדות נדרשים' });
    }
    if (!['admin', 'therapist'].includes(role)) {
      return res.status(400).json({ error: 'תפקיד לא חוקי' });
    }

    const users = loadUsers();
    if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
      return res.status(400).json({ error: 'שם משתמש כבר קיים' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser: User = {
      id: Date.now().toString(),
      name,
      username,
      passwordHash,
      role,
      therapistName: therapistName || null,
    };

    users.push(newUser);
    try {
      saveUsers(users);
    } catch {
      // On Vercel, filesystem writes don't persist — return the user data for manual addition
      return res.status(202).json({
        message: 'MANUAL_SAVE_REQUIRED',
        user: { id: newUser.id, name, username, passwordHash, role, therapistName: newUser.therapistName },
      });
    }

    return res.status(201).json({ id: newUser.id, name, username, role, therapistName: newUser.therapistName });
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'חסר ID' });

    const users = loadUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return res.status(404).json({ error: 'משתמש לא נמצא' });
    if (users[idx].username === admin.username) {
      return res.status(400).json({ error: 'לא ניתן למחוק את עצמך' });
    }

    users.splice(idx, 1);
    try {
      saveUsers(users);
    } catch {
      return res.status(202).json({ message: 'MANUAL_SAVE_REQUIRED' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
