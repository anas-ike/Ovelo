import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/database/prisma.js';
import { sendVerificationEmail } from '../src/services/email.service.js';
import { hashToken } from '../src/utils/crypto.js';

// Provider/SMTP boundaries are simulated; sessions, Redis, signatures and DB are real.
vi.mock('../src/services/email.service.js', () => ({ sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn(), sendLoginNotification: vi.fn() }));

describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('production authentication paths', () => {
  let app: Express;
  const run = randomUUID();
  const email = `auth-${run}@gmail.com`;
  const googleEmail = `google-${run}@gmail.com`;
  const discordEmail = `discord-${run}@gmail.com`;
  const password = `test-only-${run}`;
  let discordId = Date.now().toString();
  const appOrigin = 'https://ovelo.lightsout.in';
  let googleNonce = '';
  let badGoogleNonce = false;
  let invalidCode = false;
  let providerTimeout = false;
  let privateKey: CryptoKey;
  let jwk: Awaited<ReturnType<typeof exportJWK>>;
  beforeAll(async () => {
    vi.stubEnv('APP_URL', appOrigin);
    vi.stubEnv('TRUST_PROXY', 'true');
    vi.stubEnv('API_URL', 'https://apiovelo.lightsout.in');
    vi.stubEnv('COOKIE_SECURE','false');
    vi.stubEnv('EMAIL_VERIFICATION_REQUIRED','true');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-google-client');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'test-provider-secret');
    vi.stubEnv('GOOGLE_CALLBACK_URL','https://apiovelo.lightsout.in/api/v1/auth/google/callback');
    vi.stubEnv('DISCORD_CLIENT_ID', 'test-discord-client');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'test-provider-secret');
    vi.stubEnv('DISCORD_CALLBACK_URL','https://apiovelo.lightsout.in/api/v1/auth/discord/callback');
    vi.stubEnv('DISCORD_SCOPE','identify');
    const keys = await generateKeyPair('RS256'); privateKey = keys.privateKey;
    jwk = { ...await exportJWK(keys.publicKey), kid:'test-key', alg:'RS256', use:'sig' };
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const value = String(url);
      if (providerTimeout) throw new DOMException('Test provider timeout', 'TimeoutError');
      if (invalidCode && value.endsWith('/token')) return Response.json({ error: 'invalid_grant' }, { status: 400 });
      if (value === 'https://www.googleapis.com/oauth2/v3/certs') return Response.json({ keys:[jwk] });
      if (value === 'https://oauth2.googleapis.com/token') {
        expect(String(init?.body)).toContain('code_verifier=');
        const jwt = await new SignJWT({ nonce: badGoogleNonce ? 'wrong' : googleNonce, email:googleEmail, email_verified:true, name:'Test owner' }).setProtectedHeader({ alg:'RS256',kid:'test-key' }).setSubject(`google-${run}`).setAudience('test-google-client').setIssuer('https://accounts.google.com').setIssuedAt().setExpirationTime('5m').sign(privateKey);
        return Response.json({ id_token:jwt });
      }
      if (value === 'https://discord.com/api/oauth2/token') {
        expect(String(init?.body)).toContain('grant_type=authorization_code');
        return Response.json({ access_token:'test-access-token' });
      }
      if (value === 'https://discord.com/api/users/@me') return Response.json({ id: discordId, username:'Test Discord owner' });
      throw new Error('Unexpected provider request');
    }));
    app = (await import('../src/app.js')).app;
    await (await import('../src/config/redis.js')).verifySecurityRedis();
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where:{ email:{in:[email,googleEmail,discordEmail]} } });
    await (await import('../src/services/migration.service.js')).storageQueue.close();
    await (await import('../src/config/redis.js')).closeSecurityRedis();
    await prisma.$disconnect(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  async function start(agent: ReturnType<typeof request.agent>, provider: string) {
    const response = await agent.get(`/api/v1/auth/${provider}`);
    expect(response.status).toBe(302);
    const url = new URL(response.headers.location!);
    expect(url.searchParams.get('redirect_uri')).toBe(`https://apiovelo.lightsout.in/api/v1/auth/${provider}/callback`);
    if (provider === 'google') { expect(url.searchParams.get('code_challenge_method')).toBe('S256'); googleNonce = url.searchParams.get('nonce')!; }
    else expect(url.searchParams.get('scope')).toBe('identify');
    return url.searchParams.get('state')!;
  }
  async function verify(agent: ReturnType<typeof request.agent>, targetEmail: string) {
    const call = [...vi.mocked(sendVerificationEmail).mock.calls].reverse().find(([to])=>to===targetEmail);
    expect(call).toBeDefined();
    expect((await agent.post('/api/v1/auth/verify-email').send({token:call![1]})).status).toBe(200);
  }
  it('returns only safe provider capabilities and permits only the configured credentialed origin', async () => {
    const response = await request(app).get('/api/v1/auth/providers').set('Origin', appOrigin);
    expect(response.body).toEqual({data:{google:true,discord:true}});
    expect(response.headers['access-control-allow-origin']).toBe(appOrigin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(JSON.stringify(response.body)).not.toContain('secret');
    const foreign = await request(app).post('/api/v1/auth/login').set('Origin','https://attacker.example').send({email,password});
    expect(foreign.status).toBe(403);
  });
  it('registers/verifies email, persists an opaque session, enforces CSRF and logs out', async () => {
    const agent = request.agent(app);
    expect((await agent.post('/api/v1/auth/register').send({name:'Owner',email,password})).status).toBe(201);
    expect((await agent.post('/api/v1/auth/login').send({email,password})).status).toBe(403);
    await verify(agent,email);
    const login = await agent.post('/api/v1/auth/login').send({email,password});
    expect(login.status).toBe(200);
    expect(String(login.headers['set-cookie'])).toContain('HttpOnly');
    expect(String(login.headers['set-cookie'])).toContain('SameSite=Lax');
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(email);
    expect((await agent.post('/api/v1/auth/logout')).status).toBe(403);
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', 'wrong')).status).toBe(403);
    const csrf = await agent.get('/api/v1/auth/csrf').set('Origin',appOrigin);
    expect(csrf.status).toBe(200); expect(csrf.headers['cache-control']).toBe('no-store');
    expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token',csrf.body.data.csrfToken)).status).toBe(204);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('completes Google signup/login with real JWT validation and rejects state replay', async () => {
    const agent = request.agent(app); const state = await start(agent,'google');
    const callback = await agent.get('/api/v1/auth/google/callback').query({state,code:'test-code',redirect:'https://attacker.example'});
    expect(callback.status).toBe(302); expect(callback.headers.location).toBe(`${appOrigin}/dashboard`);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(googleEmail);
    const replay = await agent.get('/api/v1/auth/google/callback').query({state,code:'test-code'});
    expect(replay.headers.location).toContain('OAUTH_STATE_INVALID');
    const second = request.agent(app); const secondState = await start(second,'google');
    expect((await second.get('/api/v1/auth/google/callback').query({state:secondState,code:'test-code'})).headers.location).toBe(`${appOrigin}/dashboard`);
    expect(await prisma.user.count({where:{email:googleEmail}})).toBe(1);
  });
  it('rejects incorrect Google nonces and mismatched browser state', async () => {
    const agent=request.agent(app); const state=await start(agent,'google'); badGoogleNonce=true;
    expect((await agent.get('/api/v1/auth/google/callback').query({state,code:'test-code'})).headers.location).toContain('OAUTH_FAILED');
    badGoogleNonce=false;
    const state2=await start(agent,'google');
    expect((await request(app).get('/api/v1/auth/google/callback').query({state:state2,code:'test-code'})).headers.location).toContain('OAUTH_STATE_INVALID');
  });
  it('completes identify-only Discord signup through verified email, then signs in directly', async () => {
    const agent=request.agent(app); const state=await start(agent,'discord');
    const callback=await agent.get('/api/v1/auth/discord/callback').query({state,code:'test-code'});
    expect(callback.headers.location).toBe(`${appOrigin}/register?oauth=complete`);
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.get('/api/v1/auth/oauth/pending')).body).toEqual({data:{provider:'discord'}});
    expect((await agent.post('/api/v1/auth/register').send({name:'Discord owner',email:discordEmail,password})).status).toBe(201);
    const state2=await start(agent,'discord');
    expect((await agent.get('/api/v1/auth/discord/callback').query({state:state2,code:'test-code'})).headers.location).toContain('EMAIL_NOT_VERIFIED');
    await verify(agent,discordEmail);
    const state3=await start(agent,'discord');
    expect((await agent.get('/api/v1/auth/discord/callback').query({state:state3,code:'test-code'})).headers.location).toBe(`${appOrigin}/dashboard`);
    expect((await agent.get('/api/v1/auth/me')).body.data.user.email).toBe(discordEmail);
  });
  it('links Discord only to the authenticated, CSRF-protected initiating session', async () => {
    discordId = (Number(discordId)+1).toString();
    const agent=request.agent(app); await agent.post('/api/v1/auth/login').send({email,password});
    expect((await agent.post('/api/v1/auth/discord/link')).status).toBe(403);
    const csrf = (await agent.get('/api/v1/auth/csrf')).body.data.csrfToken;
    const linked=await agent.post('/api/v1/auth/discord/link').set('X-CSRF-Token',csrf);
    expect(linked.status).toBe(200);
    const state=new URL(linked.body.data.url).searchParams.get('state');
    expect((await agent.get('/api/v1/auth/discord/callback').query({state,code:'test-code'})).headers.location).toBe(`${appOrigin}/dashboard`);
    const fresh=request.agent(app); const loginState=await start(fresh,'discord');
    await fresh.get('/api/v1/auth/discord/callback').query({state:loginState,code:'test-code'});
    expect((await fresh.get('/api/v1/auth/me')).body.data.user.email).toBe(email);
  });
  it('rejects invalid passwords and expires/revokes server-side sessions', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.80');
    expect((await agent.post('/api/v1/auth/login').send({ email, password: 'incorrect-password' })).status).toBe(401);
    expect((await agent.post('/api/v1/auth/login').send({ email, password })).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(0) } });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    expect((await agent.post('/api/v1/auth/login').send({ email, password })).status).toBe(200);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
  });
  it('rate limits repeated invalid email logins', async () => {
    const agent = request.agent(app).set('X-Forwarded-For', '198.51.100.81');
    const input = { email: `missing-${run}@gmail.com`, password };
    for (let i = 0; i < 10; i++) expect((await agent.post('/api/v1/auth/login').send(input)).status).toBe(401);
    const limited = await agent.post('/api/v1/auth/login').send(input);
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBeDefined();
  });
  for (const [index, provider] of ['google', 'discord'].entries()) {
    it(`${provider} session persists and logout revokes it`, async () => {
      const agent = request.agent(app).set('X-Forwarded-For', `198.51.100.${100 + index}`);
      const state = await start(agent, provider);
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state, code: 'test-code' })).headers.location).toBe(`${appOrigin}/dashboard`);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(200);
      const csrf = await agent.get('/api/v1/auth/csrf');
      expect((await agent.post('/api/v1/auth/logout').set('X-CSRF-Token', csrf.body.data.csrfToken)).status).toBe(204);
      expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
    });
    it(`${provider} rejects expired/invalid/replayed state and invalid codes, and handles provider failures`, async () => {
      const agent = request.agent(app).set('X-Forwarded-For', `198.51.100.${90 + index}`);
      const config = await import('../src/config/redis.js');
      const state = await start(agent, provider);
      await (await config.ensureRedis()).pexpire(`ovelo:oauth:${hashToken(state)}`, 1);
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state, code: 'test-code' })).headers.location).toContain('OAUTH_STATE_INVALID');
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state: 'invalid', code: 'test-code' })).headers.location).toContain('OAUTH_STATE_INVALID');
      const nextState = await start(agent, provider);
      invalidCode = true;
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state: nextState, code: 'bad-code' })).headers.location).toContain('OAUTH_FAILED');
      invalidCode = false;
      expect(await (await config.ensureRedis()).get(`ovelo:oauth:${hashToken(nextState)}`)).toBeNull();
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).set('Cookie', `ovelo_oauth_state=${nextState}`).query({ state: nextState, code: 'test-code' })).headers.location).toContain('OAUTH_STATE_INVALID');
      const timeoutState = await start(agent, provider);
      providerTimeout = true;
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state: timeoutState, code: 'test-code' })).headers.location).toContain('OAUTH_FAILED');
      providerTimeout = false;
      expect((await agent.get('/api/v1/auth/me')).status).toBe(401);
      const deniedState = await start(agent, provider);
      expect((await agent.get(`/api/v1/auth/${provider}/callback`).query({ state: deniedState, error: 'access_denied' })).headers.location).toContain('OAUTH_STATE_INVALID');
    });
  }
});
