import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const caller = verifyToken(req);
  if (!caller) return res.status(403).json({ error: 'גישה נדחתה' });

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const tableId = process.env.AIRTABLE_TABLE_ID;

  if (!token || !baseId || !tableId) {
    return res.status(500).json({ error: 'Airtable not configured' });
  }

  try {
    const formula = encodeURIComponent(`{להעביר לקלוד}=TRUE()`);
    const url = `https://api.airtable.com/v0/${baseId}/${tableId}?filterByFormula=${formula}&pageSize=100`;

    const airtableRes = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!airtableRes.ok) {
      const errText = await airtableRes.text();
      return res.status(airtableRes.status).json({ error: `Airtable error: ${errText}` });
    }

    const data = await airtableRes.json() as { records: Array<{ id: string; createdTime: string; fields: Record<string, unknown> }> };

    const records = (data.records || []).map((r) => {
      const f = r.fields;

      // גיל נוכחי can be a number or {specialValue:"NaN"}
      const rawAge = f['גיל נוכחי'];
      const age = typeof rawAge === 'number' ? rawAge : null;

      // מטפל is sometimes an array of linked record IDs
      const rawTherapist = f['מטפל'];
      const therapist = Array.isArray(rawTherapist) ? '' : ((rawTherapist as string) || '');

      return {
        airtableId: r.id,
        createdTime: r.createdTime,
        name: (f['שם המטופל.ת'] as string) || '',
        age,
        gender: (f['מין'] as string) || '',
        school: (f['שם בית ספר'] as string) || (f['שם בית'] as string) || '',
        grade: (f['כיתה'] as string) || '',
        referralReason: (f['סיבת הפנייה'] as string) || '',
        parent1Name: (f['שם הורה1'] as string) || (f['שם הורה 1'] as string) || '',
        parent1Phone: (f['טלפון הורה 1'] as string) || '',
        parent1WhatsApp: (f['קישור ווטסאפ הורה 1'] as string) || (f['קישור וואטסאפ הורה 1'] as string) || '',
        parent2Name: (f['שם הורה 2'] as string) || '',
        parent2Phone: (f['טלפון הורה 2'] as string) || '',
        parent2WhatsApp: (f['קישור ווטסאפ הורה 2'] as string) || (f['קישור וואטסאפ הורה 2'] as string) || '',
        address: (f['כתובת'] as string) || '',
        intakeSummary: (f['אינטייק סיכום'] as string) || '',
        therapist,
        intakeSentToHaya: !!(f['אינטייק נשלח להייה?'] as boolean),
        individualTherapyStatus: (f['סטטוס טיפול פרטני'] as string) || '',
        referralStatus: (f['סטטוס פניה'] as string) || (f['סטטוס פנייה'] as string) || '',
        groupStatus: (f['סטטוס קבוצה'] as string) || '',
        date: (f['תאריך יצירת רשומה'] as string) || (f['תאריך'] as string) || r.createdTime,
      };
    });

    return res.status(200).json(records);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'שגיאת שרת' });
  }
}
