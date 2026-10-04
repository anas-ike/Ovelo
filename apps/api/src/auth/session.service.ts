import type { Response } from 'express';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { hashToken, randomToken } from '../utils/crypto.js';
export async function createSession(
  userId: string,
  response: Response,
  options: { admin?: boolean; userAgent?: string } = {},
) {
  const token = randomToken();
  const csrf = randomToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      csrfHash: hashToken(csrf),
      admin: options.admin ?? false,
      userAgent: options.userAgent?.slice(0, 500),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * (options.admin ? 2 : 24 * 30)),
    },
    select: { id: true },
  });
  const base = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  } as const;
  response.cookie(env.SESSION_COOKIE_NAME, token, { ...base, maxAge: 1000 * 60 * 60 * 24 * 30 });
  response.cookie('ovelo_csrf', csrf, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
  return session.id;
}
export async function destroySession(sessionId: string, response: Response) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
  response.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
  response.clearCookie('ovelo_csrf', { path: '/' });
}
export async function destroyAllSessions(userId: string, response: Response) {
  await prisma.session.deleteMany({ where: { userId } });
  response.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
  response.clearCookie('ovelo_csrf', { path: '/' });
}
