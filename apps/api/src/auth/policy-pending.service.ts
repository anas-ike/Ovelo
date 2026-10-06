import type { Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { consumeOnce, ensureRedis } from '../config/redis.js';
import { AppError } from '../middleware/error.js';
import { hashToken, randomToken } from '../utils/crypto.js';

export const policyPendingCookie = 'ovelo_policy_pending';
const pendingSchema = z.object({ userId: z.string().uuid(), replaceSessionId: z.string().uuid().optional() }).strict();
export type PendingPolicyAuthentication = z.infer<typeof pendingSchema>;

export async function savePendingPolicyAuthentication(
  pending: PendingPolicyAuthentication,
  response: Response,
) {
  const ticket = randomToken();
  await (await ensureRedis()).set(
    `ovelo:policy-pending:${hashToken(ticket)}`,
    JSON.stringify(pendingSchema.parse(pending)),
    'EX',
    600,
  );
  response.cookie(policyPendingCookie, ticket, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    path: '/',
    maxAge: 600000,
  });
}

export async function pendingPolicyAuthentication(
  ticket: unknown,
  consume = false,
): Promise<PendingPolicyAuthentication | null> {
  if (ticket === undefined) return null;
  if (typeof ticket !== 'string' || !/^[a-f0-9]{64}$/.test(ticket))
    throw new AppError(400, 'POLICY_PENDING_EXPIRED', 'Sign-in expired. Start again.');
  const key = `ovelo:policy-pending:${hashToken(ticket)}`;
  const value = consume ? await consumeOnce(key) : await (await ensureRedis()).get(key);
  if (!value) throw new AppError(400, 'POLICY_PENDING_EXPIRED', 'Sign-in expired. Start again.');
  return pendingSchema.parse(JSON.parse(value));
}

export async function clearPendingPolicyAuthentication(ticket: unknown, response: Response) {
  if (typeof ticket === 'string' && /^[a-f0-9]{64}$/.test(ticket))
    await (await ensureRedis()).del(`ovelo:policy-pending:${hashToken(ticket)}`);
  response.clearCookie(policyPendingCookie, { path: '/' });
}
