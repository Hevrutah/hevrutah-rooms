import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getReferrals, saveReferrals } from '../lib/referrals-db.js';
import type { ReferralRecord } from '../lib/referrals-db.js';

interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  role: string;
}

function verifyToken(req: VercelRequest): JwtPayload | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const secret = process.env.JWT_SECRET || 'hevrutah-local-dev-secret-change-in-production';
    return jwt.verify(auth.slice(7), secret) as JwtPayload;
  } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const caller = verifyToken(req);
  if (!caller) return res.status(403).json({ error: 'גישה נדחתה' });

  // GET — return all referral pipeline records
  if (req.method === 'GET') {
    const records = await getReferrals();
    return res.status(200).json(records);
  }

  // POST — create new referral record
  if (req.method === 'POST') {
    const { airtableId } = req.body || {};
    if (!airtableId) return res.status(400).json({ error: 'חסר airtableId' });

    const records = await getReferrals();

    // Check if already imported
    if (records.find(r => r.airtableId === airtableId)) {
      return res.status(409).json({ error: 'הפנייה כבר יובאה' });
    }

    const now = new Date().toISOString();
    const newRecord: ReferralRecord = {
      id: Date.now().toString(),
      airtableId,
      stage: 'new',
      assignedTo: null,
      assignedName: null,
      notes: [],
      decision: null,
      intakeDate: null,
      importedAt: now,
      updatedAt: now,
    };

    records.push(newRecord);
    await saveReferrals(records);

    return res.status(201).json(newRecord);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
