import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { hashToken, randomToken } from '../utils/crypto.js';

export function premiumCodeValue() {
  return `OVL-PREMIUM-${randomToken(10).toUpperCase()}`;
}

export async function createPremiumCode(createdById: string, expiresAt?: Date | null) {
  const plan = await prisma.plan.findUnique({ where: { code: 'PREMIUM' }, select: { id: true, code: true, name: true } });
  if (!plan) throw new AppError(503, 'PLANS_UNAVAILABLE', 'Premium plans are not configured.');
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = premiumCodeValue();
    try {
      const created = await prisma.premiumCode.create({
        data: {
          codeHash: hashToken(code),
          codeLastFour: code.slice(-4),
          planId: plan.id,
          createdById,
          expiresAt: expiresAt ?? undefined,
        },
        select: { id: true, codeLastFour: true, expiresAt: true, createdAt: true, plan: { select: { code: true, name: true } } },
      });
      return { ...created, code };
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
    }
  }
  throw new AppError(503, 'CODE_GENERATION_FAILED', 'A premium code could not be generated. Try again.');
}

export async function listPremiumCodes() {
  return prisma.premiumCode.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      codeLastFour: true,
      redeemedAt: true,
      expiresAt: true,
      createdAt: true,
      plan: { select: { code: true, name: true } },
      redeemedBy: { select: { name: true, email: true } },
    },
  });
}

export async function redeemPremiumCode(userId: string, input: string) {
  const code = input.trim().toUpperCase();
  if (!/^OVL-PREMIUM-[A-F0-9]{20}$/.test(code))
    throw new AppError(400, 'PREMIUM_CODE_INVALID', 'Enter a valid premium code.');
  const codeHash = hashToken(code);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const premium = await tx.plan.findUnique({ where: { code: 'PREMIUM' }, select: { id: true, code: true, name: true } });
    if (!premium) throw new AppError(503, 'PLANS_UNAVAILABLE', 'Premium plans are not configured.');
    const candidate = await tx.premiumCode.findUnique({ where: { codeHash }, select: { id: true, planId: true, expiresAt: true, redeemedAt: true } });
    if (!candidate || candidate.planId !== premium.id || candidate.redeemedAt || (candidate.expiresAt && candidate.expiresAt <= now))
      throw new AppError(400, 'PREMIUM_CODE_INVALID', 'This premium code is invalid, expired, or already used.');
    const consumed = await tx.premiumCode.updateMany({
      where: { id: candidate.id, redeemedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
      data: { redeemedAt: now, redeemedById: userId },
    });
    if (consumed.count !== 1) throw new AppError(400, 'PREMIUM_CODE_INVALID', 'This premium code is invalid, expired, or already used.');
    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: { userId, planId: premium.id, status: 'ACTIVE', provider: 'PREMIUM_CODE', externalId: `premium-code:${candidate.id}` },
      update: { planId: premium.id, status: 'ACTIVE', provider: 'PREMIUM_CODE', externalId: `premium-code:${candidate.id}`, expiresAt: null },
      select: { status: true, expiresAt: true, plan: { select: { code: true, name: true } } },
    });
    await tx.securityEvent.create({ data: { userId, type: 'PREMIUM_CODE_REDEEMED' } });
    return subscription;
  });
}

export async function setPremiumSubscription(userId: string, action: 'ACTIVATE' | 'PAUSE') {
  return prisma.$transaction(async (tx) => {
    const plan = await tx.plan.findUnique({ where: { code: 'PREMIUM' }, select: { id: true, code: true, name: true } });
    if (!plan) throw new AppError(503, 'PLANS_UNAVAILABLE', 'Plans are not configured.');
    const target = await tx.user.findFirst({ where: { id: userId, role: 'USER', deletedAt: null, disabledAt: null }, select: { id: true } });
    if (!target) throw new AppError(404, 'USER_NOT_FOUND', 'Normal user account not found.');
    const subscription = await tx.subscription.upsert({
      where: { userId },
      create: { userId, planId: plan.id, status: action === 'ACTIVATE' ? 'ACTIVE' : 'PAUSED', provider: 'ADMIN_MANUAL' },
      update: { planId: plan.id, status: action === 'ACTIVATE' ? 'ACTIVE' : 'PAUSED', provider: 'ADMIN_MANUAL', expiresAt: null },
      select: { status: true, expiresAt: true, plan: { select: { code: true, name: true } } },
    });
    await tx.securityEvent.create({ data: { userId, type: action === 'ACTIVATE' ? 'PREMIUM_ACTIVATED' : 'PREMIUM_PAUSED' } });
    return subscription;
  });
}
