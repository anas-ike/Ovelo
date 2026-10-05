import { createHmac } from 'node:crypto';
import { ensureRedis, consumeOnce } from '../config/redis.js';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { randomToken, hashToken, safeEquals } from '../utils/crypto.js';
import { AppError } from '../middleware/error.js';

// Host-only API sessions stay host-only. A separate opaque web gate proves the
// same live DB session to the web server without handing it a browser API cookie.
export async function adminEntryUrl(sessionId: string) {
  const ticket = randomToken();
  await (await ensureRedis()).set(`ovelo:admin-entry:${hashToken(ticket)}`, sessionId, 'EX', 120);
  return `${env.APP_URL}/admin/entry?ticket=${ticket}`;
}
export async function adminGate(action: 'redeem' | 'validate', value: string, signature?: string) {
  const expected = createHmac('sha256', env.SESSION_SECRET).update(`admin-gate:${action}:${value}`).digest('hex');
  if (!signature || !safeEquals(signature, expected) || !/^[a-f0-9]{64}$/.test(value)) throw new AppError(401, 'UNAUTHENTICATED', 'Administrator authentication is required.');
  const sessionId = action === 'redeem' ? await consumeOnce(`ovelo:admin-entry:${hashToken(value)}`) : await (await ensureRedis()).get(`ovelo:admin-gate:${hashToken(value)}`);
  const session = sessionId ? await prisma.session.findFirst({ where: { id: sessionId, admin: true, expiresAt: { gt: new Date() }, user: { role: { in: ['OWNER', 'ADMIN'] }, disabledAt: null, deletedAt: null } }, select: { id: true, expiresAt: true } }) : null;
  if (!session) throw new AppError(401, 'UNAUTHENTICATED', 'Administrator authentication is required.');
  if (action === 'redeem') { const gate = randomToken(); await (await ensureRedis()).set(`ovelo:admin-gate:${hashToken(gate)}`, session.id, 'EX', Math.max(1, Math.floor((session.expiresAt.getTime() - Date.now()) / 1000))); return { gate }; }
  return { authenticated: true };
}
