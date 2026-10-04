import type { RequestHandler } from 'express';
import { prisma } from '../database/prisma.js';
import { hashToken, safeEquals } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { AppError } from './error.js';
import type { Role } from '@prisma/client';
declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; sessionId: string; role: Role; admin: boolean; csrfHash: string };
    }
  }
}
export const loadSession: RequestHandler = async (req, _res, next) => {
  try {
    const raw = req.cookies?.[env.SESSION_COOKIE_NAME] as string | undefined;
    if (!raw) return next();
    const session = await prisma.session.findFirst({
      where: { tokenHash: hashToken(raw), expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userId: true,
        csrfHash: true,
        admin: true,
        user: { select: { role: true, disabledAt: true, deletedAt: true } },
      },
    });
    if (session && !session.user.disabledAt && !session.user.deletedAt)
      req.auth = {
        userId: session.userId,
        sessionId: session.id,
        role: session.user.role,
        admin: session.admin,
        csrfHash: session.csrfHash,
      };
    return next();
  } catch (error) {
    return next(error);
  }
};
export const requireAuth: RequestHandler = (req, _res, next) =>
  req.auth ? next() : next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
export const requireAdmin: RequestHandler = (req, _res, next) =>
  req.auth?.admin && req.auth.role === 'ADMIN'
    ? next()
    : next(new AppError(403, 'FORBIDDEN', 'Administrator access is required.'));
export const csrf: RequestHandler = (req, _res, next) => {
  if (!env.CSRF_ENABLED || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.auth)
    return next();
  const header = req.header('x-csrf-token');
  const cookie = req.cookies?.ovelo_csrf as string | undefined;
  if (!header || !cookie || !safeEquals(header, cookie) || hashToken(cookie) !== req.auth.csrfHash)
    return next(new AppError(403, 'CSRF_INVALID', 'Security token missing or invalid.'));
  next();
};
