import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';

export interface RoomEvent {
  id: string;
  summary: string;
  start: string;   // ISO datetime
  end: string;     // ISO datetime
  calendarId: string;
  roomName: string;
  isRecurring: boolean;
  recurringEventId?: string | null;
  creatorEmail?: string | null;
  tenantId?: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

const TENANTS_KEY = 'hevrutah:tenants:v1';
const TENANTS_FILE = join(process.cwd(), 'data', 'tenants.json');

function loadTenantsFromFile(): Tenant[] {
  try {
    if (!existsSync(TENANTS_FILE)) return [];
    return JSON.parse(readFileSync(TENANTS_FILE, 'utf-8'));
  } catch { return []; }
}

export async function getTenants(): Promise<Tenant[]> {
  if (!isRedisConfigured()) return loadTenantsFromFile();
  try {
    return (await getRedis().get<Tenant[]>(TENANTS_KEY)) ?? [];
  } catch { return loadTenantsFromFile(); }
}

export async function saveTenants(tenants: Tenant[]): Promise<void> {
  if (!isRedisConfigured()) {
    writeFileSync(TENANTS_FILE, JSON.stringify(tenants, null, 2));
    return;
  }
  await getRedis().set(TENANTS_KEY, tenants);
}

const REDIS_KEY = 'hevrutah:rooms:v1';
const FILE_PATH = join(process.cwd(), 'data', 'rooms.json');

function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis() {
  return new Redis({ url: process.env.KV_REST_API_URL!, token: process.env.KV_REST_API_TOKEN! });
}

function loadFromFile(): RoomEvent[] {
  try {
    if (!existsSync(FILE_PATH)) return [];
    return JSON.parse(readFileSync(FILE_PATH, 'utf-8'));
  } catch { return []; }
}

function saveToFile(events: RoomEvent[]): void {
  const dir = join(process.cwd(), 'data');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(FILE_PATH, JSON.stringify(events, null, 2));
}

export async function getRoomEvents(): Promise<RoomEvent[]> {
  if (!isRedisConfigured()) return loadFromFile();
  try {
    const redis = getRedis();
    const data = await redis.get<RoomEvent[]>(REDIS_KEY);
    return data ?? [];
  } catch { return loadFromFile(); }
}

export async function saveRoomEvents(events: RoomEvent[]): Promise<void> {
  if (!isRedisConfigured()) { saveToFile(events); return; }
  const redis = getRedis();
  await redis.set(REDIS_KEY, events);
}
