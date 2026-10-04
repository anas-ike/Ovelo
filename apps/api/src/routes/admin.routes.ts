import { Router } from 'express';
import argon2 from 'argon2';
import { prisma } from '../database/prisma.js';
import { createSession } from '../auth/session.service.js';
import { requireAdmin, requireAuth, csrf } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rate-limit.js';
import { asyncHandler } from '../utils/async-handler.js';
import { domainSchema } from '@ovelo/validation';
import { AppError } from '../middleware/error.js';
import { enqueueStorageMigration } from '../services/migration.service.js';
export const adminRouter = Router();
adminRouter.post(
  '/login',
  rateLimit('admin-login', 5),
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email ?? '').toLowerCase();
    const password = String(req.body?.password ?? '');
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, passwordHash: true, disabledAt: true },
    });
    if (
      !user ||
      user.role !== 'ADMIN' ||
      user.disabledAt ||
      !user.passwordHash ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      await prisma.securityEvent.create({ data: { type: 'ADMIN_LOGIN_FAILURE' } });
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    await prisma.securityEvent.create({ data: { userId: user.id, type: 'ADMIN_LOGIN_SUCCESS' } });
    await createSession(user.id, res, { admin: true, userAgent: req.get('user-agent') });
    res.json({ data: { authenticated: true } });
  }),
);
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get(
  '/overview',
  asyncHandler(async (_req, res) => {
    const [users, items, storage, security, jobs] = await prisma.$transaction([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.item.count({ where: { deletedAt: null } }),
      prisma.user.aggregate({ _sum: { storageUsedBytes: true } }),
      prisma.securityEvent.count({
        where: { createdAt: { gte: new Date(Date.now() - 86400000) } },
      }),
      prisma.migrationJob.count({ where: { state: 'FAILED' } }),
    ]);
    res.json({
      data: {
        users,
        items,
        storageUsedBytes: storage._sum.storageUsedBytes?.toString() ?? '0',
        securityEvents24h: security,
        failedJobs: jobs,
      },
    });
  }),
);
adminRouter.post(
  '/migrations/:storageObjectId',
  csrf,
  asyncHandler(async (req, res) => {
    const result = await enqueueStorageMigration(undefined, String(req.params.storageObjectId));
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.auth!.userId,
        action: 'STORAGE_MIGRATION_QUEUED',
        targetType: 'StorageObject',
        targetId: String(req.params.storageObjectId),
      },
    });
    res.status(202).json({ data: result });
  }),
);
adminRouter.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        disabledAt: true,
        createdAt: true,
        itemCount: true,
        storageUsedBytes: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({
      data: users.map((u) => ({ ...u, storageUsedBytes: u.storageUsedBytes.toString() })),
    });
  }),
);
adminRouter.get(
  '/domains',
  asyncHandler(async (_req, res) => {
    const domains = await prisma.allowedEmailDomain.findMany({ orderBy: { domain: 'asc' } });
    res.json({ data: domains });
  }),
);
adminRouter.post(
  '/domains',
  csrf,
  asyncHandler(async (req, res) => {
    const body = domainSchema.parse(req.body);
    const domain = await prisma.allowedEmailDomain.upsert({
      where: { domain: body.domain },
      create: { ...body, createdBy: req.auth!.userId },
      update: body,
    });
    await prisma.adminAuditLog.create({
      data: {
        adminId: req.auth!.userId,
        action: 'DOMAIN_UPSERTED',
        targetType: 'AllowedEmailDomain',
        targetId: domain.id,
      },
    });
    res.status(201).json({ data: domain });
  }),
);
adminRouter.get(
  '/security-events',
  asyncHandler(async (_req, res) => {
    const events = await prisma.securityEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, type: true, createdAt: true, userId: true },
    });
    res.json({ data: events });
  }),
);
adminRouter.get(
  '/audit-logs',
  asyncHandler(async (_req, res) => {
    const logs = await prisma.adminAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, action: true, targetType: true, targetId: true, createdAt: true },
    });
    res.json({ data: logs });
  }),
);
