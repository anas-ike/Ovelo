import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import { hashToken, safeEquals } from '../utils/crypto.js';
import { env } from '../config/env.js';
import { AppError } from './error.js';
import { adminSessionCookie, adminCsrfCookie } from '../auth/session.service.js';
import { currentPolicyStatus } from '../auth/policy-consent.service.js';
type Authentication = { userId: string; sessionId: string; role: Role; admin: boolean; csrfHash: string; isPrimaryAdmin: boolean };
declare global { namespace Express { interface Request { auth?: Authentication; adminAuth?: Authentication; } } }
export const loadSession: RequestHandler = async (req, _res, next) => {
  try {
    async function load(raw: unknown, admin: boolean): Promise<Authentication | undefined> {
      if (typeof raw !== 'string' || !/^[a-f0-9]{64}$/.test(raw)) return;
      const session = await prisma.session.findFirst({ where: { tokenHash: hashToken(raw), admin, expiresAt: { gt: new Date() }, user: { deletedAt: null, disabledAt: null } },
        select: { id: true, userId: true, csrfHash: true, admin: true, user: { select: { role: true, isPrimaryAdmin: true } } } });
      if (!session || admin && !['OWNER', 'ADMIN'].includes(session.user.role)) return;
      return { userId: session.userId, sessionId: session.id, role: session.user.role, isPrimaryAdmin: session.user.isPrimaryAdmin, admin, csrfHash: session.csrfHash };
    }
    req.adminAuth = await load(req.cookies?.[adminSessionCookie], true);
    req.auth = req.path.startsWith('/api/v1/admin') ? req.adminAuth : await load(req.cookies?.[env.SESSION_COOKIE_NAME], false);
    next();
  } catch (error) { next(error); }
};
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.auth) return next(new AppError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    const route = `${req.baseUrl}${req.path}`;
    if (!req.auth.admin && !['/api/v1/auth/csrf', '/api/v1/auth/policies'].includes(route)) {
      const policies = await currentPolicyStatus(req.auth.userId);
      if (!policies.accepted.terms || !policies.accepted.privacy)
        return next(new AppError(428, 'POLICY_CONSENT_REQUIRED', 'Accept the current Ovelo policies to continue.'));
    }
    next();
  } catch (error) { next(error); }
};
export const requireAdmin: RequestHandler = (req, _res, next) => req.auth?.admin && ['ADMIN', 'OWNER'].includes(req.auth.role) ? next() : next(new AppError(403, 'FORBIDDEN', 'Administrator access is required.'));
export const requireOwner: RequestHandler = (req, _res, next) => req.auth?.admin && req.auth.role === 'OWNER' ? next() : next(new AppError(403, 'OWNER_REQUIRED', 'Owner access is required.'));
export const csrf: RequestHandler = (req, _res, next) => {
  if (!env.CSRF_ENABLED || ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || !req.auth) return next();
  const header = req.header('x-csrf-token');
  const cookie: unknown = req.cookies?.[req.auth.admin ? adminCsrfCookie : 'ovelo_csrf'];
  if (!header || typeof cookie !== 'string' || !safeEquals(header, cookie) || hashToken(cookie) !== req.auth.csrfHash) return next(new AppError(403, 'CSRF_INVALID', 'Security token missing or invalid.'));
  next();
};
