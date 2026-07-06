import type { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { getRoomEvents } from '../lib/rooms-db.js';
import { getMonthlyReports, saveMonthlyReport } from '../lib/reports-db.js';
import type { MonthlyReport, ExternalRenterEntry } from '../lib/reports-db.js';
import { sendTelegramMessage } from '../lib/telegram.js';
import { setCorsHeaders } from '../lib/cors.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET env var is not configured');

function verifyAdmin(req: VercelRequest): boolean {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET!) as { role: string };
    return payload.role === 'admin';
  } catch { return false; }
}

function isCronRequest(req: VercelRequest): boolean {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET>
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const auth = req.headers.authorization;
  return auth === `Bearer ${cronSecret}`;
}

// Hevrutah staff — used to filter out internal bookings
const HEVRUTAH_NAMES = [
  'אלה היימן', 'אלחנן ארזי', 'אמיר גלעד', 'גידי הירש', 'דניאל פישביין',
  'הייה', 'יונתן ליפו', 'יותם קדם', 'יעד מידן', 'יעל גלאון',
  'מיטב ויינשטיין', 'מתנאל ראט', 'נוי גורן', 'נטליה קירסמן',
  'קרן דרטל', 'שקד בן ישיעיהו',
];

function isHevrutahStaff(name: string): boolean {
  const n = name.trim();
  return HEVRUTAH_NAMES.some(h => n === h || n.startsWith(h) || h.startsWith(n));
}

function isInternalEvent(name: string): boolean {
  return name.includes('קבוצה') || name.includes('הלוו') || name.includes('עצרת');
}

function prevMonthRange(): { start: Date; end: Date; label: string; id: string } {
  const now = new Date();
  const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const month = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 1);
  const monthNames = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  return { start, end, label: `${monthNames[month]} ${year}`, id: `${year}-${String(month + 1).padStart(2, '0')}` };
}

async function runMonthlyReport(): Promise<{ report: MonthlyReport; sent: boolean }> {
  const { start, end, label, id } = prevMonthRange();
  const allEvents = await getRoomEvents();

  const monthEvents = allEvents.filter(e => {
    const t = new Date(e.start).getTime();
    return t >= start.getTime() && t < end.getTime();
  });

  const renterMap = new Map<string, typeof monthEvents>();
  for (const ev of monthEvents) {
    const name = ev.summary?.trim() || '';
    if (!name || isHevrutahStaff(name) || isInternalEvent(name)) continue;
    if (!renterMap.has(name)) renterMap.set(name, []);
    renterMap.get(name)!.push(ev);
  }

  const externalRenters: ExternalRenterEntry[] = Array.from(renterMap.entries())
    .map(([name, evs]) => ({
      name,
      eventCount: evs.length,
      totalHours: evs.reduce((s, e) => s + (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000, 0),
      events: evs.map(e => ({ start: e.start, end: e.end, roomName: e.roomName })),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const report: MonthlyReport = {
    id, month: id,
    createdAt: new Date().toISOString(),
    externalRenters,
  };
  await saveMonthlyReport(report);

  const hayahChatId = process.env.HAYAH_TELEGRAM_CHAT_ID;
  let sent = false;
  if (hayahChatId) {
    const lines = externalRenters.length === 0
      ? ['אין שוכרים חיצוניים החודש.']
      : externalRenters.map(r => {
          const h = r.totalHours;
          const hrs = Math.floor(h);
          const mins = Math.round((h - hrs) * 60);
          const timeStr = mins === 0 ? `${hrs}ש'` : `${hrs}ש' ${mins}ד'`;
          return `• ${r.name} — ${r.eventCount} פגישות, ${timeStr}`;
        });

    const text = [
      `📊 <b>דוח שוכרים חיצוניים — ${label}</b>`,
      '',
      ...lines,
      '',
      `<i>סה"כ ${externalRenters.length} שוכרים חיצוניים</i>`,
    ].join('\n');

    await sendTelegramMessage({ chatId: hayahChatId, text });
    sent = true;
  }

  return { report, sent };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — admin fetches stored reports for UI
  if (req.method === 'GET') {
    if (!verifyAdmin(req)) return res.status(403).json({ error: 'Admin only' });
    const reports = await getMonthlyReports();
    return res.status(200).json(reports);
  }

  // POST — Vercel cron or admin manual trigger
  if (req.method === 'POST') {
    if (!isCronRequest(req) && !verifyAdmin(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { report, sent } = await runMonthlyReport();
    return res.status(200).json({
      ok: true,
      month: report.id,
      externalRenters: report.externalRenters.length,
      telegramSent: sent,
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
