import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { randomUUID, createHmac } from 'node:crypto';
import { app } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';
import { hashToken, randomToken } from '../src/utils/crypto.js';
import { provisionMainAdmin } from '../src/auth/main-admin.service.js';
import { env } from '../src/config/env.js';
import { policyVersions } from '@ovelo/validation';

async function pdfFixture() {
  const document = new PDFDocument();
  const chunks: Buffer[] = [];
  document.on('data', (chunk: Buffer) => chunks.push(chunk));
  const complete = new Promise<void>((resolve) => document.on('end', resolve));
  document.text('optional scanner upload test');
  document.end();
  await complete;
  return Buffer.concat(chunks);
}

describe.skipIf(process.env.RUN_DB_TESTS !== 'true')(
  'ownership records and administrator security',
  () => {
    const run = randomUUID();
    const password = `test-password-${run}`;
    const emailA = `records-a-${run}@gmail.com`,
      emailB = `records-b-${run}@gmail.com`,
      ownerEmail = `owner-${run}@gmail.com`,
      secondaryEmail = `secondary-${run}@gmail.com`;
    const a = request.agent(app).set('X-Forwarded-For', '198.51.100.121'),
      b = request.agent(app).set('X-Forwarded-For', '198.51.100.122'),
      owner = request.agent(app).set('X-Forwarded-For', '198.51.100.123');
    let itemId = '',
      documentId = '',
      userA = '',
      ownerId = '',
      csrfA = '',
      csrfOwner = '',
      secondaryId = '',
      locationId = '';
    const warranty = {
      startDate: '2026-01-01T00:00:00Z',
      endDate: '2027-01-01T00:00:00Z',
      provider: 'Coverage provider',
      planType: 'Limited',
      warrantyNumber: 'Test policy',
      coverage: 'Parts',
      notes: 'Test notes',
    };
    const repair = {
      date: '2026-09-01T00:00:00Z',
      problem: 'Replace part',
      repairShop: 'Workshop',
      cost: 15,
      currency: 'USD',
      description: 'Repair details',
      notes: 'Maintenance notes',
    };
    beforeAll(async () => {
      const passwordHash = await argon2.hash(password);
      userA = (
        await prisma.user.create({
          data: { name: 'Test A', email: emailA, passwordHash, emailVerifiedAt: new Date() },
        })
      ).id;
      await prisma.user.create({
        data: { name: 'Test B', email: emailB, passwordHash, emailVerifiedAt: new Date() },
      });
      const previousEmail = process.env.ADMIN_EMAIL,
        previousPassword = process.env.ADMIN_PASSWORD;
      try {
        process.env.ADMIN_EMAIL = ownerEmail;
        process.env.ADMIN_PASSWORD = password;
        ownerId = await provisionMainAdmin();
        expect(await provisionMainAdmin()).toBe(ownerId);
      } finally {
        process.env.ADMIN_EMAIL = previousEmail;
        process.env.ADMIN_PASSWORD = previousPassword;
      }
      expect(
        (
          await a
            .post('/api/v1/auth/login')
            .send({
              email: emailA,
              password,
              termsVersion: policyVersions.terms,
              privacyVersion: policyVersions.privacy,
            })
        ).status,
      ).toBe(200);
      expect(
        (
          await b
            .post('/api/v1/auth/login')
            .send({
              email: emailB,
              password,
              termsVersion: policyVersions.terms,
              privacyVersion: policyVersions.privacy,
            })
        ).status,
      ).toBe(200);
      const adminLogin = await owner.post('/api/v1/admin/login').send({ email: ` ${ownerEmail.toUpperCase()} `, password });
      expect(adminLogin.status).toBe(200);
      expect(adminLogin.body.data.destination).toBe('admin');
      expect(new URL(adminLogin.body.data.url).pathname).toBe('/admin/entry');
      expect(adminLogin.body.data.url).not.toContain('/dashboard');
      expect((await owner.get('/api/v1/admin/me')).body.data.role).toBe('OWNER');
      expect((await owner.get('/api/v1/auth/me')).status).toBe(401);
      csrfA = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken;
      csrfOwner = (await owner.get('/api/v1/admin/csrf')).body.data.csrfToken;
    }, 20000);
    afterAll(async () => {
      if (documentId) await a.delete(`/api/v1/documents/${documentId}`).set('X-CSRF-Token', csrfA);
      await prisma.user.deleteMany({
        where: { email: { in: [emailA, emailB, ownerEmail, secondaryEmail] } },
      });
      await (await import('../src/services/migration.service.js')).storageQueue.close();
      await (await import('../src/config/redis.js')).closeSecurityRedis();
      await prisma.$disconnect();
    });
    it('rejects every unauthenticated admin API and normal-user elevation', async () => {
      for (const path of [
        'me',
        'overview',
        'users',
        'administrators',
        'domains',
        'security-events',
        'audit-logs',
        'background-jobs',
        'subscriptions',
      ])
        expect((await request(app).get(`/api/v1/admin/${path}`)).status).toBe(401);
      expect((await a.get('/api/v1/admin/overview')).status).toBe(401);
      expect((await owner.get('/api/v1/auth/me')).status).toBe(401); // Separate admin session cannot become a user session.
      expect(
        (
          await request(app)
            .post('/api/v1/admin/login')
            .send({ email: ownerEmail, password: 'incorrect' })
        ).status,
      ).toBe(401);
      expect(
        (
          await owner
            .post('/api/v1/admin/administrators')
            .send({ email: secondaryEmail, name: 'Secondary', password })
        ).status,
      ).toBe(403);
    });
    it('creates a located item and securely uploads/lists/downloads its documents', async () => {
      const maps = await a
        .post('/api/v1/inventory/locations/parse-maps')
        .set('X-CSRF-Token', csrfA)
        .send({ url: 'https://www.google.com/maps/place/Test+Office/@29.3,47.9,15z' });
      expect(maps.status).toBe(200);
      const location = await a
        .post('/api/v1/inventory/locations')
        .set('X-CSRF-Token', csrfA)
        .send({ ...maps.body.data, type: 'OFFICE' });
      expect(location.status).toBe(201);
      locationId = location.body.data.id;
      const created = await a
        .post('/api/v1/items')
        .set('X-CSRF-Token', csrfA)
        .send({ name: 'Record test camera', condition: 'Good', locationId, currency: 'USD' });
      expect(created.status).toBe(201);
      itemId = created.body.data.id;
      const image = await sharp({
        create: { width: 30, height: 30, channels: 3, background: 'white' },
      })
        .png()
        .toBuffer();
      const denied = await a
        .post(`/api/v1/items/${itemId}/documents`)
        .set('X-CSRF-Token', csrfA)
        .attach('file', image, 'coverage.png');
      expect(denied.status).toBe(428);
      expect(await prisma.document.count({ where: { itemId } })).toBe(0);
      expect(
        (
          await a
            .post(`/api/v1/items/${itemId}/documents`)
            .set('X-CSRF-Token', csrfA)
            .set('X-Upload-Processing-Version', 'obsolete')
            .attach('file', image, 'coverage.png')
        ).status,
      ).toBe(428);
      const uploaded = await a
        .post(`/api/v1/items/${itemId}/documents`)
        .set('X-CSRF-Token', csrfA)
        .set('X-Upload-Processing-Version', policyVersions.uploadProcessing)
        .field('kind', 'WARRANTY')
        .attach('file', image, 'coverage.png');
      expect(uploaded.status).toBe(201);
      documentId = uploaded.body.data.id;
      expect(
        await prisma.securityEvent.findFirst({
          where: { userId: userA, type: 'UPLOAD_ACCEPTED_SCANNER_NOT_CONFIGURED' },
        }),
      ).not.toBeNull();
      expect((await a.get('/api/v1/auth/policies')).body.data.accepted.uploadProcessing).toBe(true);
      expect((await a.get(`/api/v1/items/${itemId}/documents`)).body.data).toHaveLength(1);
      expect(
        (await a.get('/api/v1/documents')).body.data.some(
          (d: { id: string }) => d.id === documentId,
        ),
      ).toBe(true);
      const download = await a.get(`/api/v1/documents/${documentId}/download`);
      expect(download.status).toBe(200);
      expect(download.headers['content-type']).toContain('image/webp');
      expect(
        (await a.get('/api/v1/inventory/locations')).body.data.find(
          (l: { id: string }) => l.id === locationId,
        )._count.items,
      ).toBe(1);
      expect(
        (await b.get('/api/v1/inventory/locations')).body.data.some(
          (l: { id: string }) => l.id === locationId,
        ),
      ).toBe(false);
      const documentCount = await prisma.document.count({ where: { itemId } });
      const storageCount = await prisma.storageObject.count({ where: { userId: userA, deletedAt: null } });
      expect(
        (
          await a
            .post(`/api/v1/items/${itemId}/documents`)
            .set('X-CSRF-Token', csrfA)
            .attach('file', Buffer.from('executable'), 'unsafe.js')
        ).status,
      ).toBe(415);
      expect(await prisma.document.count({ where: { itemId } })).toBe(documentCount);
      expect(await prisma.storageObject.count({ where: { userId: userA, deletedAt: null } })).toBe(storageCount);
      expect(
        await prisma.securityEvent.findFirst({
          where: { userId: userA, type: 'UPLOAD_REJECTED_VALIDATION_FAILED' },
        }),
      ).not.toBeNull();
      const pdf = await pdfFixture();
      const pdfUpload = await a
        .post(`/api/v1/items/${itemId}/documents`)
        .set('X-CSRF-Token', csrfA)
        .field('kind', 'OTHER')
        .attach('file', pdf, 'manual.pdf');
      expect(pdfUpload.status).toBe(201);
      expect(pdfUpload.body.data.storageObject.mimeType).toBe('application/pdf');
      expect(
        await prisma.securityEvent.findFirst({
          where: { userId: userA, type: 'UPLOAD_ACCEPTED_SCANNER_NOT_CONFIGURED' },
        }),
      ).not.toBeNull();
    });
    it('persists warranty/repair CRUD and exact activity while rejecting IDOR attachments and record IDs', async () => {
      const w = await a
        .post(`/api/v1/items/${itemId}/warranties`)
        .set('X-CSRF-Token', csrfA)
        .send({ ...warranty, documentIds: [documentId] });
      expect(w.status).toBe(201);
      const r = await a
        .post(`/api/v1/items/${itemId}/repairs`)
        .set('X-CSRF-Token', csrfA)
        .send({ ...repair, documentIds: [documentId] });
      expect(r.status).toBe(201);
      expect(
        (
          await a
            .patch(`/api/v1/items/${itemId}/warranties/${w.body.data.id}`)
            .set('X-CSRF-Token', csrfA)
            .send({ ...warranty, provider: 'Updated provider', documentIds: [documentId] })
        ).status,
      ).toBe(200);
      expect(
        (
          await a
            .patch(`/api/v1/items/${itemId}/repairs/${r.body.data.id}`)
            .set('X-CSRF-Token', csrfA)
            .send({ ...repair, cost: 20 })
        ).status,
      ).toBe(200);
      const csrfB = (await b.get('/api/v1/auth/csrf')).body.data.csrfToken;
      for (const path of [
        `/items/${itemId}`,
        `/items/${itemId}/documents`,
        `/items/${itemId}/activity`,
        `/documents/${documentId}/download`,
      ])
        expect((await b.get(`/api/v1${path}`)).status).toBe(404);
      expect(
        (
          await b
            .delete(`/api/v1/items/${itemId}/warranties/${w.body.data.id}`)
            .set('X-CSRF-Token', csrfB)
        ).status,
      ).toBe(404);
      expect(
        (
          await b
            .patch(`/api/v1/items/${itemId}/repairs/${r.body.data.id}`)
            .set('X-CSRF-Token', csrfB)
            .send(repair)
        ).status,
      ).toBe(404);
      const other = await b
        .post('/api/v1/items')
        .set('X-CSRF-Token', csrfB)
        .send({ name: 'Other owner item' });
      expect(
        (
          await b
            .post(`/api/v1/items/${other.body.data.id}/warranties`)
            .set('X-CSRF-Token', csrfB)
            .send({ ...warranty, documentIds: [documentId] })
        ).status,
      ).toBe(404);
      expect(
        (
          await a
            .post(`/api/v1/items/${itemId}/warranties`)
            .set('X-CSRF-Token', csrfA)
            .send({ ...warranty, endDate: '2025-01-01T00:00:00Z' })
        ).status,
      ).toBe(400);
      expect(
        (
          await a
            .delete(`/api/v1/items/${itemId}/warranties/${w.body.data.id}`)
            .set('X-CSRF-Token', csrfA)
        ).status,
      ).toBe(204);
      expect(
        (
          await a
            .delete(`/api/v1/items/${itemId}/repairs/${r.body.data.id}`)
            .set('X-CSRF-Token', csrfA)
        ).status,
      ).toBe(204);
      const actions = (await a.get(`/api/v1/items/${itemId}/activity`)).body.data.map(
        (x: { action: string }) => x.action,
      );
      for (const action of [
        'ITEM_CREATED',
        'DOCUMENT_UPLOADED',
        'WARRANTY_ADDED',
        'WARRANTY_UPDATED',
        'WARRANTY_DELETED',
        'REPAIR_ADDED',
        'REPAIR_UPDATED',
        'REPAIR_DELETED',
      ])
        expect(actions).toContain(action);
    });
    it('generates real PNG/SVG labels and resolves only active authorized opaque tokens', async () => {
      const qr = await a.post(`/api/v1/items/${itemId}/qr`).set('X-CSRF-Token', csrfA).send({});
      expect(qr.status).toBe(201);
      const barcode = await a
        .post(`/api/v1/items/${itemId}/barcode`)
        .set('X-CSRF-Token', csrfA)
        .send({});
      expect(barcode.status).toBe(201);
      expect(barcode.body.data.value).not.toContain(itemId);
      for (const kind of ['qr', 'barcode']) {
        const png = await a.get(`/api/v1/items/${itemId}/${kind}`);
        expect(png.status).toBe(200);
        expect(png.headers['content-type']).toContain('image/png');
        const svg = await a.get(`/api/v1/items/${itemId}/${kind}?format=svg`);
        expect(svg.status).toBe(200);
        expect(Buffer.isBuffer(svg.body) ? svg.body.toString() : svg.text).toContain('<svg');
      }
      expect(
        (
          await a
            .post('/api/v1/codes/resolve')
            .set('X-CSRF-Token', csrfA)
            .send({ code: barcode.body.data.value })
        ).body.data.itemId,
      ).toBe(itemId);
      expect((await a.get(`/api/v1/qr/${qr.body.data.value}`)).body.data.itemId).toBe(itemId);
      const csrfB = (await b.get('/api/v1/auth/csrf')).body.data.csrfToken;
      const forbidden = await b
        .post('/api/v1/codes/resolve')
        .set('X-CSRF-Token', csrfB)
        .send({ code: barcode.body.data.value });
      const invalid = await b
        .post('/api/v1/codes/resolve')
        .set('X-CSRF-Token', csrfB)
        .send({ code: 'missing' });
      expect(forbidden.status).toBe(404);
      expect(forbidden.body.error.message).toBe(invalid.body.error.message);
      await prisma.qrCode.update({ where: { itemId }, data: { expiresAt: new Date(0) } });
      expect((await a.get(`/api/v1/qr/${qr.body.data.value}`)).status).toBe(404);
      expect((await a.delete(`/api/v1/items/${itemId}/qr`).set('X-CSRF-Token', csrfA)).status).toBe(
        204,
      );
    });
    it('manages secondary admins, revokes privilege sessions, and protects the main owner', async () => {
      const created = await owner
        .post('/api/v1/admin/administrators')
        .set('X-CSRF-Token', csrfOwner)
        .send({ email: secondaryEmail, name: 'Secondary', password });
      expect(created.status).toBe(201);
      secondaryId = created.body.data.id;
      const secondary = request.agent(app).set('X-Forwarded-For', '198.51.100.124');
      expect(
        (await secondary.post('/api/v1/admin/login').send({ email: secondaryEmail, password }))
          .status,
      ).toBe(200);
      const csrfSecondary = (await secondary.get('/api/v1/admin/csrf')).body.data.csrfToken;
      expect((await secondary.get('/api/v1/admin/overview')).status).toBe(200);
      expect((await secondary.get('/api/v1/admin/administrators')).status).toBe(403);
      expect(
        (
          await secondary
            .patch(`/api/v1/admin/administrators/${secondaryId}`)
            .set('X-CSRF-Token', csrfSecondary)
            .send({ role: 'OWNER' })
        ).status,
      ).toBe(403);
      expect(
        (
          await owner
            .delete(`/api/v1/admin/administrators/${ownerId}`)
            .set('X-CSRF-Token', csrfOwner)
        ).status,
      ).toBe(403);
      expect(
        (
          await owner
            .patch(`/api/v1/admin/administrators/${secondaryId}`)
            .set('X-CSRF-Token', csrfOwner)
            .send({ disabled: true })
        ).status,
      ).toBe(200);
      expect((await secondary.get('/api/v1/admin/me')).status).toBe(401);
      expect(
        (await secondary.post('/api/v1/admin/login').send({ email: secondaryEmail, password }))
          .status,
      ).toBe(401);
      expect(
        (
          await owner
            .patch(`/api/v1/admin/administrators/${secondaryId}`)
            .set('X-CSRF-Token', csrfOwner)
            .send({ disabled: false, role: 'OWNER' })
        ).status,
      ).toBe(200);
      const logs = (await owner.get('/api/v1/admin/audit-logs')).body.data;
      expect(logs.some((l: { action: string }) => l.action === 'ADMIN_CREATED_OR_INVITED')).toBe(
        true,
      );
      expect(JSON.stringify(logs)).not.toContain(password);
      expect(
        (
          await owner
            .delete(`/api/v1/admin/administrators/${secondaryId}`)
            .set('X-CSRF-Token', csrfOwner)
        ).status,
      ).toBe(204);
    });
    it('paginates and filters administrator records with bounded input', async () => {
      const page = await owner.get(`/api/v1/admin/users?q=${encodeURIComponent(run)}&pageSize=1`);
      expect(page.status).toBe(200);
      expect(page.body.data).toHaveLength(1);
      expect(page.body.pagination.total).toBeGreaterThan(1);
      const next = await owner.get(
        `/api/v1/admin/users?q=${encodeURIComponent(run)}&pageSize=1&page=2`,
      );
      expect(next.body.data).toHaveLength(1);
      expect(next.body.data[0].id).not.toBe(page.body.data[0].id);
      expect((await owner.get('/api/v1/admin/users?page=-1')).status).toBe(400);
      expect((await owner.get('/api/v1/admin/audit-logs?pageSize=101')).status).toBe(400);
    });
    it('requires primary-owner reauthentication and revokes disabled normal-user sessions', async () => {
      expect(
        (
          await owner
            .patch('/api/v1/admin/primary-profile')
            .set('X-CSRF-Token', csrfOwner)
            .send({ name: 'Updated owner', currentPassword: 'incorrect' })
        ).status,
      ).toBe(403);
      expect(
        (
          await owner
            .patch('/api/v1/admin/primary-profile')
            .set('X-CSRF-Token', csrfOwner)
            .send({ name: 'Updated owner', email: ownerEmail, currentPassword: password })
        ).body.data,
      ).toEqual({ updated: true, verificationRequired: false });
      expect((await owner.get('/api/v1/admin/me')).body.data.name).toBe('Updated owner');
      expect(
        (
          await owner
            .patch(`/api/v1/admin/users/${ownerId}`)
            .set('X-CSRF-Token', csrfOwner)
            .send({ disabled: true })
        ).status,
      ).toBe(404);
      expect(
        (
          await owner
            .patch(`/api/v1/admin/users/${userA}`)
            .set('X-CSRF-Token', csrfOwner)
            .send({ disabled: true })
        ).status,
      ).toBe(200);
      expect((await a.get('/api/v1/auth/me')).status).toBe(401);
      expect(
        (
          await owner
            .patch(`/api/v1/admin/users/${userA}`)
            .set('X-CSRF-Token', csrfOwner)
            .send({ disabled: false })
        ).status,
      ).toBe(200);
      expect(
        (
          await a
            .post('/api/v1/auth/login')
            .send({
              email: emailA,
              password,
              termsVersion: policyVersions.terms,
              privacyVersion: policyVersions.privacy,
            })
        ).status,
      ).toBe(200);
      csrfA = (await a.get('/api/v1/auth/csrf')).body.data.csrfToken;
    });
    it('redeems the web gate once and rejects it after administrator logout', async () => {
      const url = (await owner.post('/api/v1/admin/entry').set('X-CSRF-Token', csrfOwner)).body.data
        .url;
      const ticket = new URL(url).searchParams.get('ticket')!;
      const signature = (action: string, value: string) =>
        createHmac('sha256', env.SESSION_SECRET)
          .update(`admin-gate:${action}:${value}`)
          .digest('hex');
      expect(
        (await request(app).post('/api/v1/admin/gate/redeem').send({ value: ticket })).status,
      ).toBe(401);
      const gate = await request(app)
        .post('/api/v1/admin/gate/redeem')
        .set('x-ovelo-gate-signature', signature('redeem', ticket))
        .send({ value: ticket });
      expect(gate.status).toBe(200);
      expect(
        (
          await request(app)
            .post('/api/v1/admin/gate/redeem')
            .set('x-ovelo-gate-signature', signature('redeem', ticket))
            .send({ value: ticket })
        ).status,
      ).toBe(401);
      expect((await owner.post('/api/v1/admin/logout').set('X-CSRF-Token', csrfOwner)).status).toBe(
        204,
      );
      const value = gate.body.data.gate;
      expect(
        (
          await request(app)
            .post('/api/v1/admin/gate/validate')
            .set('x-ovelo-gate-signature', signature('validate', value))
            .send({ value })
        ).status,
      ).toBe(401);
    });
    it('consumes admin reset tickets once, enforces policy and revokes every session', async () => {
      const token = randomToken();
      await prisma.passwordReset.create({
        data: {
          userId: ownerId,
          tokenHash: hashToken(token),
          admin: true,
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      expect(
        (await request(app).post('/api/v1/auth/reset-password').send({ token, password })).status,
      ).toBe(400);
      expect(
        (
          await request(app)
            .post('/api/v1/admin/reset-password')
            .send({ token, password: 'short-reset-123' })
        ).status,
      ).toBe(400);
      expect(
        (await request(app).post('/api/v1/admin/reset-password').send({ token, password })).status,
      ).toBe(200);
      expect(
        (await request(app).post('/api/v1/admin/reset-password').send({ token, password })).status,
      ).toBe(400);
      expect(await prisma.session.count({ where: { userId: ownerId } })).toBe(0);
      expect(await prisma.user.findUnique({ where: { id: userA } })).toBeTruthy();
    });
  },
);
