import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
export async function getPlanForUser(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: {
      status: true,
      expiresAt: true,
      plan: {
        select: {
          code: true,
          itemLimit: true,
          storageLimitBytes: true,
          entitlements: { select: { feature: true, enabled: true } },
        },
      },
    },
  });
  if (subscription?.status === 'ACTIVE' && (!subscription.expiresAt || subscription.expiresAt > new Date()))
    return subscription.plan;
  const plan = await prisma.plan.findUnique({
    where: { code: 'FREE' },
    select: {
      code: true,
      itemLimit: true,
      storageLimitBytes: true,
      entitlements: { select: { feature: true, enabled: true } },
    },
  });
  if (!plan) throw new AppError(503, 'PLANS_UNAVAILABLE', 'Plans are not configured.');
  return plan;
}
export async function assertFeature(userId: string, feature: string) {
  const plan = await getPlanForUser(userId);
  if (!plan.entitlements.some((e) => e.feature === feature && e.enabled))
    throw new AppError(403, 'FEATURE_REQUIRES_PREMIUM', 'Upgrade your plan to use this feature.');
}
export async function assertStorageAvailable(userId: string, bytes: number) {
  const plan = await getPlanForUser(userId);
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { storageUsedBytes: true, storageReservedBytes: true },
  });
  if (user.storageUsedBytes + user.storageReservedBytes + BigInt(bytes) > plan.storageLimitBytes)
    throw new AppError(
      413,
      'STORAGE_LIMIT_REACHED',
      'This upload would exceed your storage limit.',
    );
}
