import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ensureRedis } from '../config/redis.js';
import { hashToken, randomToken } from '../utils/crypto.js';

export const oauthResultCookie = 'ovelo_oauth_result';
const resultSchema = z.object({ userId: z.string().uuid(), sessionId: z.string().uuid() }).strict();

// A completion receipt is not a session: it can only verify the exact session
// the provider callback already created, never authenticate another browser.
export async function saveOAuthResult(userId: string, sessionId: string, response: Response) {
  const ticket = randomToken();
  await (await ensureRedis()).set(
    `ovelo:oauth-result:${hashToken(ticket)}`,
    JSON.stringify({ userId, sessionId }),
    'EX',
    120,
  );
  response.cookie(oauthResultCookie, ticket, {
    httpOnly: true, secure: env.COOKIE_SECURE, sameSite: 'lax', path: '/', maxAge: 120000,
  });
}

export async function pendingOAuthResult(ticket: unknown) {
  if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket)) return null;
  const value = await (await ensureRedis()).get(`ovelo:oauth-result:${hashToken(ticket)}`);
  return value ? resultSchema.parse(JSON.parse(value)) : null;
}

export async function clearOAuthResult(ticket: unknown, response: Response) {
  if (typeof ticket === 'string' && /^[a-f0-9]{64}$/.test(ticket))
    await (await ensureRedis()).del(`ovelo:oauth-result:${hashToken(ticket)}`);
  response.clearCookie(oauthResultCookie, { path: '/' });
}
