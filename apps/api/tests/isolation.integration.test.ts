import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { app } from '../src/app.js';
import { prisma } from '../src/database/prisma.js';

const enabled = process.env.RUN_DB_TESTS === 'true';
describe.skipIf(!enabled)('resource isolation', () => {
  let firstId = '';
  let itemId = '';
  const firstEmail = `isolation-a-${Date.now()}@gmail.com`;
  const secondEmail = `isolation-b-${Date.now()}@gmail.com`;
  beforeAll(async () => {
    const passwordHash = await argon2.hash('isolation-test-password-123', {
      type: argon2.argon2id,
    });
    const plan = await prisma.plan.findUniqueOrThrow({
      where: { code: 'FREE' },
      select: { id: true },
    });
    const first = await prisma.user.create({
      data: {
        email: firstEmail,
        name: 'Isolation A',
        passwordHash,
        emailVerifiedAt: new Date(),
        subscription: { create: { planId: plan.id } },
        notificationPreference: { create: {} },
      },
      select: { id: true },
    });
    await prisma.user.create({
      data: {
        email: secondEmail,
        name: 'Isolation B',
        passwordHash,
        emailVerifiedAt: new Date(),
        subscription: { create: { planId: plan.id } },
        notificationPreference: { create: {} },
      },
    });
    firstId = first.id;
    const item = await prisma.item.create({
      data: {
        userId: first.id,
        inventoryCode: `OVL-TEST${Date.now().toString(36).toUpperCase()}`,
        name: 'Private camera',
      },
      select: { id: true },
    });
    itemId = item.id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [firstEmail, secondEmail] } } });
    await prisma.$disconnect();
  });
  it('does not allow another user to read an item by identifier', async () => {
    const agent = request.agent(app);
    const login = await agent
      .post('/api/v1/auth/login')
      .send({ email: secondEmail, password: 'isolation-test-password-123' });
    expect(login.status).toBe(200);
    const response = await agent.get(`/api/v1/items/${itemId}`);
    expect(response.status).toBe(404);
  });
  it('does not allow a normal session to enter admin routes', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/v1/auth/login')
      .send({ email: firstEmail, password: 'isolation-test-password-123' });
    const response = await agent.get('/api/v1/admin/overview');
    expect(response.status).toBe(401); // A normal user cookie is not an administrator session.
    expect(firstId).toBeTruthy();
  });
});
