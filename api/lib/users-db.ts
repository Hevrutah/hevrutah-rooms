import { readFileSync } from 'fs';
import { join } from 'path';
import { Redis } from '@upstash/redis';

export interface User {
  id: string;
  name: string;
  username: string;
  email?: string | null;
  passwordHash: string;
  role: 'admin' | 'hevrutah' | 'external';
  therapistName?: string | null;
}

const REDIS_KEY = 'hevrutah:users:v2';

function isRedisConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

function loadFromFile(): User[] {
  try {
    const filePath = join(process.cwd(), 'data', 'users.json');
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

export async function getUsers(): Promise<User[]> {
  if (!isRedisConfigured()) return loadFromFile();
  try {
    const redis = await getRedis();
    const data = await redis.get<User[]>(REDIS_KEY);
    if (data && data.length > 0) return data;
    // First time: seed from JSON file
    const fileUsers = loadFromFile();
    if (fileUsers.length > 0) {
      await redis.set(REDIS_KEY, fileUsers);
    }
    return fileUsers;
  } catch {
    return loadFromFile();
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  if (!isRedisConfigured()) {
    throw new Error('Redis not configured — cannot persist users on Vercel without Upstash');
  }
  const redis = await getRedis();
  await redis.set(REDIS_KEY, users);
}
