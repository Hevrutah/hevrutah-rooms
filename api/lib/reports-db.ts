import { Redis } from '@upstash/redis';

export interface ExternalRenterEntry {
  name: string;
  eventCount: number;
  totalHours: number;
  events: Array<{ start: string; end: string; roomName: string }>;
}

export interface MonthlyReport {
  id: string;         // YYYY-MM
  month: string;      // YYYY-MM
  createdAt: string;  // ISO
  externalRenters: ExternalRenterEntry[];
}

const REPORTS_KEY = 'hevrutah:rooms:reports:v1';

function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis() {
  return new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
}

export async function getMonthlyReports(): Promise<MonthlyReport[]> {
  if (!isRedisConfigured()) return [];
  try {
    return (await getRedis().get<MonthlyReport[]>(REPORTS_KEY)) ?? [];
  } catch { return []; }
}

export async function saveMonthlyReport(report: MonthlyReport): Promise<void> {
  if (!isRedisConfigured()) return;
  const redis = getRedis();
  const existing = (await redis.get<MonthlyReport[]>(REPORTS_KEY)) ?? [];
  const updated = [report, ...existing.filter(r => r.id !== report.id)];
  await redis.set(REPORTS_KEY, updated);
}
