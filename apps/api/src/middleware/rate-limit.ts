import type { RequestHandler } from 'express';
import { createHmac } from 'node:crypto';
import { ensureRedis } from '../config/redis.js';
import { env } from '../config/env.js';
import { AppError } from './error.js';
import { logger } from '../utils/logger.js';
import { redisFailure } from '@ovelo/shared/redis';

export const rateLimit =
  (name: string, max = env.RATE_LIMIT_MAX, windowMs = env.RATE_LIMIT_WINDOW): RequestHandler =>
  async (req, res, next) => {
    try {
      const redis = await ensureRedis();
      const subjects = [`ip:${req.ip}`];
      if (name.includes('login') && typeof req.body?.email === 'string')
        subjects.push(`account:${req.body.email.toLowerCase().trim()}`);
      for (const subject of subjects) {
        const hash = createHmac('sha256', env.SESSION_SECRET).update(subject).digest('hex');
        const key = `ovelo:limit:${name}:${hash}`;
        const result = (await redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
          1,
          key,
          windowMs,
        )) as [number, number];
        if (result[0] > max) {
          res.setHeader('retry-after', Math.ceil(result[1] / 1000));
          throw new AppError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
        }
      }
      next();
    } catch (error) {
      if (!(error instanceof AppError)) logger.error({ subsystem: 'rate-limit', limiter: name, code: redisFailure(error), requestId: res.locals.requestId }, 'Redis request protection failed closed');
      next(
        error instanceof AppError
          ? error
          : new AppError(
              503,
              'SECURITY_UNAVAILABLE',
              'Request protection is temporarily unavailable.',
            ),
      );
    }
  };
