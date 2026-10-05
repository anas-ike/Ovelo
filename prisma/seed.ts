import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { provisionMainAdmin } from '../apps/api/src/auth/main-admin.service.js';

const prisma = new PrismaClient();
async function main() {
  for (const plan of [
    {
      code: 'FREE',
      name: 'Free',
      itemLimit: Number(process.env.FREE_MAX_ITEMS ?? 100),
      storageLimitBytes: BigInt(process.env.FREE_MAX_STORAGE_BYTES ?? 524288000),
    },
    {
      code: 'PREMIUM',
      name: 'Premium',
      itemLimit: Number(process.env.PREMIUM_MAX_ITEMS ?? 0) || null,
      storageLimitBytes: BigInt(process.env.PREMIUM_MAX_STORAGE_BYTES ?? 21474836480),
    },
  ]) {
    const saved = await prisma.plan.upsert({
      where: { code: plan.code },
      create: plan,
      update: plan,
    });
    for (const feature of [
      'inventory',
      'documents',
      'qr',
      ...(plan.code === 'PREMIUM' ? ['reports', 'containers', 'advanced-history'] : []),
    ]) {
      await prisma.entitlement.upsert({
        where: { planId_feature: { planId: saved.id, feature } },
        create: { planId: saved.id, feature },
        update: { enabled: true },
      });
    }
  }
  for (const [name, icon] of [
    ['Electronics', 'laptop'],
    ['Furniture', 'armchair'],
    ['Appliances', 'refrigerator'],
    ['Clothing & accessories', 'watch'],
    ['Tools & equipment', 'wrench'],
    ['Collectibles', 'gem'],
    ['Other', 'box'],
  ]) {
    if (!(await prisma.category.findFirst({ where: { name, userId: null } })))
      await prisma.category.create({ data: { name: name!, icon } });
  }
  if (process.env.ADMIN_PASSWORD) {
    await provisionMainAdmin();
  }
  console.info('Ovelo plans and system categories seeded. No sample inventory created.');
}
main().finally(() => prisma.$disconnect());
