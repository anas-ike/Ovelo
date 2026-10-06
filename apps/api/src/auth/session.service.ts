import type { Response } from 'express';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { hashToken, randomToken } from '../utils/crypto.js';
export const adminSessionCookie = `${env.SESSION_COOKIE_NAME}_admin`;
export const adminCsrfCookie = 'ovelo_admin_csrf';
export function clearSessionCookies(response: Response, admin = false) {
  response.clearCookie(admin ? adminSessionCookie : env.SESSION_COOKIE_NAME, { path: '/' });
  response.clearCookie(admin ? adminCsrfCookie : 'ovelo_csrf', { path: '/' });
}
export async function createSession(
  userId: string,
  response: Response,
  options: { admin?: boolean; userAgent?: string; replaceSessionId?: string } = {},
) {
  const token = randomToken();
  const csrf = randomToken();
  const session = await prisma.$transaction(async (tx) => {
    if (options.replaceSessionId)
      await tx.session.deleteMany({
        where: { id: options.replaceSessionId, admin: options.admin ?? false },
      });
    return tx.session.create({
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
  });
  const base = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
  } as const;
  const maxAge = 1000 * 60 * 60 * (options.admin ? 2 : 24 * 30);
  response.cookie(options.admin ? adminSessionCookie : env.SESSION_COOKIE_NAME, token, {
    ...base,
    maxAge,
  });
  response.cookie(options.admin ? adminCsrfCookie : 'ovelo_csrf', csrf, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
    path: '/',
    maxAge,
  });
  return session.id;
}
export async function destroySession(sessionId: string, response: Response, admin = false) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
  clearSessionCookies(response, admin);
}
export async function destroyAllSessions(userId: string, response: Response) {
  await prisma.session.deleteMany({ where: { userId } });
  response.clearCookie(env.SESSION_COOKIE_NAME, { path: '/' });
  response.clearCookie('ovelo_csrf', { path: '/' });
  clearSessionCookies(response, true);
}
