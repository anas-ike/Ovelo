import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/async-handler.js';
import { completeOAuth, oauthRedirect, oauthCapabilities } from '../auth/oauth.service.js';
import { pendingCookie, pendingIdentity } from '../auth/oauth-pending.service.js';
import { env } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

export const providerCapabilities = asyncHandler(async (_req, res) => { res.json({ data: oauthCapabilities() }); });
export const pendingProvider = asyncHandler(async (req, res) => {
  const identity = await pendingIdentity(req.cookies?.[pendingCookie]);
  res.json({ data: { provider: identity?.provider ?? null } });
});
export const linkProvider = asyncHandler(async (req, res) => {
  const provider = z.enum(['google','discord']).parse(req.params.provider);
  res.json({ data: { url: await oauthRedirect(provider, res, req.auth!.userId) } });
});
export const googleStart = asyncHandler(async (_req, res) => res.redirect(await oauthRedirect('google', res)));
export const discordStart = asyncHandler(async (_req, res) => res.redirect(await oauthRedirect('discord', res)));

async function callback(provider: 'google' | 'discord', req: Request, res: Response) {
  try {
    const destination = await completeOAuth(provider, typeof req.query.state === 'string' ? req.query.state : undefined, req.cookies?.ovelo_oauth_state, typeof req.query.code === 'string' ? req.query.code : '', res, req.get('user-agent'), req.auth?.userId, req.adminAuth?.userId);
    // Only server-defined destinations are accepted, never query-supplied redirects.
    res.redirect(typeof destination === 'object' ? destination.adminUrl : `${env.APP_URL}/${destination === 'register' ? 'register?oauth=complete' : 'dashboard'}`);
  } catch (error) {
    if (!(error instanceof AppError)) {
      // Never log provider payloads, authorization codes, tokens or query strings.
      logger.error({ provider, errorType: error instanceof Error ? error.name : 'UnknownError', requestId: res.locals.requestId }, 'OAuth callback failed');
      return res.redirect(`${env.APP_URL}/login?oauthError=OAUTH_FAILED`);
    }
    const allowed = ['LINK_REQUIRED','EMAIL_NOT_VERIFIED','OAUTH_STATE_INVALID','ACCOUNT_ALREADY_LINKED','ACCOUNT_UNAVAILABLE','EMAIL_DOMAIN_REQUIRES_APPROVAL','ADMIN_INVITATION_REQUIRED'];
    const code = allowed.includes(error.code) ? error.code : 'OAUTH_FAILED';
    res.redirect(`${env.APP_URL}/login?oauthError=${code}`);
  }
}
export const googleCallback = asyncHandler((req, res) => callback('google', req, res));
export const discordCallback = asyncHandler((req, res) => callback('discord', req, res));
