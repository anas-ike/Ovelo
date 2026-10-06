import {
  emailChangeSchema,
  loginSchema,
  registerSchema,
  resetSchema,
  tokenSchema,
  password,
  policyConsentSchema,
  policyVersions,
} from '@ovelo/validation';
import { asyncHandler } from '../utils/async-handler.js';
import {
  authenticate,
  requireLoginPolicyConsent,
  changePassword,
  register,
  requestPasswordReset,
  requestEmailChange,
  resetPassword,
  verifyEmail,
  publicUserSelect,
  toPublicUser,
} from '../auth/auth.service.js';
import {
  createSession,
  destroyAllSessions,
  destroySession,
  clearSessionCookies,
} from '../auth/session.service.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import {
  pendingCookie,
  pendingIdentity,
  clearPendingOAuth,
} from '../auth/oauth-pending.service.js';
import {
  assertPolicyVersions,
  currentPolicyStatus,
  requireCurrentPolicyConsent,
} from '../auth/policy-consent.service.js';
import {
  clearPendingPolicyAuthentication,
  pendingPolicyAuthentication,
  policyPendingCookie,
  savePendingPolicyAuthentication,
} from '../auth/policy-pending.service.js';
export const registerController = asyncHandler(async (req, res) => {
  const body = registerSchema.parse(req.body);
  assertPolicyVersions(body, ['TERMS', 'PRIVACY']);
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  if (identity)
    throw new AppError(
      400,
      'OAUTH_PENDING_INVALID',
      'Finish provider sign-in using its policy confirmation or email-completion step. No password is required.',
    );
  const user = await register(body, identity);
  await pendingIdentity(req.cookies?.[pendingCookie], true);
  res.clearCookie(pendingCookie, { path: '/' });
  res.status(201).json({ data: { user } });
});
export const loginController = asyncHandler(async (req, res) => {
  const body = loginSchema.parse(req.body);
  const user = await authenticate(body.email, body.password);
  try {
    await requireLoginPolicyConsent(user.id, body);
  } catch (error) {
    if (!(error instanceof AppError) || error.code !== 'POLICY_CONSENT_REQUIRED') throw error;
    await savePendingPolicyAuthentication(
      { userId: user.id, replaceSessionId: req.auth?.sessionId },
      res,
    );
    throw error;
  }
  await clearPendingOAuth(req.cookies, res);
  await clearPendingPolicyAuthentication(req.cookies?.[policyPendingCookie], res);
  await createSession(user.id, res, {
    userAgent: req.get('user-agent'),
    replaceSessionId: req.auth?.sessionId,
  });
  res.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
         role: user.role,
         emailVerifiedAt: user.emailVerifiedAt,
         hasAvatar: user.hasAvatar,
      },
    },
  });
});
export const pendingConsentController = asyncHandler(async (req, res) => {
  const oauth = await pendingIdentity(req.cookies?.[pendingCookie]);
  if (oauth?.userId || oauth?.email)
    return res.json({
      data: { kind: 'oauth', provider: oauth.provider, newAccount: !oauth.userId, email: oauth.email },
    });
  const policy = await pendingPolicyAuthentication(req.cookies?.[policyPendingCookie]);
  res.json({ data: { kind: policy ? 'login' : null } });
});
export const consentController = asyncHandler(async (req, res) => {
  const body = policyConsentSchema
    .pick({ termsVersion: true, privacyVersion: true })
    .required()
    .strict()
    .parse(req.body);
  const pending = await pendingPolicyAuthentication(req.cookies?.[policyPendingCookie]);
  if (!pending) throw new AppError(400, 'POLICY_PENDING_EXPIRED', 'Sign-in expired. Start again.');
  await requireCurrentPolicyConsent(pending.userId, body, ['TERMS', 'PRIVACY']);
  const user = await prisma.user.findFirst({
    where: { id: pending.userId, deletedAt: null, disabledAt: null },
    select: { id: true, emailVerifiedAt: true },
  });
  if (!user || !user.emailVerifiedAt) throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
  await pendingPolicyAuthentication(req.cookies?.[policyPendingCookie], true);
  await clearPendingPolicyAuthentication(req.cookies?.[policyPendingCookie], res);
  await createSession(user.id, res, {
    userAgent: req.get('user-agent'),
    replaceSessionId: pending.replaceSessionId,
  });
  res.json({ data: { authenticated: true } });
});
export const logoutController = asyncHandler(async (req, res) => {
  await clearPendingOAuth(req.cookies, res);
  await clearPendingPolicyAuthentication(req.cookies?.[policyPendingCookie], res);
  if (req.auth) await destroySession(req.auth.sessionId, res);
  else clearSessionCookies(res);
  res.status(204).send();
});
export const policiesController = asyncHandler(async (req, res) => {
  res.json({
    data: req.auth
      ? await currentPolicyStatus(req.auth.userId)
      : {
          versions: policyVersions,
          accepted: { terms: false, privacy: false, uploadProcessing: false },
        },
  });
});
export const acceptPoliciesController = asyncHandler(async (req, res) => {
  const body = policyConsentSchema.parse(req.body);
  const required = body.uploadProcessingVersion
    ? (['UPLOAD_PROCESSING'] as const)
    : (['TERMS', 'PRIVACY'] as const);
  await requireCurrentPolicyConsent(req.auth!.userId, body, [...required]);
  res.json({ data: await currentPolicyStatus(req.auth!.userId) });
});
export const meController = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.auth!.userId },
    select: publicUserSelect,
  });
  res.json({ data: { user: toPublicUser(user) } });
});
export const verifyController = asyncHandler(async (req, res) => {
  const { token } = tokenSchema.parse(req.body);
  await verifyEmail(token);
  res.json({ data: { verified: true } });
});
export const forgotController = asyncHandler(async (req, res) => {
  const { email } = loginSchema.pick({ email: true }).parse(req.body);
  try {
    await requestPasswordReset(email);
  } catch {
    /* Accepted response never enumerates accounts or SMTP availability. */
  }
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
  await clearPendingOAuth(req.cookies, res);
  await clearPendingPolicyAuthentication(req.cookies?.[policyPendingCookie], res);
  await destroyAllSessions(req.auth!.userId, res);
  res.status(204).send();
});
export const changeEmailController = asyncHandler(async (req, res) => {
  if (req.auth!.role !== 'USER')
    throw new AppError(
      403,
      'ADMIN_IDENTITY_PROTECTED',
      'Administrator identity changes require owner-controlled administration.',
    );
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
      policyConsents: { select: { policy: true, version: true, acceptedAt: true } },
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
  if (req.auth!.role !== 'USER')
    throw new AppError(
      403,
      'ADMIN_IDENTITY_PROTECTED',
      'Remove administrator privileges through the owner before deleting an account.',
    );
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
  await clearPendingOAuth(req.cookies, res);
  await clearPendingPolicyAuthentication(req.cookies?.[policyPendingCookie], res);
  clearSessionCookies(res);
  res.status(202).json({ data: { deleted: true } });
});
