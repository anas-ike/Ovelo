import { Redis } from 'ioredis';
import { env } from './env.js';
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  lazyConnect: true,
  enableOfflineQueue: false,
});
redis.on('error', () => undefined);
export const queueConnection = {
  host: new URL(env.REDIS_URL).hostname,
  port: Number(new URL(env.REDIS_URL).port || 6379),
  password: new URL(env.REDIS_URL).password || undefined,
  username: new URL(env.REDIS_URL).username || undefined,
  db: Number(new URL(env.REDIS_URL).pathname.slice(1) || 0),
  ...(env.REDIS_URL.startsWith('rediss:') ? { tls: {} } : {}),
};
export async function ensureRedis() {
  if (redis.status === 'wait') await redis.connect();
  if (redis.status !== 'ready') throw new Error('Redis unavailable');
  return redis;
}
