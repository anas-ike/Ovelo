import {
  emailChangeSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
  password,
} from '@ovelo/validation';
import { asyncHandler } from '../utils/async-handler.js';
import {
  authenticate,
  changePassword,
  register,
  requestPasswordReset,
  requestEmailChange,
  resetPassword,
  verifyEmail,
  publicUserSelect,
} from '../auth/auth.service.js';
import { createSession, destroyAllSessions, destroySession } from '../auth/session.service.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { pendingCookie, pendingIdentity } from '../auth/oauth-pending.service.js';
export const registerController = asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  const identity = await pendingIdentity(req.cookies?.[pendingCookie], true);
  res.clearCookie(pendingCookie, { path: '/' });
  const user = await register(body, identity);
  res.status(201).json({ data: { user } });
});
export const loginController = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await authenticate(body.email, body.password);
  await createSession(user.id, res, { userAgent: req.get('user-agent') });
  res.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    },
  });
});
export const logoutController = asyncHandler(async (req, res) => {
  if (req.auth) await destroySession(req.auth.sessionId, res);
  else {
    res.clearCookie('ovelo_session', { path: '/' });
    res.clearCookie('ovelo_csrf', { path: '/' });
  }
  res.status(204).send();
});
export const meController = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: publicUserSelect,
  });
  res.json({ data: { user } });
});
export const verifyController = asyncHandler(async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  await verifyEmail(token);
  res.json({ data: { verified: true } });
});
export const forgotController = asyncHandler(async (req, res) => {
  const { email } = loginSchema.pick({ email: true }).parse(req.body);
  try { await requestPasswordReset(email); } catch { /* Accepted response never enumerates accounts or SMTP availability. */ }
  res.json({ data: { accepted: true } });
});
export const resetController = asyncHandler(async (req, res) => {
  const body = resetSchema.parse(req.body);
  await resetPassword(body.token, body.password);
  res.json({ data: { reset: true } });
});
export const changePasswordController = asyncHandler(async (req, res) => {
  const body = req.body as { currentPassword?: unknown; password?: unknown };
  const currentPassword = password.parse(body.currentPassword);
  const nextPassword = password.parse(body.password);
  await changePassword(req.auth!.userId, currentPassword, nextPassword, res);
  res.json({ data: { changed: true } });
});
export const sessionsController = asyncHandler(async (req, res) => {
  const sessions = await prisma.session.findMany({
    where: { userId: req.auth!.userId },
    select: { id: true, userAgent: true, createdAt: true, lastSeenAt: true, expiresAt: true },
    orderBy: { lastSeenAt: 'desc' },
  });
  res.json({ data: sessions.map((s) => ({ ...s, current: s.id === req.auth!.sessionId })) });
});
export const revokeSessionController = asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const session = await prisma.session.findFirst({
    where: { id, userId: req.auth!.userId },
    select: { id: true },
  });
  if (!session) throw new AppError(404, 'NOT_FOUND', 'Session not found.');
  await prisma.session.delete({ where: { id } });
  res.status(204).send();
});
export const logoutAllController = asyncHandler(async (req, res) => {
  await destroyAllSessions(req.auth!.userId, res);
  res.status(204).send();
});
export const changeEmailController = asyncHandler(async (req, res) => {
  if (req.auth!.role !== 'USER') throw new AppError(403, 'ADMIN_IDENTITY_PROTECTED', 'Administrator identity changes require owner-controlled administration.');
  const body = emailChangeSchema.parse(req.body);
  await requestEmailChange(req.auth!.userId, body.email);
  res.json({ data: { accepted: true } });
});
export const exportController = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: {
      name: true,
      email: true,
      createdAt: true,
      items: {
        where: { deletedAt: null },
        select: {
          inventoryCode: true,
          name: true,
          description: true,
          status: true,
          purchaseDate: true,
          purchasePrice: true,
          estimatedValue: true,
          currency: true,
          store: true,
          serialNumber: true,
          modelNumber: true,
          manufacturer: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          category: { select: { name: true } },
          location: { select: { name: true } },
          warranties: {
            select: { startDate: true, endDate: true, provider: true, warrantyNumber: true },
          },
          repairs: {
            select: {
              date: true,
              problem: true,
              repairShop: true,
              cost: true,
              currency: true,
              description: true,
            },
          },
        },
      },
      activities: {
        select: { action: true, description: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  res.setHeader('content-type', 'application/json');
  res.setHeader('content-disposition', 'attachment; filename="ovelo-data-export.json"');
  res.json(user);
});
export const deleteAccountController = asyncHandler(async (req, res) => {
  if (req.auth!.role !== 'USER') throw new AppError(403, 'ADMIN_IDENTITY_PROTECTED', 'Remove administrator privileges through the owner before deleting an account.');
  await prisma.$transaction([
    prisma.user.update({
      where: { id: req.auth!.userId },
      data: {
        deletedAt: new Date(),
        disabledAt: new Date(),
        email: `deleted-${req.auth!.userId}@deleted.ovelo`,
        name: 'Deleted Ovelo account',
        passwordHash: null,
      },
    }),
    prisma.session.deleteMany({ where: { userId: req.auth!.userId } }),
    prisma.securityEvent.create({
      data: { userId: req.auth!.userId, type: 'ACCOUNT_DELETION_REQUESTED' },
    }),
  ]);
  res.clearCookie('ovelo_session', { path: '/' });
  res.clearCookie('ovelo_csrf', { path: '/' });
  res.status(202).json({ data: { deleted: true } });
});
