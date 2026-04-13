import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';

export interface ReferralNote {
  id: string;
  author: string;
  authorName: string;
  content: string;
  timestamp: string;
}

export type ReferralStage = 'new' | 'assigned' | 'intake_scheduled' | 'intake_done' | 'decided';
export type ReferralDecision = 'private' | 'group' | 'no_continue' | null;

export interface ReferralRecord {
  id: string;
  airtableId: string;
  stage: ReferralStage;
  assignedTo: string | null;
  assignedName: string | null;
  notes: ReferralNote[];
  decision: ReferralDecision;
  intakeDate: string | null;
  importedAt: string;
  updatedAt: string;
}

const REDIS_KEY = 'hevrutah:referrals:v1';
const FILE_PATH = join(process.cwd(), 'data', 'referrals.json');

function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis() {
  return new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
}

function loadFromFile(): ReferralRecord[] {
  try {
    if (!existsSync(FILE_PATH)) return [];
    return JSON.parse(readFileSync(FILE_PATH, 'utf-8'));
  } catch { return []; }
}

function saveToFile(records: ReferralRecord[]): void {
  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2));
}

export async function getReferrals(): Promise<ReferralRecord[]> {
  if (!isRedisConfigured()) return loadFromFile();
  try {
    const redis = getRedis();
    const data = await redis.get<ReferralRecord[]>(REDIS_KEY);
    return data ?? [];
  } catch { return loadFromFile(); }
}

export async function saveReferrals(records: ReferralRecord[]): Promise<void> {
  if (!isRedisConfigured()) { saveToFile(records); return; }
  const redis = getRedis();
  await redis.set(REDIS_KEY, records);
}
