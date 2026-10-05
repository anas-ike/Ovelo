import { Router } from 'express';
import argon2 from 'argon2';
import { z } from 'zod';
import { adminPassword, loginSchema, domainSchema, email, resetSchema } from '@ovelo/validation';
import { prisma } from '../database/prisma.js';
import { createSession, destroySession, adminCsrfCookie } from '../auth/session.service.js';
import { requireAdmin, requireAuth, requireOwner, csrf } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../middleware/error.js';
import { hashToken } from '../utils/crypto.js';
import { auditAdmin } from '../services/admin-audit.service.js';
import { changePassword, requestPasswordReset, resetPassword, requestEmailChange } from '../auth/auth.service.js';
import { oauthRedirect } from '../auth/oauth.service.js';
import { logger } from '../utils/logger.js';
import { storageQueue } from '../services/migration.service.js';
import { adminEntryUrl, adminGate } from '../auth/admin-gate.service.js';
export const adminRouter = Router();
const publicAdmin = { id: true, name: true, email: true, role: true, isPrimaryAdmin: true, disabledAt: true, createdAt: true } as const;
adminRouter.post('/login', rateLimit('admin-login', 5), asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await prisma.user.findFirst({ where: { email: body.email, role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null, disabledAt: null }, select: { ...publicAdmin, passwordHash: true } });
  if (!user?.passwordHash || !await argon2.verify(user.passwordHash, body.password)) {
    await auditAdmin(req, res, 'ADMIN_LOGIN_FAILED', 'Authentication', undefined, 'DENIED', user?.id);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  }
  const sessionId = await createSession(user.id, res, { admin: true, userAgent: req.get('user-agent') });
  await auditAdmin(req, res, 'ADMIN_LOGIN', 'User', user.id, 'SUCCESS', user.id);
  res.json({ data: { authenticated: true, url: await adminEntryUrl(sessionId) } });
}));
adminRouter.get('/oauth/:provider', rateLimit('admin-oauth', 10), asyncHandler(async (req, res) => res.redirect(await oauthRedirect(z.enum(['google', 'discord']).parse(req.params.provider), res, undefined, true))));
adminRouter.post('/gate/:action', rateLimit('admin-gate', 300), asyncHandler(async (req, res) => res.json({ data: await adminGate(z.enum(['redeem', 'validate']).parse(req.params.action), z.object({ value: z.string().max(64) }).strict().parse(req.body).value, req.get('x-ovelo-gate-signature')) })));
adminRouter.post('/forgot-password', rateLimit('admin-reset-request', 5), asyncHandler(async (req, res) => {
  const target = email.parse(req.body?.email);
  try { await requestPasswordReset(target, true); } catch { logger.error({ subsystem: 'admin-recovery' }, 'Admin recovery delivery failed'); }
  res.json({ data: { accepted: true } });
}));
adminRouter.post('/reset-password', rateLimit('admin-reset', 5), asyncHandler(async (req, res) => { const body = resetSchema.parse(req.body); await resetPassword(body.token, body.password, true); res.json({ data: { reset: true } }); }));
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/me', asyncHandler(async (req, res) => res.json({ data: await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, select: publicAdmin }) })));
adminRouter.post('/entry', csrf, asyncHandler(async (req, res) => res.json({ data: { url: await adminEntryUrl(req.auth!.sessionId) } })));
adminRouter.get('/csrf', asyncHandler(async (req, res) => { const token: unknown = req.cookies?.[adminCsrfCookie]; if (typeof token !== 'string' || hashToken(token) !== req.auth!.csrfHash) throw new AppError(403, 'CSRF_INVALID', 'Sign in again to refresh request protection.'); res.json({ data: { csrfToken: token } }); }));
adminRouter.post('/logout', csrf, asyncHandler(async (req, res) => { await auditAdmin(req, res, 'ADMIN_LOGOUT', 'Session', req.auth!.sessionId); await destroySession(req.auth!.sessionId, res, true); res.status(204).send(); }));
adminRouter.post('/change-password', csrf, asyncHandler(async (req, res) => { const body = z.object({ currentPassword: z.string().min(1).max(128), password: adminPassword }).strict().parse(req.body); await changePassword(req.auth!.userId, body.currentPassword, body.password, res); res.json({ data: { changed: true } }); }));
adminRouter.patch('/primary-profile', requireOwner, csrf, asyncHandler(async (req, res) => {
  const body = z.object({ name: z.string().trim().min(1).max(100), email: email.optional(), currentPassword: z.string().min(1).max(128) }).strict().parse(req.body);
  const user = await prisma.user.findFirst({ where: { id: req.auth!.userId, isPrimaryAdmin: true }, select: { id: true, passwordHash: true, email: true } });
  if (!user?.passwordHash || !await argon2.verify(user.passwordHash, body.currentPassword)) throw new AppError(403, 'REAUTHENTICATION_REQUIRED', 'Primary owner password confirmation is required.');
  if (body.email && body.email !== user.email) await requestEmailChange(user.id, body.email);
  await prisma.user.update({ where: { id: user.id }, data: { name: body.name } }); await auditAdmin(req, res, 'PRIMARY_PROFILE_UPDATED', 'User', user.id);
  res.json({ data: { updated: true, verificationRequired: !!body.email && body.email !== user.email } });
}));
adminRouter.post('/providers/:provider/link', csrf, rateLimit('admin-link', 10), asyncHandler(async (req, res) => res.json({ data: { url: await oauthRedirect(z.enum(['google', 'discord']).parse(req.params.provider), res, req.auth!.userId, true) } })));
adminRouter.get('/accounts', asyncHandler(async (req, res) => res.json({ data: await prisma.account.findMany({ where: { userId: req.auth!.userId }, select: { provider: true, createdAt: true } }) })));
adminRouter.use((req, res, next) => { if (req.method === 'GET') res.on('finish', () => { void auditAdmin(req, res, `ADMIN_VIEW_${String(req.path.split('/')[1] || 'overview').toUpperCase().replace(/[^A-Z_-]/g, '')}`, 'Operation', undefined, res.statusCode < 400 ? 'SUCCESS' : 'DENIED').catch(() => logger.error({ subsystem: 'admin-audit' }, 'Audit write failed')); }); next(); });
adminRouter.get('/overview', asyncHandler(async (_req, res) => { const [users, items, storage, securityEvents24h, failedJobs] = await prisma.$transaction([prisma.user.count({ where: { deletedAt: null } }), prisma.item.count({ where: { deletedAt: null } }), prisma.user.aggregate({ _sum: { storageUsedBytes: true } }), prisma.securityEvent.count({ where: { createdAt: { gte: new Date(Date.now() - 86400000) } } }), prisma.migrationJob.count({ where: { state: 'FAILED' } })]); res.json({ data: { users, items, storageUsedBytes: storage._sum.storageUsedBytes?.toString() || '0', securityEvents24h, failedJobs } }); }));
adminRouter.get('/users', asyncHandler(async (req, res) => { const q = z.string().max(100).optional().parse(req.query.q); const users = await prisma.user.findMany({ where: { deletedAt: null, ...(q ? { OR: [{ email: { contains: q, mode: 'insensitive' as const } }, { name: { contains: q, mode: 'insensitive' as const } }] } : {}) }, select: { ...publicAdmin, itemCount: true }, take: 100, orderBy: { createdAt: 'desc' } }); res.json({ data: users }); }));
adminRouter.patch('/users/:id', csrf, asyncHandler(async (req, res) => { const id = z.string().uuid().parse(req.params.id), body = z.object({ disabled: z.boolean() }).strict().parse(req.body); const target = await prisma.user.findFirst({ where: { id, role: 'USER', deletedAt: null }, select: { id: true } }); if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'Normal user account not found.'); await prisma.$transaction([prisma.user.update({ where: { id }, data: { disabledAt: body.disabled ? new Date() : null } }), prisma.session.deleteMany({ where: { userId: id } })]); await auditAdmin(req, res, body.disabled ? 'USER_DISABLED' : 'USER_ENABLED', 'User', id); res.json({ data: { updated: true } }); }));
adminRouter.get('/administrators', requireOwner, asyncHandler(async (_req, res) => res.json({ data: await prisma.user.findMany({ where: { role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null }, select: publicAdmin, orderBy: { createdAt: 'asc' } }) })));
adminRouter.post('/administrators', requireOwner, csrf, asyncHandler(async (req, res) => {
  const body = z.object({ email, name: z.string().trim().min(1).max(100), password: adminPassword.optional(), role: z.enum(['ADMIN', 'OWNER']).default('ADMIN') }).strict().parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: body.email }, select: { id: true, deletedAt: true, disabledAt: true, emailVerifiedAt: true, isPrimaryAdmin: true } });
  if (existing?.isPrimaryAdmin || existing?.deletedAt || existing?.disabledAt || existing && !existing.emailVerifiedAt) throw new AppError(409, 'ADMIN_INVITE_UNAVAILABLE', 'This account is not eligible for administrator invitation.');
  if (!existing && !body.password) throw new AppError(400, 'PASSWORD_REQUIRED', 'Set an initial strong password for a new administrator.');
  const data = existing ? await prisma.user.update({ where: { id: existing.id }, data: { role: body.role }, select: publicAdmin }) : await prisma.user.create({ data: { email: body.email, name: body.name, role: body.role, emailVerifiedAt: new Date(), passwordHash: await argon2.hash(body.password!, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3 }) }, select: publicAdmin });
  await prisma.session.deleteMany({ where: { userId: data.id } });
  await auditAdmin(req, res, 'ADMIN_CREATED_OR_INVITED', 'User', data.id); res.status(201).json({ data });
}));
adminRouter.patch('/administrators/:id', requireOwner, csrf, asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id); const body = z.object({ role: z.enum(['OWNER', 'ADMIN']).optional(), disabled: z.boolean().optional() }).strict().parse(req.body);
  const target = await prisma.user.findFirst({ where: { id, role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null }, select: { isPrimaryAdmin: true } });
  if (!target || target.isPrimaryAdmin || id === req.auth!.userId) throw new AppError(403, 'ADMIN_CHANGE_FORBIDDEN', 'The primary administrator and your own privileges cannot be changed here.');
  await prisma.$transaction([prisma.user.update({ where: { id }, data: { role: body.role, ...(body.disabled !== undefined ? { disabledAt: body.disabled ? new Date() : null } : {}) } }), prisma.session.deleteMany({ where: { userId: id } })]);
  await auditAdmin(req, res, 'ADMIN_ROLE_OR_STATUS_CHANGED', 'User', id); res.json({ data: { updated: true } });
}));
adminRouter.delete('/administrators/:id', requireOwner, csrf, asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id); const target = await prisma.user.findFirst({ where: { id, role: { in: ['OWNER', 'ADMIN'] }, deletedAt: null }, select: { isPrimaryAdmin: true } });
  if (!target || target.isPrimaryAdmin || id === req.auth!.userId) throw new AppError(403, 'ADMIN_CHANGE_FORBIDDEN', 'The primary administrator and your own privileges cannot be removed here.');
  await prisma.$transaction([prisma.user.update({ where: { id }, data: { role: 'USER' } }), prisma.session.deleteMany({ where: { userId: id } })]);
  await auditAdmin(req, res, 'ADMIN_REMOVED', 'User', id); res.status(204).send();
}));
adminRouter.post('/administrators/:id/revoke-sessions', requireOwner, csrf, asyncHandler(async (req, res) => { const id = z.string().uuid().parse(req.params.id); const target = await prisma.user.findFirst({ where: { id, role: { in: ['OWNER', 'ADMIN'] }, isPrimaryAdmin: false }, select: { id: true } }); if (!target) throw new AppError(404, 'ADMIN_NOT_FOUND', 'Administrator not found.'); await prisma.session.deleteMany({ where: { userId: id } }); await auditAdmin(req, res, 'ADMIN_SESSIONS_REVOKED', 'User', id); res.json({ data: { revoked: true } }); }));
adminRouter.post('/administrators/:id/reset', requireOwner, csrf, asyncHandler(async (req, res) => { const id = z.string().uuid().parse(req.params.id); const target = await prisma.user.findFirst({ where: { id, role: { in: ['OWNER', 'ADMIN'] }, isPrimaryAdmin: false }, select: { email: true } }); if (!target) throw new AppError(404, 'ADMIN_NOT_FOUND', 'Administrator not found.'); await requestPasswordReset(target.email, true); await auditAdmin(req, res, 'ADMIN_RECOVERY_INITIATED', 'User', id); res.json({ data: { accepted: true } }); }));
adminRouter.get('/audit-logs', asyncHandler(async (req, res) => {
  const q = z.string().max(100).optional().parse(req.query.q);
  const logs = await prisma.adminAuditLog.findMany({ where: { ...(req.auth!.role === 'OWNER' ? {} : { adminId: req.auth!.userId }), ...(q ? { action: { contains: q, mode: 'insensitive' as const } } : {}) }, select: { id: true, action: true, targetType: true, targetId: true, result: true, requestId: true, createdAt: true, admin: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'desc' }, take: 100 }); res.json({ data: logs });
}));
adminRouter.get('/domains', asyncHandler(async (_req, res) => res.json({ data: await prisma.allowedEmailDomain.findMany({ orderBy: { domain: 'asc' } }) })));
adminRouter.post('/domains', requireOwner, csrf, asyncHandler(async (req, res) => { const body = domainSchema.parse(req.body); const data = await prisma.allowedEmailDomain.upsert({ where: { domain: body.domain }, create: { ...body, createdBy: req.auth!.userId }, update: body }); await auditAdmin(req, res, 'DOMAIN_UPSERTED', 'AllowedEmailDomain', data.id); res.status(201).json({ data }); }));
adminRouter.get('/security-events', requireOwner, asyncHandler(async (_req, res) => res.json({ data: await prisma.securityEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, type: true, userId: true, createdAt: true } }) })));
adminRouter.get('/background-jobs', asyncHandler(async (_req, res) => res.json({ data: await prisma.migrationJob.findMany({ orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, state: true, attempts: true, errorCode: true, createdAt: true } }) })));
adminRouter.post('/background-jobs/:id/retry', csrf, asyncHandler(async (req, res) => { const id = z.string().uuid().parse(req.params.id); const job = await prisma.migrationJob.findFirst({ where: { id, state: 'FAILED' }, select: { id: true } }); if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Failed job not found.'); await storageQueue.add('migrate-object', { migrationJobId: id }, { jobId: `retry-${id}-${Date.now()}`, attempts: 5 }); await auditAdmin(req, res, 'JOB_RETRIED', 'MigrationJob', id); res.json({ data: { queued: true } }); }));
adminRouter.get('/subscriptions', asyncHandler(async (_req, res) => res.json({ data: await prisma.subscription.findMany({ take: 100, select: { id: true, status: true, user: { select: { name: true, email: true } }, plan: { select: { name: true } } } }) })));
