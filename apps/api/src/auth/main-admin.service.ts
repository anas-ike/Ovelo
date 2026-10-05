import argon2 from 'argon2';
import { adminPassword, email as emailSchema } from '@ovelo/validation';
import { prisma } from '../database/prisma.js';

/** Environment is a bootstrap identity, never an automatic password override. */
export async function provisionMainAdmin() {
  const email = emailSchema.safeParse(process.env.ADMIN_EMAIL);
  if (!email.success) throw new Error('ADMIN_EMAIL must be valid to provision the main administrator');
  const primary = await prisma.user.findFirst({ where: { isPrimaryAdmin: true }, select: { id: true, email: true } });
  if (primary) {
    if (primary.email !== email.data) throw new Error('ADMIN_EMAIL differs from the provisioned primary identity; use owner administration to reconcile it');
    return primary.id;
  }
  const password = adminPassword.safeParse(process.env.ADMIN_PASSWORD);
  if (!password.success) throw new Error('ADMIN_PASSWORD must satisfy the administrator password policy');
  const existing = await prisma.user.findUnique({ where: { email: email.data }, select: { id: true, role: true, disabledAt: true, deletedAt: true } });
  if (existing && (existing.role === 'USER' || existing.disabledAt || existing.deletedAt)) throw new Error('Refusing to elevate or reactivate an existing normal/disabled account');
  return prisma.$transaction(async tx => {
    const user = existing ? await tx.user.update({ where: { id: existing.id }, data: { role: 'OWNER', isPrimaryAdmin: true }, select: { id: true } }) : await tx.user.create({ data: {
      email: email.data, name: 'Ovelo owner', role: 'OWNER', isPrimaryAdmin: true, emailVerifiedAt: new Date(), passwordHash: await argon2.hash(password.data, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3 }),
    }, select: { id: true } });
    await tx.adminAuditLog.create({ data: { adminId: user.id, action: 'PRIMARY_ADMIN_PROVISIONED', targetType: 'User', targetId: user.id, requestId: 'bootstrap' } });
    return user.id;
  });
}
