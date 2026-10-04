import argon2 from 'argon2';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { assertEmailAllowed } from './email-policy.service.js';
import { hashToken, randomToken } from '../utils/crypto.js';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';
import { env } from '../config/env.js';
import { destroyAllSessions } from './session.service.js';
import type { Response } from 'express';

const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;
export async function register(input: { name: string; email: string; password: string }) {
  await assertEmailAllowed(input.email);
  if (await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } }))
    throw new AppError(
      400,
      'REGISTRATION_UNAVAILABLE',
      'Unable to create an account with those details.',
    );
  const token = randomToken();
  const free = await prisma.plan.findUnique({ where: { code: 'FREE' }, select: { id: true } });
  if (!free)
    throw new AppError(503, 'PLANS_UNAVAILABLE', 'Registration is temporarily unavailable.');
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
        notificationPreference: { create: {} },
      },
      select: publicUserSelect,
    });
    await tx.subscription.create({ data: { userId: created.id, planId: free.id } });
    if (env.EMAIL_VERIFICATION_REQUIRED)
      await tx.emailVerification.create({
        data: {
          userId: created.id,
          tokenHash: hashToken(token),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
        },
      });
    await tx.securityEvent.create({ data: { userId: created.id, type: 'REGISTRATION' } });
    return created;
  });
  if (env.EMAIL_VERIFICATION_REQUIRED) await sendVerificationEmail(user.email, token);
  return user;
}
export async function verifyEmail(token: string) {
  const verification = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, newEmail: true, expiresAt: true },
  });
  if (!verification || verification.expiresAt < new Date())
    throw new AppError(
      400,
      'VERIFICATION_INVALID',
      'This verification link is invalid or expired.',
    );
  if (
    verification.newEmail &&
    (await prisma.user.findFirst({
      where: { email: verification.newEmail, id: { not: verification.userId } },
      select: { id: true },
    }))
  )
    throw new AppError(400, 'EMAIL_ALREADY_IN_USE', 'That email address is no longer available.');
  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: {
        emailVerifiedAt: new Date(),
        ...(verification.newEmail ? { email: verification.newEmail } : {}),
      },
    }),
    prisma.emailVerification.delete({ where: { id: verification.id } }),
    prisma.session.deleteMany({ where: { userId: verification.userId } }),
    prisma.securityEvent.create({ data: { userId: verification.userId, type: 'EMAIL_VERIFIED' } }),
  ]);
}
export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      passwordHash: true,
      role: true,
      emailVerifiedAt: true,
      disabledAt: true,
      deletedAt: true,
    },
  });
  if (!user?.passwordHash || !(await argon2.verify(user.passwordHash, password)))
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
  if (user.disabledAt || user.deletedAt)
    throw new AppError(403, 'ACCOUNT_UNAVAILABLE', 'This account is unavailable.');
  if (env.EMAIL_VERIFICATION_REQUIRED && !user.emailVerifiedAt)
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before signing in.');
  await prisma.securityEvent.create({ data: { userId: user.id, type: 'LOGIN_SUCCESS' } });
  return user;
}
export async function requestPasswordReset(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  if (!user) return;
  const token = randomToken();
  await prisma.passwordReset.deleteMany({ where: { userId: user.id } });
  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });
  await sendPasswordResetEmail(user.email, token);
  await prisma.securityEvent.create({
    data: { userId: user.id, type: 'PASSWORD_RESET_REQUESTED' },
  });
}
export async function resetPassword(token: string, password: string) {
  const reset = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!reset || reset.expiresAt < new Date())
    throw new AppError(400, 'RESET_INVALID', 'This reset link is invalid or expired.');
  await prisma.$transaction([
    prisma.user.update({
      where: { id: reset.userId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordReset.delete({ where: { id: reset.id } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
    prisma.securityEvent.create({ data: { userId: reset.userId, type: 'PASSWORD_RESET' } }),
  ]);
}
export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
  response: Response,
) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!user.passwordHash || !(await argon2.verify(user.passwordHash, oldPassword)))
    throw new AppError(400, 'PASSWORD_INVALID', 'Current password is incorrect.');
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.securityEvent.create({ data: { userId, type: 'PASSWORD_CHANGED' } });
  await destroyAllSessions(userId, response);
}
export async function requestEmailChange(userId: string, newEmail: string) {
  await assertEmailAllowed(newEmail);
  const existing = await prisma.user.findUnique({
    where: { email: newEmail },
    select: { id: true },
  });
  if (existing && existing.id !== userId)
    throw new AppError(400, 'EMAIL_CHANGE_UNAVAILABLE', 'Unable to use that email address.');
  const token = randomToken();
  await prisma.emailVerification.deleteMany({ where: { userId } });
  await prisma.emailVerification.create({
    data: {
      userId,
      newEmail,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });
  await sendVerificationEmail(newEmail, token);
  await prisma.securityEvent.create({ data: { userId, type: 'EMAIL_CHANGE_REQUESTED' } });
}
