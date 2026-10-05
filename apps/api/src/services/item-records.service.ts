import type { z } from 'zod';
import type { warrantySchema, repairSchema } from '@ovelo/validation';
import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';

export async function assertItem(userId: string, itemId: string) {
  const item = await prisma.item.findFirst({ where: { id: itemId, userId, deletedAt: null }, select: { id: true, name: true } });
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  return item;
}
async function assertDocuments(userId: string, itemId: string, ids: string[]) {
  const unique = [...new Set(ids)];
  const count = await prisma.document.count({ where: { id: { in: unique }, itemId, item: { userId, deletedAt: null }, storageObject: { userId, deletedAt: null } } });
  if (count !== unique.length) throw new AppError(404, 'DOCUMENT_NOT_FOUND', 'An attachment is not available for this item.');
  return unique;
}
export async function saveWarranty(userId: string, itemId: string, input: z.infer<typeof warrantySchema>, id?: string) {
  const item = await assertItem(userId, itemId);
  const documentIds = await assertDocuments(userId, itemId, input.documentIds);
  return prisma.$transaction(async tx => {
    if (id && !await tx.warranty.findFirst({ where: { id, itemId, item: { userId, deletedAt: null } }, select: { id: true } }))
      throw new AppError(404, 'RECORD_NOT_FOUND', 'Warranty not found.');
    const data = { startDate: new Date(input.startDate), endDate: new Date(input.endDate), provider: input.provider,
      warrantyNumber: input.warrantyNumber, planType: input.planType, coverage: input.coverage, notes: input.notes, notificationDays: input.notificationDays };
    const record = id ? await tx.warranty.update({ where: { id }, data }) : await tx.warranty.create({ data: { ...data, itemId } });
    await tx.warrantyDocument.deleteMany({ where: { warrantyId: record.id } });
    await tx.warrantyDocument.createMany({ data: documentIds.map(documentId => ({ warrantyId: record.id, documentId })) });
    await tx.activity.create({ data: { userId, itemId, action: id ? 'WARRANTY_UPDATED' : 'WARRANTY_ADDED', description: `${id ? 'Updated' : 'Added'} warranty for ${item.name}` } });
    return record;
  });
}
export async function saveRepair(userId: string, itemId: string, input: z.infer<typeof repairSchema>, id?: string) {
  const item = await assertItem(userId, itemId);
  const documentIds = await assertDocuments(userId, itemId, input.documentIds);
  return prisma.$transaction(async tx => {
    if (id && !await tx.repair.findFirst({ where: { id, itemId, item: { userId, deletedAt: null } }, select: { id: true } }))
      throw new AppError(404, 'RECORD_NOT_FOUND', 'Repair not found.');
    const data = { date: new Date(input.date), problem: input.problem, repairShop: input.repairShop,
      cost: input.cost, currency: input.currency, description: input.description, notes: input.notes };
    const record = id ? await tx.repair.update({ where: { id }, data }) : await tx.repair.create({ data: { ...data, itemId } });
    await tx.repairDocument.deleteMany({ where: { repairId: record.id } });
    await tx.repairDocument.createMany({ data: documentIds.map(documentId => ({ repairId: record.id, documentId })) });
    await tx.activity.create({ data: { userId, itemId, action: id ? 'REPAIR_UPDATED' : 'REPAIR_ADDED', description: `${id ? 'Updated' : 'Added'} repair for ${item.name}` } });
    return record;
  });
}
export async function removeRecord(userId: string, itemId: string, id: string, kind: 'warranty' | 'repair') {
  await assertItem(userId, itemId);
  await prisma.$transaction(async tx => {
    const where = { id, itemId, item: { userId, deletedAt: null } };
    const removed = kind === 'warranty' ? await tx.warranty.deleteMany({ where }) : await tx.repair.deleteMany({ where });
    if (!removed.count) throw new AppError(404, 'RECORD_NOT_FOUND', 'Record not found.');
    await tx.activity.create({ data: { userId, itemId, action: `${kind.toUpperCase()}_DELETED`, description: `Removed ${kind}` } });
  });
}
