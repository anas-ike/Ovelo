import { afterAll, describe, expect, it, vi } from 'vitest';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';
import { redisOptions, redisFailure } from '@ovelo/shared/redis';
import { closeSecurityRedis, ensureRedis, consumeOnce, redis, verifySecurityRedis } from '../src/config/redis.js';
import { once } from 'node:events';

describe('Redis configuration and safe diagnostics', () => {
  it('decodes credentials and preserves external endpoint, database and verified TLS', () => {
    const options = redisOptions('rediss://member%40ovelo:p%40ss%3Aword@cache.example.com:6380/4');
    expect(options).toMatchObject({ host: 'cache.example.com', port:6380, db:4, username:'member@ovelo', password:'p@ss:word', tls:{rejectUnauthorized:true,servername:'cache.example.com'} });
  });
  it('rejects invalid configuration without repeating the URL', () => {
    expect(()=>redisOptions('https://user:secret@host')).toThrow('REDIS_URL must be');
    expect(()=>redisOptions('redis://host/not-a-db')).toThrow();
    expect(redisFailure(new Error('WRONGPASS username secret'))).toBe('REDIS_AUTH_FAILED');
    expect(redisFailure(new Error('NOPERM EVAL secret'))).toBe('REDIS_ACL_DENIED');
  });
});

describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('security Redis integration', () => {
  afterAll(closeSecurityRedis);
  it('reproduces the old lazy-connect race and waits for readiness for concurrent requests', async () => {
    const old = new Redis({ ...redisOptions(process.env.REDIS_URL!), lazyConnect:true, enableOfflineQueue:false });
    old.on('error',()=>undefined);
    const oldEnsure = async () => { if(old.status==='wait') await old.connect(); if(old.status!=='ready') throw new Error('Redis unavailable'); return old; };
    const results = await Promise.allSettled([oldEnsure(), oldEnsure(), oldEnsure()]);
    expect(results.some((result)=>result.status==='rejected')).toBe(true); old.disconnect();
    const first = ensureRedis();
    expect(ensureRedis()).toBe(first);
    const clients = await Promise.all(Array.from({ length:20 },()=>ensureRedis()));
    expect(clients.every(client=>client===redis && client.status==='ready')).toBe(true);
    await verifySecurityRedis();
  });
  it('consumes state atomically once without depending on GETDEL availability', async () => {
    const key = `ovelo:test:${randomUUID()}`; await (await ensureRedis()).set(key,'one-time-state','EX',10);
    const results = await Promise.all([consumeOnce(key),consumeOnce(key)]);
    expect(results.sort()).toEqual(['one-time-state',null].sort());
  });
  it('shares bounded readiness during a real reconnect', async () => {
    await ensureRedis();
    const reconnecting = once(redis, 'reconnecting');
    redis.disconnect(true);
    await reconnecting;
    const first = ensureRedis();
    expect(ensureRedis()).toBe(first);
    expect(await first).toBe(redis);
    expect(await redis.ping()).toBe('PONG');
  });
  it('bounds a stalled readiness operation and cleans up all waiter listeners', async () => {
    const ended = once(redis, 'end');
    redis.disconnect();
    await ended;
    const listeners = redis.listenerCount('error');
    const stalled = vi.spyOn(redis, 'connect').mockImplementation(() => new Promise(() => {}));
    vi.useFakeTimers();
    try {
      const waiting = ensureRedis();
      expect(ensureRedis()).toBe(waiting);
      const rejection = expect(waiting).rejects.toThrow('Redis readiness timeout');
      await vi.advanceTimersByTimeAsync(5000);
      await rejection;
      expect(redis.listenerCount('error')).toBe(listeners);
      expect(redis.listenerCount('end')).toBe(0);
    } finally { stalled.mockRestore(); vi.useRealTimers(); }
    expect(await (await ensureRedis()).ping()).toBe('PONG');
  });
});
