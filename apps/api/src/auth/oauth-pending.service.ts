import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { ensureRedis, consumeOnce } from '../config/redis.js';
import { randomToken, hashToken } from '../utils/crypto.js';
import { AppError } from '../middleware/error.js';
import { clearOAuthResult, oauthResultCookie } from './oauth-result.service.js';

export const pendingCookie = 'ovelo_oauth_pending';
const identitySchema = z
  .object({
    provider: z.enum(['google', 'discord']),
    providerAccountId: z.string().min(1).max(255),
    email: z.string().email().optional(),
    name: z.string().min(1).max(100).optional(),
    userId: z.string().uuid().optional(),
  })
  .strict();
export type PendingIdentity = z.infer<typeof identitySchema>;
export async function savePendingIdentity(identity: PendingIdentity, response: Response) {
  const ticket = randomToken();
  await (
    await ensureRedis()
  ).set(
    `ovelo:oauth-pending:${hashToken(ticket)}`,
    JSON.stringify(identitySchema.parse(identity)),
    'EX',
    600,
  );
  response.cookie(pendingCookie, ticket, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 600000,
  });
}
export async function pendingIdentity(
  ticket: unknown,
  consume = false,
): Promise<PendingIdentity | null> {
  if (ticket === undefined) return null;
  if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket))
    throw new AppError(400, 'OAUTH_PENDING_EXPIRED', 'Start provider sign-in again.');
  const key = `ovelo:oauth-pending:${hashToken(ticket)}`;
  const value = consume ? await consumeOnce(key) : await (await ensureRedis()).get(key);
  if (!value)
    throw new AppError(
      400,
      'OAUTH_PENDING_EXPIRED',
      'Provider registration expired. Start sign-in again.',
    );
  return identitySchema.parse(JSON.parse(value));
}

export async function clearPendingOAuth(
  cookies: Record<string, unknown> | undefined,
  response: Response,
) {
  await clearOAuthResult(cookies?.[oauthResultCookie], response);
  const redis = await ensureRedis();
  for (const [cookie, prefix] of [
    ['ovelo_oauth_state', 'ovelo:oauth:'],
    [pendingCookie, 'ovelo:oauth-pending:'],
  ] as const) {
    const value = cookies?.[cookie];
    if (typeof value === 'string' && /^[a-f0-9]{64}$/.test(value))
      await redis.del(`${prefix}${hashToken(value)}`);
    response.clearCookie(cookie, { path: '/' });
  }
}
