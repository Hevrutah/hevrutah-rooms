import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { getUsers, saveUsers } from '../lib/users-db.js';
import { sendPasswordEmail } from '../lib/email.js';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username } = req.body || {};
  if (!username) return res.status(400).json({ error: 'חסר שם משתמש' });

  const users = await getUsers();
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());

  // Always respond with success to prevent username enumeration
  if (idx === -1 || !users[idx].email) {
    return res.status(200).json({ message: 'אם קיים מייל לחשבון זה, הסיסמה תישלח אליו' });
  }

  const newPassword = generatePassword();
  users[idx].passwordHash = await bcrypt.hash(newPassword, 12);

  try {
    await saveUsers(users);
  } catch {
    return res.status(503).json({ error: 'שגיאה בשמירה' });
  }

  try {
    await sendPasswordEmail(users[idx].email!, users[idx].name, newPassword);
  } catch {
    return res.status(500).json({ error: 'שגיאה בשליחת המייל' });
  }

  return res.status(200).json({ message: 'אם קיים מייל לחשבון זה, הסיסמה תישלח אליו' });
}
