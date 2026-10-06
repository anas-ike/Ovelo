import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { completeOAuth, oauthRedirect, oauthCapabilities } from '../auth/oauth.service.js';
import { pendingCookie, pendingIdentity } from '../auth/oauth-pending.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { assertPolicyVersions, requireCurrentPolicyConsent } from '../auth/policy-consent.service.js';
import { createSession, destroySession } from '../auth/session.service.js';
import { prisma } from '../database/prisma.js';
import { oauthResultCookie, pendingOAuthResult, saveOAuthResult } from '../auth/oauth-result.service.js';
import { publicUserSelect, register, toPublicUser } from '../auth/auth.service.js';
import { email, policyConsentSchema } from '@ovelo/validation';

async function createProviderSession(userId: string, req: Request, res: Response) {
  const sessionId = await createSession(userId, res, {
    userAgent: req.get('user-agent'),
    replaceSessionId: req.auth?.sessionId,
  });
  try {
    await saveOAuthResult(userId, sessionId, res);
  } catch (error) {
    await destroySession(sessionId, res);
    throw error;
  }
  res.clearCookie(pendingCookie, { path: '/' });
}

export const providerCapabilities = asyncHandler(async (_req, res) => {
  res.json({ data: oauthCapabilities() });
});
export const providerResult = asyncHandler(async (req, res) => {
  const result = await pendingOAuthResult(req.cookies?.[oauthResultCookie]);
  if (!result || !req.auth || req.auth.admin || result.userId !== req.auth.userId || result.sessionId !== req.auth.sessionId) {
    logger.warn({ code: 'OAUTH_SESSION_MISMATCH', requestId: res.locals.requestId }, 'OAuth browser session confirmation failed');
    throw new AppError(401, 'OAUTH_SESSION_MISMATCH', 'Your sign-in session could not be confirmed. Please start sign-in again.');
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId }, select: publicUserSelect });
  // Remains readable for the short TTL so retries/StrictMode are idempotent;
  // starting another sign-in or logout deletes it immediately.
  res.json({ data: { user: toPublicUser(user) } });
});
export const pendingProvider = asyncHandler(async (req, res) => {
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  res.json({
    data: {
      provider: identity?.provider ?? null,
      email: identity?.email,
      name: identity?.name,
      kind: identity ? identity.userId || identity.email ? 'consent' : 'register' : null,
    },
  });
});
export const consentProvider = asyncHandler(async (req, res) => {
  const body = z
    .object({ termsVersion: z.string().max(32), privacyVersion: z.string().max(32) })
    .strict()
    .parse(req.body);
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  if (!identity)
    throw new AppError(400, 'OAUTH_PENDING_EXPIRED', 'Provider sign-in expired. Start again.');
  if (!identity.userId) {
    if (!identity.email)
      throw new AppError(400, 'OAUTH_EMAIL_REQUIRED', 'Add and verify an email address to finish sign-in.');
    assertPolicyVersions(body, ['TERMS', 'PRIVACY']);
    await pendingIdentity(req.cookies?.[pendingCookie], true);
    const user = await register(
      { name: identity.name || 'Ovelo member', email: identity.email, ...body },
      identity,
    );
    await createProviderSession(user.id, req, res);
    return res.status(201).json({ data: { authenticated: true } });
  }
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { userId: true },
  });
  if (!account || account.userId !== identity.userId)
    throw new AppError(400, 'OAUTH_PENDING_EXPIRED', 'Provider sign-in expired. Start again.');
  const user = await prisma.user.findFirst({
    where: { id: account.userId, deletedAt: null, disabledAt: null },
    select: { id: true, emailVerifiedAt: true, role: true },
  });
  if (!user || !user.emailVerifiedAt)
    throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
  await requireCurrentPolicyConsent(user.id, body, ['TERMS', 'PRIVACY']);
  await pendingIdentity(req.cookies?.[pendingCookie], true);
  await prisma.securityEvent.create({ data: { userId: user.id, type: 'OAUTH_LOGIN' } });
  await createProviderSession(user.id, req, res);
  res.json({ data: { authenticated: true } });
});
export const registerProvider = asyncHandler(async (req, res) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(100), email })
    .merge(policyConsentSchema.pick({ termsVersion: true, privacyVersion: true }))
    .strict()
    .parse(req.body);
  assertPolicyVersions(body, ['TERMS', 'PRIVACY']);
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  if (!identity || identity.userId)
    throw new AppError(400, 'OAUTH_PENDING_EXPIRED', 'Start provider sign-in again.');
  await pendingIdentity(req.cookies?.[pendingCookie], true);
  const user = await register(body, identity);
  if (user.emailVerifiedAt) {
    await createProviderSession(user.id, req, res);
    return res.status(201).json({ data: { authenticated: true } });
  }
  res.clearCookie(pendingCookie, { path: '/' });
  res.status(201).json({ data: { authenticated: false, verificationRequired: true } });
});
export const linkProvider = asyncHandler(async (req, res) => {
  if (req.body?.intent !== 'link-account')
    throw new AppError(400, 'ACCOUNT_LINK_CONFIRMATION_REQUIRED', 'Confirm account linking from Settings. To sign in to a different account, use the sign-in page.');
  const provider = z.enum(['google', 'discord']).parse(req.params.provider);
  res.json({
    data: {
      url: await oauthRedirect(
        provider,
        res,
        req.auth!.userId,
        false,
        req.auth!.sessionId,
        req.cookies,
      ),
    },
  });
});
export const googleStart = asyncHandler(async (req, res) =>
  res.redirect(await oauthRedirect('google', res, undefined, false, undefined, req.cookies)),
);
export const discordStart = asyncHandler(async (req, res) =>
  res.redirect(await oauthRedirect('discord', res, undefined, false, undefined, req.cookies)),
);

async function callback(provider: 'google' | 'discord', req: Request, res: Response) {
  try {
    const destination = await completeOAuth(
      provider,
      typeof req.query.state === 'string' ? req.query.state : undefined,
      req.cookies?.ovelo_oauth_state,
      typeof req.query.code === 'string' ? req.query.code : '',
      res,
      req.get('user-agent'),
      req.auth?.userId,
      req.adminAuth?.userId,
      req.auth?.sessionId,
      req.adminAuth?.sessionId,
    );
    // Only server-defined destinations are accepted, never query-supplied redirects.
    res.redirect(
      typeof destination === 'object'
        ? destination.adminUrl
        : `${env.APP_URL}/${destination === 'register' ? 'register?oauth=complete' : destination === 'consent' ? 'consent?source=oauth' : destination}`,
    );
  } catch (error) {
    if (!(error instanceof AppError)) {
      // Never log provider payloads, authorization codes, tokens or query strings.
      logger.error(
        {
          provider,
          errorType: error instanceof Error ? error.name : 'UnknownError',
          requestId: res.locals.requestId,
        },
        'OAuth callback failed',
      );
      return res.redirect(`${env.APP_URL}/${res.locals.oauthAdminLogin ? 'admin/login' : 'login'}?oauthError=OAUTH_FAILED`);
    }
    const allowed = [
      'LINK_REQUIRED',
      'EMAIL_NOT_VERIFIED',
      'OAUTH_STATE_INVALID',
      'ACCOUNT_ALREADY_LINKED',
      'ACCOUNT_UNAVAILABLE',
      'EMAIL_DOMAIN_REQUIRES_APPROVAL',
      'ADMIN_INVITATION_REQUIRED',
      'POLICY_CONSENT_REQUIRED',
      'OAUTH_EMAIL_MISMATCH',
    ];
    const code = allowed.includes(error.code) ? error.code : 'OAUTH_FAILED';
    logger.warn({ provider, code, requestId: res.locals.requestId }, 'OAuth callback rejected');
    res.redirect(`${env.APP_URL}/${res.locals.oauthAdminLogin ? 'admin/login' : 'login'}?oauthError=${code}`);
  }
}
export const googleCallback = asyncHandler((req, res) => callback('google', req, res));
export const discordCallback = asyncHandler((req, res) => callback('discord', req, res));
