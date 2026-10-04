import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { redisOptions, redisFailure } from '@ovelo/shared/redis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export const queueConnection = redisOptions(env.REDIS_URL);
export const redis = new Redis({ ...queueConnection, maxRetriesPerRequest: 1, commandTimeout: 5000, lazyConnect: true, enableOfflineQueue: false });
let lastFailure: string | undefined;
redis.on('error', (error) => {
  const code = redisFailure(error);
  if (code !== lastFailure) logger.error({ subsystem: 'security-redis', code }, 'Redis connection failed; check REDIS_URL, credentials, TLS and ACL permissions');
  lastFailure = code;
});
redis.on('ready', () => { if (lastFailure) logger.info({ subsystem: 'security-redis' }, 'Redis connection restored'); lastFailure = undefined; });

let connecting: Promise<Redis> | undefined;
export function ensureRedis(): Promise<Redis> {
  if (redis.status === 'ready') return Promise.resolve(redis);
  // All simultaneous requests wait for the same ready event, including reconnects.
  if (connecting) return connecting;
  connecting = new Promise<Redis>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => done(new Error('Redis readiness timeout')), 5000);
    const ready = () => done();
    const failed = (error: Error) => {
      const code = redisFailure(error);
      // Transient transport errors can recover before the shared deadline.
      if (['REDIS_AUTH_FAILED', 'REDIS_ACL_DENIED', 'REDIS_TLS_FAILED'].includes(code)) done(new Error(code));
    };
    const ended = () => done(new Error('Redis connection ended'));
    function done(error?: Error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer); redis.off('ready', ready); redis.off('error', failed); redis.off('end', ended);
      if (error) reject(error); else resolve(redis);
    }
    redis.once('ready', ready); redis.on('error', failed); redis.once('end', ended);
    if (redis.status === 'wait' || redis.status === 'end') void redis.connect().catch(failed);
  }).finally(() => { connecting = undefined; });
  return connecting;
}

export const CONSUME_ONCE = "local value=redis.call('GET',KEYS[1]); if value then redis.call('DEL',KEYS[1]) end; return value";
export async function consumeOnce(key: string) { return (await ensureRedis()).eval(CONSUME_ONCE, 1, key) as Promise<string | null>; }

export async function verifySecurityRedis() {
  const client = await ensureRedis();
  await client.ping();
  const key = `ovelo:diagnostic:${randomUUID()}`;
  await client.set(key, '0', 'EX', 10);
  if (await client.get(key) !== '0') throw new Error('Redis read verification failed');
  await client.eval("redis.call('INCR',KEYS[1]); redis.call('PEXPIRE',KEYS[1],10000); return redis.call('PTTL',KEYS[1])", 1, key);
  if (await consumeOnce(key) !== '1') throw new Error('Redis state verification failed');
  await client.del(key);
}

export async function closeSecurityRedis() {
  if (redis.status === 'ready') await redis.quit().catch(() => redis.disconnect());
  else redis.disconnect();
}
