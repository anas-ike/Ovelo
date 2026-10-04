import { afterAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { rateLimit } from '../src/middleware/rate-limit.js';
import { errorHandler } from '../src/middleware/error.js';
import { requestId } from '../src/middleware/request-id.js';
import { redis, ensureRedis, closeSecurityRedis } from '../src/config/redis.js';
import { logger } from '../src/utils/logger.js';

describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('request protection availability', () => {
  afterAll(closeSecurityRedis);
  it('enforces Redis limits and fails closed with safe diagnostics on a command failure', async () => {
    await ensureRedis();
    const app = express(); app.use(requestId);
    app.get('/protected', rateLimit(`test-${randomUUID()}`,2,30000), (_req,res)=>res.json({ok:true}));
    app.use(errorHandler);
    expect((await request(app).get('/protected')).status).toBe(200);
    expect((await request(app).get('/protected')).status).toBe(200);
    const limited=await request(app).get('/protected');
    expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBeDefined();
    const logs=vi.spyOn(logger,'error').mockImplementation(()=>undefined);
    const failure=vi.spyOn(redis,'eval').mockRejectedValueOnce(new Error('NOPERM with deliberately-sensitive-test-content'));
    const unavailable=await request(app).get('/protected');
    expect(unavailable.status).toBe(503); expect(unavailable.body.error.code).toBe('SECURITY_UNAVAILABLE');
    expect(unavailable.body.error.requestId).toBeDefined();
    expect(JSON.stringify(logs.mock.calls)).toContain('REDIS_ACL_DENIED');
    expect(JSON.stringify(logs.mock.calls)).not.toContain('deliberately-sensitive');
    failure.mockRestore(); logs.mockRestore();
  });
});
