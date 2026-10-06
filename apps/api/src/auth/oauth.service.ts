import { createHash } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { assertEmailAllowed } from './email-policy.service.js';
import { createSession, clearSessionCookies, destroySession } from './session.service.js';
import { saveOAuthResult } from './oauth-result.service.js';
import { randomToken, hashToken, safeEquals } from '../utils/crypto.js';
import { ensureRedis, consumeOnce } from '../config/redis.js';
import { savePendingIdentity, clearPendingOAuth } from './oauth-pending.service.js';
import { currentPolicyStatus } from './policy-consent.service.js';
import { clearPendingPolicyAuthentication, policyPendingCookie } from './policy-pending.service.js';
import { z } from 'zod';
import type { Response } from 'express';
import { adminEntryUrl } from './admin-gate.service.js';

type Provider = 'google' | 'discord';
export function oauthCapabilities() {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL),
    discord: Boolean(
      env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET && env.DISCORD_CALLBACK_URL,
    ),
  };
}
export interface AuthenticationProvider {
  authorizationUrl(state: string, verifier: string, nonce: string): string;
  exchange(
    code: string,
    verifier: string,
    nonce: string,
  ): Promise<{ id: string; email?: string; name: string }>;
}
const googleKeys = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
class GoogleAuthenticationProvider implements AuthenticationProvider {
  authorizationUrl(state: string, verifier: string, nonce: string) {
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL)
      throw new AppError(503, 'OAUTH_UNAVAILABLE', 'Google sign-in is not configured.');
    return `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, redirect_uri: env.GOOGLE_CALLBACK_URL, response_type: 'code', scope: 'openid email profile', prompt: 'select_account', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' })}`;
  }
  async exchange(code: string, verifier: string, nonce: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({
        code,
        code_verifier: verifier,
        client_id: env.GOOGLE_CLIENT_ID!,
        client_secret: env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: env.GOOGLE_CALLBACK_URL!,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) throw new AppError(401, 'OAUTH_FAILED', 'Could not complete sign-in.');
    const token = (await response.json()) as { id_token: string };
    const { payload } = await jwtVerify(token.id_token, googleKeys, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: env.GOOGLE_CLIENT_ID,
    });
    if (
      payload.nonce !== nonce ||
      !payload.sub ||
      payload.email_verified !== true ||
      typeof payload.email !== 'string'
    )
      throw new AppError(401, 'OAUTH_FAILED', 'The provider could not verify this identity.');
    return {
      id: payload.sub,
      email: payload.email.toLowerCase(),
      name: typeof payload.name === 'string' ? payload.name.slice(0, 100) : 'Ovelo member',
    };
  }
}
class DiscordAuthenticationProvider implements AuthenticationProvider {
  authorizationUrl(state: string) {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.DISCORD_CALLBACK_URL)
      throw new AppError(503, 'OAUTH_UNAVAILABLE', 'Discord sign-in is not configured.');
    return `https://discord.com/oauth2/authorize?${new URLSearchParams({ client_id: env.DISCORD_CLIENT_ID, redirect_uri: env.DISCORD_CALLBACK_URL, response_type: 'code', scope: env.DISCORD_SCOPE === 'identify email' ? 'identify email' : 'identify', state })}`;
  }
  async exchange(code: string) {
    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID!,
        client_secret: env.DISCORD_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: env.DISCORD_CALLBACK_URL!,
      }),
    });
    if (!response.ok)
      throw new AppError(401, 'OAUTH_FAILED', 'Could not complete Discord sign-in.');
    const token = (await response.json()) as { access_token: string };
    const result = await fetch('https://discord.com/api/users/@me', {
      signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!result.ok) throw new AppError(401, 'OAUTH_FAILED', 'Could not verify Discord identity.');
    const profile = z
      .object({
        id: z.string().regex(/^\d+$/),
        username: z.string().min(1),
        email: z.string().email().nullish(),
        verified: z.boolean().optional(),
      })
      .parse(await result.json());
    return {
      id: profile.id,
      name: profile.username.slice(0, 100),
      email: profile.verified ? profile.email?.toLowerCase() : undefined,
    };
  }
}
const providers: Record<Provider, AuthenticationProvider> = {
  google: new GoogleAuthenticationProvider(),
  discord: new DiscordAuthenticationProvider(),
};
export async function oauthRedirect(
  provider: Provider,
  response: Response,
  linkUserId?: string,
  adminLogin = false,
  linkSessionId?: string,
  cookies?: Record<string, unknown>,
) {
  const state = randomToken();
  const verifier = randomToken();
  const nonce = randomToken();
  const url = providers[provider].authorizationUrl(state, verifier, nonce);
  if (linkUserId && !linkSessionId)
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Sign in again before linking an account.');
  await clearPendingOAuth(cookies, response);
  await clearPendingPolicyAuthentication(cookies?.[policyPendingCookie], response);
  await (
    await ensureRedis()
  ).set(
    `ovelo:oauth:${hashToken(state)}`,
    JSON.stringify({ provider, verifier, nonce, linkUserId, linkSessionId, adminLogin }),
    'EX',
    600,
  );
  response.cookie('ovelo_oauth_state', state, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 600000,
    path: '/',
  });
  return url;
}
export async function completeOAuth(
  provider: Provider,
  state: string | undefined,
  cookieState: string | undefined,
  code: string,
  response: Response,
  userAgent?: string,
  currentUserId?: string,
  currentAdminId?: string,
  currentSessionId?: string,
  currentAdminSessionId?: string,
) {
  if (!state || !cookieState || !safeEquals(state, cookieState) || !/^[a-f0-9]{64}$/.test(state))
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Sign-in could not be verified.');
  const transaction = await consumeOnce(`ovelo:oauth:${hashToken(state)}`);
  response.clearCookie('ovelo_oauth_state', { path: '/' });
  if (!transaction)
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Sign-in has expired or was already used.');
  const flow = JSON.parse(transaction) as {
    provider: Provider;
    verifier: string;
    nonce: string;
    linkUserId?: string;
    linkSessionId?: string;
    adminLogin?: boolean;
  };
  response.locals.oauthAdminLogin = flow.adminLogin === true;
  if (!code || code.length > 2048)
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Sign-in could not be verified.');
  if (flow.provider !== provider)
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Provider mismatch.');
  const initiatingUserId = flow.adminLogin ? currentAdminId : currentUserId;
  const initiatingSessionId = flow.adminLogin ? currentAdminSessionId : currentSessionId;
  if (
    flow.linkUserId &&
    (flow.linkUserId !== initiatingUserId ||
      !flow.linkSessionId ||
      flow.linkSessionId !== initiatingSessionId)
  )
    throw new AppError(401, 'OAUTH_STATE_INVALID', 'Sign in again before linking an account.');
  if (!flow.linkUserId && !flow.adminLogin) {
    // A failed/new-account/consent handoff must not retain a previous identity.
    if (currentSessionId) await destroySession(currentSessionId, response);
    else clearSessionCookies(response);
  }
  const identity = await providers[provider].exchange(code, flow.verifier, flow.nonce);
  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.id } },
    select: { userId: true },
  });
  let userId = account?.userId;
  if (flow.adminLogin && !flow.linkUserId && !userId)
    throw new AppError(
      403,
      'ADMIN_INVITATION_REQUIRED',
      'Sign in with your administrator password and explicitly link this identity first.',
    );
  if (flow.linkUserId) {
    if (userId && userId !== flow.linkUserId)
      throw new AppError(
        409,
        'ACCOUNT_ALREADY_LINKED',
        'This provider identity is already linked.',
      );
    const user = await prisma.user.findFirst({
      where: {
        id: flow.linkUserId,
        disabledAt: null,
        deletedAt: null,
        ...(flow.adminLogin ? { role: { in: ['OWNER', 'ADMIN'] as ('OWNER' | 'ADMIN')[] } } : {}),
      },
      select: { id: true },
    });
    if (!user) throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
    if (!account)
      await prisma.account.create({
        data: { userId: user.id, provider, providerAccountId: identity.id },
      });
    userId = user.id;
  } else if (!userId) {
    if (identity.email) await assertEmailAllowed(identity.email);
    if (
      identity.email &&
      (await prisma.user.findUnique({ where: { email: identity.email }, select: { id: true } }))
    )
      throw new AppError(
        409,
        'LINK_REQUIRED',
        'Sign in to your existing account and link this provider in Settings.',
      );
    await savePendingIdentity(
      { provider, providerAccountId: identity.id, email: identity.email, name: identity.name },
      response,
    );
    return 'register' as const;
  }
  const active = await prisma.user.findFirst({
    where: { id: userId, disabledAt: null, deletedAt: null },
    select: { id: true, emailVerifiedAt: true, role: true },
  });
  if (!active) throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
  if (!active.emailVerifiedAt)
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
  if (flow.adminLogin && !['ADMIN', 'OWNER'].includes(active.role))
    throw new AppError(403, 'ADMIN_INVITATION_REQUIRED', 'This identity is not an administrator.');
  if (!flow.adminLogin && !flow.linkUserId) {
    const policies = await currentPolicyStatus(userId);
    if (!policies.accepted.terms || !policies.accepted.privacy) {
      await savePendingIdentity(
        {
          provider,
          providerAccountId: identity.id,
          email: identity.email,
          name: identity.name,
          userId,
        },
        response,
      );
      return 'consent' as const;
    }
  }
  await prisma.securityEvent.create({
    data: { userId, type: flow.linkUserId ? 'OAUTH_ACCOUNT_LINKED' : 'OAUTH_LOGIN' },
  });
  if (flow.adminLogin)
    await prisma.adminAuditLog.create({
      data: {
        adminId: userId,
        action: flow.linkUserId ? 'ADMIN_PROVIDER_LINKED' : 'ADMIN_OAUTH_LOGIN',
        targetType: 'User',
        targetId: userId,
        userAgent: userAgent?.slice(0, 500),
        requestId: String(response.locals.requestId || '').slice(0, 100) || null,
      },
    });
  if (flow.linkUserId)
    return flow.adminLogin
      ? { adminUrl: await adminEntryUrl(initiatingSessionId!) }
      : ('settings' as const);
  const sessionId = await createSession(userId, response, {
    userAgent,
    admin: !!flow.adminLogin,
    replaceSessionId: initiatingSessionId,
  });
  if (flow.adminLogin) return { adminUrl: await adminEntryUrl(sessionId) };
  try {
    await saveOAuthResult(userId, sessionId, response);
  } catch (error) {
    await destroySession(sessionId, response);
    throw error;
  }
  return 'auth/complete' as const;
}
