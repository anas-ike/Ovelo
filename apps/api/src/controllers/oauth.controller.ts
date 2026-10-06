import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { completeOAuth, oauthRedirect, oauthCapabilities } from '../auth/oauth.service.js';
import { pendingCookie, pendingIdentity } from '../auth/oauth-pending.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { requireCurrentPolicyConsent } from '../auth/policy-consent.service.js';
import { createSession } from '../auth/session.service.js';
import { prisma } from '../database/prisma.js';

export const providerCapabilities = asyncHandler(async (_req, res) => {
  res.json({ data: oauthCapabilities() });
});
export const pendingProvider = asyncHandler(async (req, res) => {
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  res.json({
    data: { provider: identity?.provider ?? null, email: identity?.email, name: identity?.name },
  });
});
export const consentProvider = asyncHandler(async (req, res) => {
  const body = z
    .object({ termsVersion: z.string().max(32), privacyVersion: z.string().max(32) })
    .strict()
    .parse(req.body);
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  if (!identity?.userId)
    throw new AppError(400, 'OAUTH_PENDING_EXPIRED', 'Provider sign-in expired. Start again.');
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
  await createSession(user.id, res, {
    userAgent: req.get('user-agent'),
    replaceSessionId: req.auth?.sessionId,
  });
  res.clearCookie(pendingCookie, { path: '/' });
  res.json({ data: { authenticated: true } });
});
export const linkProvider = asyncHandler(async (req, res) => {
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
        : `${env.APP_URL}/${destination === 'register' ? 'register?oauth=complete' : destination === 'consent' ? 'register?oauth=consent' : destination}`,
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
      return res.redirect(`${env.APP_URL}/login?oauthError=OAUTH_FAILED`);
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
    res.redirect(`${env.APP_URL}/login?oauthError=${code}`);
  }
}
export const googleCallback = asyncHandler((req, res) => callback('google', req, res));
export const discordCallback = asyncHandler((req, res) => callback('discord', req, res));
