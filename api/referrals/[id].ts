import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getReferrals, saveReferrals } from '../lib/referrals-db.js';
import type { ReferralNote, ReferralStage, ReferralDecision } from '../lib/referrals-db.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const caller = verifyToken(req);
  if (!caller) return res.status(403).json({ error: 'גישה נדחתה' });

  // Support both Express params and Vercel query
  const id = ((req as unknown as { params?: { id?: string } }).params?.id) || (req.query.id as string);
  if (!id) return res.status(400).json({ error: 'חסר ID' });

  const records = await getReferrals();
  const idx = records.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'הפנייה לא נמצאה' });

  // PATCH — update fields
  if (req.method === 'PATCH') {
    const body = req.body || {};
    const { stage, assignedTo, assignedName, decision, intakeDate, note } = body;

    if (stage !== undefined) {
      const validStages: ReferralStage[] = ['new', 'assigned', 'intake_scheduled', 'intake_done', 'decided'];
      if (!validStages.includes(stage)) return res.status(400).json({ error: 'שלב לא חוקי' });
      records[idx].stage = stage;
    }

    if (assignedTo !== undefined) records[idx].assignedTo = assignedTo;
    if (assignedName !== undefined) records[idx].assignedName = assignedName;

    if (decision !== undefined) {
      const validDecisions: Array<ReferralDecision> = ['private', 'group', 'no_continue', null];
      if (!validDecisions.includes(decision)) return res.status(400).json({ error: 'החלטה לא חוקית' });
      records[idx].decision = decision;
    }

    if (intakeDate !== undefined) records[idx].intakeDate = intakeDate;

    if (note) {
      const newNote: ReferralNote = {
        id: Date.now().toString(),
        author: caller.username,
        authorName: caller.name,
        content: note,
        timestamp: new Date().toISOString(),
      };
      records[idx].notes = [...records[idx].notes, newNote];
    }

    records[idx].updatedAt = new Date().toISOString();
    await saveReferrals(records);

    return res.status(200).json(records[idx]);
  }

  // DELETE — remove referral
  if (req.method === 'DELETE') {
    records.splice(idx, 1);
    await saveReferrals(records);
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
