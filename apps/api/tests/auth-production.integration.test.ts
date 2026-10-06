import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../src/services/email.service.js';
import { hashToken } from '../src/utils/crypto.js';
import argon2 from 'argon2';
import { policyVersions } from '@ovelo/validation';

// Provider/SMTP boundaries are simulated; sessions, Redis, signatures and DB are real.
vi.mock('../src/services/email.service.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  sendLoginNotification: vi.fn(),
}));

describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('production authentication paths', () => {
  let app: Express;
  const run = randomUUID();
  const email = `auth-${run}@gmail.com`;
  const googleEmail = `google-${run}@gmail.com`;
  const discordEmail = `discord-${run}@gmail.com`;
  const manualConsentEmail = `manual-consent-${run}@gmail.com`;
  const adminEmail = `oauth-admin-${run}@gmail.com`;
  const password = `test-only-${run}`;
  let discordId = Date.now().toString();
  const appOrigin = 'https://ovelo.lightsout.in';
  const consent = { termsVersion: policyVersions.terms, privacyVersion: policyVersions.privacy };
  let googleNonce = '';
  let googleChallenge = '';
  let googleSubject = `google-${run}`;
  let badGoogleNonce = false;
  let invalidCode = false;
  let providerTimeout = false;
  let privateKey: CryptoKey;
  let jwk: Awaited<ReturnType<typeof exportJWK>>;
  beforeAll(async () => {
    vi.stubEnv('APP_URL', appOrigin);
    vi.stubEnv('TRUST_PROXY', 'true');
    vi.stubEnv('API_URL', 'https://apiovelo.lightsout.in');
    vi.stubEnv('COOKIE_SECURE', 'false');
    vi.stubEnv('EMAIL_VERIFICATION_REQUIRED', 'true');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-provider-secret');
    vi.stubEnv('GOOGLE_CALLBACK_URL', 'https://apiovelo.lightsout.in/api/v1/auth/google/callback');
    vi.stubEnv('DISCORD_CLIENT_ID', 'test-discord-client');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'test-provider-secret');
    vi.stubEnv(
      'DISCORD_CALLBACK_URL',
      'https://apiovelo.lightsout.in/api/v1/auth/discord/callback',
    );
    vi.stubEnv('DISCORD_SCOPE', 'identify');
    const keys = await generateKeyPair('RS256');
    privateKey = keys.privateKey;
    jwk = { ...(await exportJWK(keys.publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL, init?: RequestInit) => {
        const value = String(url);
        if (providerTimeout) throw new DOMException('Test provider timeout', 'TimeoutError');
        if (invalidCode && value.endsWith('/token'))
          return Response.json({ error: 'invalid_grant' }, { status: 400 });
        if (value === 'https://www.googleapis.com/oauth2/v3/certs')
          return Response.json({ keys: [jwk] });
        if (value === 'https://oauth2.googleapis.com/token') {
          expect(String(init?.body)).toContain('code_verifier=');
          if (
            createHash('sha256')
              .update(new URLSearchParams(String(init?.body)).get('code_verifier')!)
              .digest('base64url') !== googleChallenge
          )
            return Response.json({ error: 'invalid_grant' }, { status: 400 });
          const jwt = await new SignJWT({
            nonce: badGoogleNonce ? 'wrong' : googleNonce,
            email: googleEmail,
            email_verified: true,
            name: 'Test owner',
          })
            .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
            .setSubject(googleSubject)
            .setAudience('test-google-client')
            .setIssuer('https://accounts.google.com')
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(privateKey);
          return Response.json({ id_token: jwt });
        }
        if (value === 'https://discord.com/api/oauth2/token') {
          expect(String(init?.body)).toContain('grant_type=authorization_code');
          return Response.json({ access_token: 'test-access-token' });
        }
        if (value === 'https://discord.com/api/users/@me')
          return Response.json({ id: discordId, username: 'Test Discord owner' });
        throw new Error('Unexpected provider request');
      }),
    );
    app = (await import('../src/app.js')).app;
    await (await import('../src/config/redis.js')).verifySecurityRedis();
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'OAuth administrator',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
        passwordHash: await argon2.hash(password),
      },
    });
  });
  beforeEach(async () => {
    // Each test owns its account-limit window; rate-limit assertions still use
    // the real limiter repeatedly within their test. Other suites are untouched.
    const { env } = await import('../src/config/env.js');
    const redis = await (await import('../src/config/redis.js')).ensureRedis();
    for (const target of [email, googleEmail, discordEmail, manualConsentEmail, adminEmail]) {
      const subject = createHmac('sha256', env.SESSION_SECRET)
        .update(`account:${target}`)
        .digest('hex');
      await redis.del(`ovelo:limit:login:${subject}`, `ovelo:limit:admin-login:${subject}`);
    }
  });
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: [email, googleEmail, discordEmail, manualConsentEmail, adminEmail] } },
    });
    await (await import('../src/services/migration.service.js')).storageQueue.close();
    await (await import('../src/config/redis.js')).closeSecurityRedis();
    await prisma.$disconnect();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function start(agent: ReturnType<typeof request.agent>, provider: string, admin = false) {
    const response = await agent.get(
      admin ? `/api/v1/admin/oauth/${provider}` : `/api/v1/auth/${provider}`,
    );
    expect(response.status).toBe(302);
    const url = new URL(response.headers.location!);
    expect(url.searchParams.get('redirect_uri')).toBe(
      `https://apiovelo.lightsout.in/api/v1/auth/${provider}/callback`,
    );
    if (provider === 'google') {
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('prompt')).toBe('select_account');
      googleNonce = url.searchParams.get('nonce')!;
      googleChallenge = url.searchParams.get('code_challenge')!;
    } else expect(url.searchParams.get('scope')).toBe('identify');
    return url.searchParams.get('state')!;
  }
  async function verify(agent: ReturnType<typeof request.agent>, targetEmail: string) {
    const call = [...vi.mocked(sendVerificationEmail).mock.calls]
      .reverse()
      .find(([to]) => to === targetEmail);
    expect(call).toBeDefined();
    expect((await agent.post('/api/v1/auth/verify-email').send({ token: call![1] })).status).toBe(
      200,
    );
  }
  it('returns only safe provider capabilities and permits only the configured credentialed origin', async () => {
    const response = await request(app).get('/api/v1/auth/providers').set('Origin', appOrigin);
    expect(response.body).toEqual({ data: { google: true, discord: true } });
    expect(response.headers['access-control-allow-origin']).toBe(appOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(JSON.stringify(response.body)).not.toContain('secret');
    const foreign = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .send({ email, password });
    expect(foreign.status).toBe(403);
  });
  it('registers/verifies email, persists an opaque session, enforces CSRF and logs out', async () => {
    const agent = request.agent(app);
    expect(
      (await agent.post('/api/v1/auth/register').send({ name: 'Owner', email, password })).status,
    ).toBe(428);
    expect(
      (
        await agent
          .post('/api/v1/auth/register')
          .send({ name: 'Owner', email, password, ...consent, privacyVersion: 'obsolete' })
      ).status,
    ).toBe(428);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    expect(
      (
        await agent
          .post('/api/v1/auth/register')
          .send({ name: 'Owner', email, password, ...consent })
      ).status,
    ).toBe(201);
    expect(
      (await agent.post('/api/v1/auth/login').send({ email, password, ...consent })).status,
    ).toBe(403);
    await verify(agent, email);
    const login = await agent.post('/api/v1/auth/login').send({ email, password, ...consent });
    expect(login.status).toBe(200);
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(login.headers['set-cookie'])).toContain('SameSite=Lax');
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(email);
    const registered = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(await prisma.policyConsent.count({ where: { userId: registered.id } })).toBe(2);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(403);
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', 'wrong')).status).toBe(403);
    const csrf = await agent.get('/api/v1/auth/csrf').set('Origin', appOrigin);
    expect(csrf.status).toBe(200);
    expect(csrf.headers['cache-control']).toBe('no-store');
    expect(
      (await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf.body.data.csrfToken))
        .status,
    ).toBe(204);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('uses a purpose-bound consent transaction for an existing password account', async () => {
    const user = await prisma.user.create({
      data: { email: manualConsentEmail, name: 'Manual consent user', passwordHash: await argon2.hash(password), emailVerifiedAt: new Date() },
    });
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.184');
    const blocked = await agent.post('/api/v1/auth/login').send({ email: manualConsentEmail, password });
    expect(blocked.status).toBe(428);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.get('/api/v1/auth/consent/pending')).body).toEqual({ data: { kind: 'login' } });
    expect((await agent.post('/api/v1/auth/consent').send({ termsVersion: policyVersions.terms, privacyVersion: 'old' })).status).toBe(428);
    const accepted = await agent.post('/api/v1/auth/consent').send(consent);
    expect(accepted.status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.id).toBe(user.id);
    expect((await agent.post('/api/v1/auth/consent').send(consent)).status).toBe(403);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    expect((await agent.post('/api/v1/auth/login').set('X-CSRF-Token', csrf).send({ email: manualConsentEmail, password })).status).toBe(200);
  });
  it('completes Google signup/login with real JWT validation and rejects state replay', async () => {
    const agent = request.agent(app);
    const state = await start(agent, 'google');
    const callback = await agent
      .get('/api/v1/auth/google/callback')
      .query({ state, code: 'test-code', redirect: 'https://attacker.example' });
    expect(callback.status).toBe(302);
    expect(callback.headers.location).toBe(`${appOrigin}/register?oauth=complete`);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (
        await agent
          .post('/api/v1/auth/register')
          .send({ name: 'Google owner', email: googleEmail, password, ...consent })
      ).status,
    ).toBe(201);
    await verify(agent, googleEmail);
    const stateAfterRegistration = await start(agent, 'google');
    expect(
      (
        await agent
          .get('/api/v1/auth/google/callback')
          .query({ state: stateAfterRegistration, code: 'test-code' })
      ).headers.location,
    ).toBe(`${appOrigin}/dashboard`);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(googleEmail);
    const replay = await agent
      .get('/api/v1/auth/google/callback')
      .query({ state, code: 'test-code' });
    expect(replay.headers.location).toContain('OAUTH_STATE_INVALID');
    const second = request.agent(app);
    const secondState = await start(second, 'google');
    expect(
      (
        await second
          .get('/api/v1/auth/google/callback')
          .query({ state: secondState, code: 'test-code' })
      ).headers.location,
    ).toBe(`${appOrigin}/dashboard`);
    expect(await prisma.user.count({ where: { email: googleEmail } })).toBe(1);
  });
  it('rejects incorrect Google nonces and mismatched browser state', async () => {
    const agent = request.agent(app);
    const state = await start(agent, 'google');
    badGoogleNonce = true;
    expect(
      (await agent.get('/api/v1/auth/google/callback').query({ state, code: 'test-code' })).headers
        .location,
    ).toContain('OAUTH_FAILED');
    badGoogleNonce = false;
    const state2 = await start(agent, 'google');
    expect(
      (
        await request(app)
          .get('/api/v1/auth/google/callback')
          .query({ state: state2, code: 'test-code' })
      ).headers.location,
    ).toContain('OAUTH_STATE_INVALID');
  });
  it('rejects a Google exchange whose verifier does not match the browser authorization challenge', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.174');
    const state = await start(agent, 'google');
    const redis = await (await import('../src/config/redis.js')).ensureRedis();
    const key = `ovelo:oauth:${hashToken(state)}`;
    const flow = JSON.parse((await redis.get(key))!);
    await redis.set(key, JSON.stringify({ ...flow, verifier: 'incorrect-verifier' }), 'EX', 600);
    expect(
      (await agent.get('/api/v1/auth/google/callback').query({ state, code: 'test-code' })).headers
        .location,
    ).toContain('OAUTH_FAILED');
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('completes identify-only Discord signup through verified email, then signs in directly', async () => {
    const agent = request.agent(app);
    const state = await start(agent, 'discord');
    const callback = await agent
      .get('/api/v1/auth/discord/callback')
      .query({ state, code: 'test-code' });
    expect(callback.headers.location).toBe(`${appOrigin}/register?oauth=complete`);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.get('/api/v1/auth/oauth/pending')).body).toMatchObject({
      data: { provider: 'discord' },
    });
    expect(
      (
        await agent
          .post('/api/v1/auth/register')
          .send({ name: 'Discord owner', email: discordEmail, password, ...consent })
      ).status,
    ).toBe(201);
    const state2 = await start(agent, 'discord');
    expect(
      (await agent.get('/api/v1/auth/discord/callback').query({ state: state2, code: 'test-code' }))
        .headers.location,
    ).toContain('EMAIL_NOT_VERIFIED');
    await verify(agent, discordEmail);
    const state3 = await start(agent, 'discord');
    expect(
      (await agent.get('/api/v1/auth/discord/callback').query({ state: state3, code: 'test-code' }))
        .headers.location,
    ).toBe(`${appOrigin}/dashboard`);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(discordEmail);
  });
  it('switches Google A → logout → Discord B with fresh identity and bidirectional resource isolation', async () => {
    const userA = await prisma.user.findUniqueOrThrow({ where: { email: googleEmail } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: discordEmail } });
    googleSubject = `google-${run}`;
    discordId = String(Date.now() + 1000000);
    await prisma.account.create({
      data: { userId: userB.id, provider: 'discord', providerAccountId: discordId },
    });
    const locationA = await prisma.location.create({
      data: { userId: userA.id, name: 'Private A location' },
    });
    const itemA = await prisma.item.create({
      data: {
        userId: userA.id,
        inventoryCode: `switch-a-${run}`,
        name: 'Private A item',
        locationId: locationA.id,
        warranties: { create: { startDate: new Date(), endDate: new Date(Date.now() + 86400000) } },
        repairs: {
          create: { date: new Date(), problem: 'Private A repair', cost: 1, currency: 'USD' },
        },
        qrCode: { create: { code: `qr-a-${run}` } },
        activities: {
          create: { userId: userA.id, action: 'ITEM_CREATED', description: 'Private A activity' },
        },
      },
      include: { warranties: true, repairs: true },
    });
    const object = await prisma.storageObject.create({
      data: {
        userId: userA.id,
        provider: 'LOCAL',
        storageKey: `test-${run}`,
        fileId: `test-${run}`,
        filename: 'private.png',
        mimeType: 'image/png',
        size: 1n,
        checksum: 'test-checksum',
      },
    });
    const documentA = await prisma.document.create({
      data: {
        itemId: itemA.id,
        storageObjectId: object.id,
        title: 'Private A document',
        kind: 'OTHER',
      },
    });
    const itemB = await prisma.item.create({
      data: { userId: userB.id, inventoryCode: `switch-b-${run}`, name: 'Private B item' },
    });
    const a = request.agent(app).set('X-Forwarded-For', '198.51.100.170');
    const otherA = request.agent(app).set('X-Forwarded-For', '198.51.100.171');
    for (const agent of [a, otherA]) {
      const state = await start(agent, 'google');
      await agent.get('/api/v1/auth/google/callback').query({ state, code: 'test-code' });
    }
    const oldSessions = (await a.get('/api/v1/auth/sessions')).body.data as {
      id: string;
      current: boolean;
    }[];
    const oldSession = oldSessions.find((s) => s.current)!;
    const csrfA = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken;
    expect((await a.post('/api/v1/auth/logout').set('X-CSRF-Token', csrfA)).status).toBe(204);
    expect(await prisma.session.findUnique({ where: { id: oldSession.id } })).toBeNull();
    expect((await a.get('/api/v1/auth/me')).status).toBe(401);
    expect((await otherA.get('/api/v1/auth/me')).body.data.user.id).toBe(userA.id);
    const stateB = await start(a, 'discord');
    expect(
      (await a.get('/api/v1/auth/discord/callback').query({ state: stateB, code: 'test-code' }))
        .headers.location,
    ).toBe(`${appOrigin}/dashboard`);
    expect((await a.get('/api/v1/auth/me')).body.data.user.id).toBe(userB.id);
    expect((await a.get(`/api/v1/items/${itemB.id}`)).status).toBe(200);
    for (const path of [
      `/items/${itemA.id}`,
      `/items/${itemA.id}/documents`,
      `/items/${itemA.id}/activity`,
      `/items/${itemA.id}/qr`,
      `/items/${itemA.id}/barcode`,
      `/documents/${documentA.id}/download`,
      `/qr/qr-a-${run}`,
    ])
      expect((await a.get(`/api/v1${path}`)).status).toBe(404);
    expect(
      (await a.get('/api/v1/inventory/locations')).body.data.some(
        (l: { id: string }) => l.id === locationA.id,
      ),
    ).toBe(false);
    expect(
      (await a.get('/api/v1/activity')).body.data.data.some(
        (entry: { item?: { id: string } }) => entry.item?.id === itemA.id,
      ),
    ).toBe(false);
    expect((await otherA.get(`/api/v1/items/${itemB.id}`)).status).toBe(404);
    const csrfB = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken;
    expect(csrfB).not.toBe(csrfA);
    expect(
      (
        await a
          .delete(`/api/v1/items/${itemA.id}/warranties/${itemA.warranties[0]!.id}`)
          .set('X-CSRF-Token', csrfB)
      ).status,
    ).toBe(404);
    expect(
      (
        await a
          .delete(`/api/v1/items/${itemA.id}/repairs/${itemA.repairs[0]!.id}`)
          .set('X-CSRF-Token', csrfB)
      ).status,
    ).toBe(404);
    expect(
      (await a.delete(`/api/v1/documents/${documentA.id}`).set('X-CSRF-Token', csrfB)).status,
    ).toBe(404);
    expect((await a.post('/api/v1/auth/logout').set('X-CSRF-Token', csrfA)).status).toBe(403);
  });
  it('requires current consent for a legacy provider identity and consumes the consent ticket once', async () => {
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: discordEmail } });
    await prisma.policyConsent.updateMany({
      where: { userId: userB.id, policy: 'PRIVACY' },
      data: { version: 'old-policy' },
    });
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.172');
    const state = await start(agent, 'discord');
    expect(
      (await agent.get('/api/v1/auth/discord/callback').query({ state, code: 'test-code' })).headers
        .location,
    ).toBe(`${appOrigin}/consent?source=oauth`);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (
        await agent
          .post('/api/v1/auth/oauth/consent')
          .send({ ...consent, privacyVersion: 'obsolete' })
      ).status,
    ).toBe(428);
    expect((await agent.post('/api/v1/auth/oauth/consent').send(consent)).status).toBe(200);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.id).toBe(userB.id);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    expect(
      (await agent.post('/api/v1/auth/oauth/consent').set('X-CSRF-Token', csrf).send(consent))
        .status,
    ).toBe(400);
    expect(
      await prisma.policyConsent.count({ where: { userId: userB.id, policy: 'PRIVACY' } }),
    ).toBe(2);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .set('X-Forwarded-For', '198.51.100.175')
          .send({ email: discordEmail, password })
      ).status,
    ).toBe(200);
  });
  it('rotates the browser session on a successful provider switch while preserving its separate admin session', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.180');
    const stateA = await start(agent, 'google');
    await agent.get('/api/v1/auth/google/callback').query({ state: stateA, code: 'test-code' });
    expect(
      (await agent.post('/api/v1/admin/login').send({ email: adminEmail, password })).status,
    ).toBe(200);
    const before = (await agent.get('/api/v1/auth/sessions')).body.data.find(
      (session: { current: boolean }) => session.current,
    );
    const stateB = await start(agent, 'discord');
    expect(
      (await agent.get('/api/v1/auth/discord/callback').query({ state: stateB, code: 'test-code' }))
        .headers.location,
    ).toBe(`${appOrigin}/dashboard`);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(discordEmail);
    expect((await agent.get('/api/v1/admin/me')).body.data.email).toBe(adminEmail);
    expect(await prisma.session.findUnique({ where: { id: before.id } })).toBeNull();
  });
  it('invalidates an in-flight linking transaction on logout and rejects provider mismatch', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.181');
    expect((await agent.post('/api/v1/auth/login').send({ email, password })).status).toBe(200);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const link = await agent.post('/api/v1/auth/discord/link').set('X-CSRF-Token', csrf);
    const state = new URL(link.body.data.url).searchParams.get('state')!;
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf)).status).toBe(204);
    const redis = await (await import('../src/config/redis.js')).ensureRedis();
    expect(await redis.get(`ovelo:oauth:${hashToken(state)}`)).toBeNull();
    expect(
      (
        await agent
          .get('/api/v1/auth/discord/callback')
          .set('Cookie', `ovelo_oauth_state=${state}`)
          .query({ state, code: 'test-code' })
      ).headers.location,
    ).toContain('OAUTH_STATE_INVALID');
    const mismatch = await start(agent, 'google');
    expect(
      (
        await agent
          .get('/api/v1/auth/discord/callback')
          .query({ state: mismatch, code: 'test-code' })
      ).headers.location,
    ).toContain('OAUTH_STATE_INVALID');
  });
  it('reports an unconfigured admin deployment without enumerating individual emails or claiming delivery', async () => {
    const absent = vi.spyOn(prisma.user, 'findFirst').mockResolvedValueOnce(null);
    const missingAdmin = await request(app)
      .post('/api/v1/admin/forgot-password')
      .set('X-Forwarded-For', '198.51.100.176')
      .send({ email: 'unknown@gmail.com' });
    absent.mockRestore();
    expect(missingAdmin.status).toBe(503);
    expect(missingAdmin.body.error.code).toBe('ADMIN_NOT_CONFIGURED');
    vi.mocked(sendPasswordResetEmail).mockRejectedValueOnce(new Error('test SMTP unavailable'));
    const target = await request(app)
      .post('/api/v1/admin/forgot-password')
      .set('X-Forwarded-For', '198.51.100.177')
      .send({ email: adminEmail });
    const mismatch = await request(app)
      .post('/api/v1/admin/forgot-password')
      .set('X-Forwarded-For', '198.51.100.178')
      .send({ email: 'unknown@gmail.com' });
    expect(target.status).toBe(200);
    expect(mismatch.status).toBe(200);
    expect(target.body).toEqual(mismatch.body);
    expect(target.body).toEqual({ data: { accepted: true } });
  });
  it('links Discord only to the authenticated, CSRF-protected initiating session', async () => {
    discordId = (Number(discordId) + 1).toString();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password, ...consent });
    expect((await agent.post('/api/v1/auth/discord/link')).status).toBe(403);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const linked = await agent.post('/api/v1/auth/discord/link').set('X-CSRF-Token', csrf);
    expect(linked.status).toBe(200);
    const state = new URL(linked.body.data.url).searchParams.get('state');
    expect(
      (await agent.get('/api/v1/auth/discord/callback').query({ state, code: 'test-code' })).headers
        .location,
    ).toBe(`${appOrigin}/settings`);
    const fresh = request.agent(app);
    const loginState = await start(fresh, 'discord');
    await fresh
      .get('/api/v1/auth/discord/callback')
      .query({ state: loginState, code: 'test-code' });
    expect((await fresh.get('/api/v1/auth/me')).body.data.user.email).toBe(email);
  });
  it('refuses a link completed from another session of the same user', async () => {
    const first = request.agent(app).set('X-Forwarded-For', '198.51.100.182');
    const second = request.agent(app).set('X-Forwarded-For', '198.51.100.183');
    for (const agent of [first, second])
      expect((await agent.post('/api/v1/auth/login').send({ email, password })).status).toBe(200);
    const csrf = (await first.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const linked = await first.post('/api/v1/auth/discord/link').set('X-CSRF-Token', csrf);
    const state = new URL(linked.body.data.url).searchParams.get('state')!;
    expect(
      (
        await second
          .get('/api/v1/auth/discord/callback')
          .set('Cookie', `ovelo_oauth_state=${state}`)
          .query({ state, code: 'test-code' })
      ).headers.location,
    ).toContain('OAUTH_STATE_INVALID');
  });
  it('rejects invalid passwords and expires/revokes server-side sessions', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.80');
    expect(
      (await agent.post('/api/v1/auth/login').send({ email, password: 'incorrect-password' }))
        .status,
    ).toBe(401);
    expect(
      (await agent.post('/api/v1/auth/login').send({ email, password, ...consent })).status,
    ).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(0) },
    });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect(
      (await agent.post('/api/v1/auth/login').send({ email, password, ...consent })).status,
    ).toBe(200);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('rate limits repeated invalid email logins', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.81');
    const input = { email: `missing-${run}@gmail.com`, password };
    for (let i = 0; i < 10; i++)
      expect((await agent.post('/api/v1/auth/login').send(input)).status).toBe(401);
    const limited = await agent.post('/api/v1/auth/login').send(input);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
  for (const [index, provider] of ['google', 'discord'].entries()) {
    it(`${provider} session persists and logout revokes it`, async () => {
      const agent = request.agent(app).set('X-Forwarded-For', `198.51.100.${100 + index}`);
      const state = await start(agent, provider);
      expect(
        (await agent.get(`/api/v1/auth/${provider}/callback`).query({ state, code: 'test-code' }))
          .headers.location,
      ).toBe(`${appOrigin}/dashboard`);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
      const csrf = await agent.get('/api/v1/auth/csrf');
      expect(
        (await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf.body.data.csrfToken))
          .status,
      ).toBe(204);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    });
    it(`${provider} rejects expired/invalid/replayed state and invalid codes, and handles provider failures`, async () => {
      const agent = request.agent(app).set('X-Forwarded-For', `198.51.100.${90 + index}`);
      const config = await import('../src/config/redis.js');
      const state = await start(agent, provider);
      await (await config.ensureRedis()).pexpire(`ovelo:oauth:${hashToken(state)}`, 1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(
        (await agent.get(`/api/v1/auth/${provider}/callback`).query({ state, code: 'test-code' }))
          .headers.location,
      ).toContain('OAUTH_STATE_INVALID');
      expect(
        (
          await agent
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: 'invalid', code: 'test-code' })
        ).headers.location,
      ).toContain('OAUTH_STATE_INVALID');
      const nextState = await start(agent, provider);
      invalidCode = true;
      expect(
        (
          await agent
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: nextState, code: 'bad-code' })
        ).headers.location,
      ).toContain('OAUTH_FAILED');
      invalidCode = false;
      expect(
        await (await config.ensureRedis()).get(`ovelo:oauth:${hashToken(nextState)}`),
      ).toBeNull();
      expect(
        (
          await agent
            .get(`/api/v1/auth/${provider}/callback`)
            .set('Cookie', `ovelo_oauth_state=${nextState}`)
            .query({ state: nextState, code: 'test-code' })
        ).headers.location,
      ).toContain('OAUTH_STATE_INVALID');
      const timeoutState = await start(agent, provider);
      providerTimeout = true;
      expect(
        (
          await agent
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: timeoutState, code: 'test-code' })
        ).headers.location,
      ).toContain('OAUTH_FAILED');
      providerTimeout = false;
      expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
      const deniedState = await start(agent, provider);
      expect(
        (
          await agent
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: deniedState, error: 'access_denied' })
        ).headers.location,
      ).toContain('OAUTH_STATE_INVALID');
    });
  }
  for (const [index, provider] of ['google', 'discord'].entries()) {
    it(`${provider} administrator linking uses the admin session when a different normal session is present`, async () => {
      googleSubject = `admin-google-${run}`;
      discordId = (Number(discordId) + 10).toString();
      const fresh = request.agent(app).set('X-Forwarded-For', `198.51.100.${160 + index}`);
      const unlinkedState = await start(fresh, provider, true);
      expect(
        (
          await fresh
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: unlinkedState, code: 'test-code' })
        ).headers.location,
      ).toContain('ADMIN_INVITATION_REQUIRED');
      expect((await fresh.get('/api/v1/admin/me')).status).toBe(401);
      const agent = request.agent(app).set('X-Forwarded-For', `198.51.100.${150 + index}`);
      expect(
        (await agent.post('/api/v1/auth/login').send({ email, password, ...consent })).status,
      ).toBe(200);
      expect(
        (await agent.post('/api/v1/admin/login').send({ email: adminEmail, password })).status,
      ).toBe(200);
      const csrf = (await agent.get('/api/v1/admin/csrf')).body.data.csrfToken;
      const linked = await agent
        .post(`/api/v1/admin/providers/${provider}/link`)
        .set('X-CSRF-Token', csrf);
      expect(linked.status).toBe(200);
      const authorization = new URL(linked.body.data.url);
      if (provider === 'google') {
        googleNonce = authorization.searchParams.get('nonce')!;
        googleChallenge = authorization.searchParams.get('code_challenge')!;
      }
      const callback = await agent
        .get(`/api/v1/auth/${provider}/callback`)
        .query({ state: authorization.searchParams.get('state'), code: 'test-code' });
      expect(callback.headers.location).toMatch(
        /^https:\/\/ovelo\.lightsout\.in\/admin\/entry\?ticket=[a-f0-9]{64}$/,
      );
      expect((await agent.get('/api/v1/admin/me')).body.data.email).toBe(adminEmail);
      expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(email);
      const loginState = await start(fresh, provider, true);
      expect(
        (
          await fresh
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: loginState, code: 'test-code' })
        ).headers.location,
      ).toContain('/admin/entry?ticket=');
      expect((await fresh.get('/api/v1/admin/me')).body.data.role).toBe('ADMIN');
      expect((await fresh.get('/api/v1/auth/me')).status).toBe(401);
      await prisma.user.update({ where: { email: adminEmail }, data: { disabledAt: new Date() } });
      const disabledState = await start(fresh, provider, true);
      expect(
        (
          await fresh
            .get(`/api/v1/auth/${provider}/callback`)
            .query({ state: disabledState, code: 'test-code' })
        ).headers.location,
      ).toContain('ACCOUNT_UNAVAILABLE');
      expect((await fresh.get('/api/v1/admin/me')).status).toBe(401);
      await prisma.user.update({ where: { email: adminEmail }, data: { disabledAt: null } });
    });
  }
});
