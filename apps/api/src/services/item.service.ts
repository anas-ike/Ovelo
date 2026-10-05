import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import { randomInventoryCode } from '../utils/crypto.js';
import { getPlanForUser } from './plan.service.js';
import { recordActivity } from './activity.service.js';
import type { ItemInput } from '@ovelo/validation';
import { findItem } from '../repositories/item.repository.js';
import type { ItemStatus } from '@prisma/client';

const ownedResource = async (userId: string, input: ItemInput) => {
  if (
    input.categoryId &&
    !(await prisma.category.findFirst({
      where: { id: input.categoryId, OR: [{ userId }, { userId: null }] },
      select: { id: true },
    }))
  )
    throw new AppError(400, 'INVALID_CATEGORY', 'Category not found.');
  if (
    input.locationId &&
    !(await prisma.location.findFirst({
      where: { id: input.locationId, userId },
      select: { id: true },
    }))
  )
    throw new AppError(400, 'INVALID_LOCATION', 'Location not found.');
  if (
    input.containerId &&
    !(await prisma.container.findFirst({
      where: { id: input.containerId, userId },
      select: { id: true },
    }))
  )
    throw new AppError(400, 'INVALID_CONTAINER', 'Container not found.');
};
const code = async () => {
  for (let i = 0; i < 5; i++) {
    const candidate = randomInventoryCode();
    if (
      !(await prisma.item.findUnique({ where: { inventoryCode: candidate }, select: { id: true } }))
    )
      return candidate;
  }
  throw new AppError(503, 'IDENTIFIER_UNAVAILABLE', 'Could not generate an inventory identifier.');
};
export async function createItem(userId: string, input: ItemInput) {
  await ownedResource(userId, input);
  const plan = await getPlanForUser(userId);
  const inventoryCode = await code();
  const item = await prisma.$transaction(async (tx) => {
    if (plan.itemLimit !== null) {
      const claimed = await tx.user.updateMany({
        where: { id: userId, itemCount: { lt: plan.itemLimit } },
        data: { itemCount: { increment: 1 } },
      });
      if (claimed.count !== 1)
        throw new AppError(403, 'ITEM_LIMIT_REACHED', 'Your plan has reached its item limit.');
    } else await tx.user.update({ where: { id: userId }, data: { itemCount: { increment: 1 } } });
    const created = await tx.item.create({
      data: {
        userId,
        inventoryCode,
        name: input.name,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        locationId: input.locationId ?? null,
        containerId: input.containerId ?? null,
        status: input.status as ItemStatus,
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
        purchasePrice: input.purchasePrice ?? null,
        estimatedValue: input.estimatedValue ?? null,
        currency: input.currency,
        store: input.store ?? null,
        serialNumber: input.serialNumber ?? null,
        modelNumber: input.modelNumber ?? null,
        manufacturer: input.manufacturer ?? null,
        notes: input.notes ?? null,
        condition: input.condition ?? null,
        ...(input.barcode ? { barcodes: { create: { value: input.barcode } } } : {}),
      },
      select: { id: true },
    });
    await tx.activity.create({
      data: {
        userId,
        itemId: created.id,
        action: 'ITEM_CREATED',
        description: `Added ${input.name}`,
      },
    });
    return created;
  });
  return findItem(userId, item.id);
}
export async function updateItem(userId: string, id: string, input: Partial<ItemInput>) {
  const existing = await findItem(userId, id);
  if (!existing) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  if (input.categoryId || input.locationId || input.containerId)
    await ownedResource(userId, {
      ...({
        name: existing.name,
        currency: existing.currency,
        status: existing.status,
      } as ItemInput),
      ...input,
    });
  const updated = await prisma.item.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId ?? null }),
      ...(input.locationId !== undefined && { locationId: input.locationId ?? null }),
      ...(input.containerId !== undefined && { containerId: input.containerId ?? null }),
      ...(input.status !== undefined && { status: input.status as ItemStatus }),
      ...(input.purchaseDate !== undefined && {
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : null,
      }),
      ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice }),
      ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue }),
      ...(input.currency !== undefined && { currency: input.currency }),
      ...(input.store !== undefined && { store: input.store }),
      ...(input.serialNumber !== undefined && { serialNumber: input.serialNumber }),
      ...(input.modelNumber !== undefined && { modelNumber: input.modelNumber }),
      ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.condition !== undefined && { condition: input.condition }),
    },
    select: { id: true, name: true },
  });
  await recordActivity(userId, 'ITEM_UPDATED', `Updated ${updated.name}`, id);
  if (input.locationId !== undefined && input.locationId !== existing.location?.id)
    await recordActivity(userId, 'LOCATION_CHANGED', `Changed location for ${updated.name}`, id);
  return findItem(userId, id);
}
export async function deleteItem(userId: string, id: string) {
  const item = await findItem(userId, id);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  await prisma.$transaction([
    prisma.item.update({ where: { id }, data: { deletedAt: new Date(), status: 'ARCHIVED' } }),
    prisma.user.update({ where: { id: userId }, data: { itemCount: { decrement: 1 } } }),
    prisma.activity.create({
      data: { userId, itemId: id, action: 'ITEM_ARCHIVED', description: `Archived ${item.name}` },
    }),
  ]);
}
export async function sellItem(
  userId: string,
  id: string,
  input: { saleDate: string; salePrice: number; buyerNote?: string | null },
) {
  const item = await findItem(userId, id);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  await prisma.item.update({
    where: { id },
    data: {
      status: 'SOLD',
      saleDate: new Date(input.saleDate),
      salePrice: input.salePrice,
      buyerNote: input.buyerNote ?? null,
    },
  });
  await recordActivity(userId, 'ITEM_SOLD', `Marked ${item.name} as sold`, id);
  return findItem(userId, id);
}
export async function getDashboard(userId: string) {
  const now = new Date();
  const soon = new Date(now.getTime() + 90 * 86400000);
  const year = new Date(now.getFullYear(), 0, 1);
  const plan = await getPlanForUser(userId);
  const [count, purchase, estimated, warranties, repairs, recent, expensive, user] =
    await prisma.$transaction([
      prisma.item.count({ where: { userId, deletedAt: null } }),
      prisma.item.aggregate({ where: { userId, deletedAt: null }, _sum: { purchasePrice: true } }),
      prisma.item.aggregate({ where: { userId, deletedAt: null }, _sum: { estimatedValue: true } }),
      prisma.warranty.findMany({
        where: { item: { userId, deletedAt: null }, endDate: { gte: now, lte: soon } },
        select: {
          id: true,
          endDate: true,
          provider: true,
          item: { select: { id: true, name: true, inventoryCode: true } },
        },
        orderBy: { endDate: 'asc' },
        take: 5,
      }),
      prisma.repair.aggregate({
        where: { item: { userId, deletedAt: null }, date: { gte: year } },
        _count: { _all: true },
        _sum: { cost: true },
      }),
      prisma.activity.findMany({
        where: { userId },
        select: {
          id: true,
          action: true,
          description: true,
          createdAt: true,
          item: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.item.findMany({
        where: { userId, deletedAt: null },
        select: { id: true, name: true, inventoryCode: true, purchasePrice: true, currency: true },
        orderBy: { purchasePrice: 'desc' },
        take: 5,
      }),
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { storageUsedBytes: true, storageReservedBytes: true },
      }),
    ]);
  return {
    stats: {
      itemCount: count,
      purchaseValue: purchase._sum.purchasePrice?.toString() ?? '0',
      estimatedValue: estimated._sum.estimatedValue?.toString() ?? '0',
      warrantiesExpiring: warranties.length,
      repairsThisYear: repairs._count._all,
      repairsCostThisYear: repairs._sum.cost?.toString() ?? '0',
    },
    warranties,
    recent,
    expensive,
    storage: {
      usedBytes: user.storageUsedBytes.toString(),
      reservedBytes: user.storageReservedBytes.toString(),
      limitBytes: plan.storageLimitBytes.toString(),
    },
  };
}
export async function addWarranty(
  userId: string,
  itemId: string,
  input: {
    startDate: string;
    endDate: string;
    provider?: string | null;
    warrantyNumber?: string | null;
    notificationDays: number[];
  },
) {
  const item = await findItem(userId, itemId);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  const warranty = await prisma.warranty.create({
    data: {
      itemId,
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      provider: input.provider ?? null,
      warrantyNumber: input.warrantyNumber ?? null,
      notificationDays: input.notificationDays,
    },
  });
  await recordActivity(userId, 'WARRANTY_ADDED', `Added warranty for ${item.name}`, itemId);
  return warranty;
}
export async function addRepair(
  userId: string,
  itemId: string,
  input: {
    date: string;
    problem: string;
    repairShop?: string | null;
    cost: number;
    currency: string;
    description?: string | null;
  },
) {
  const item = await findItem(userId, itemId);
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  const repair = await prisma.repair.create({
    data: {
      itemId,
      date: new Date(input.date),
      problem: input.problem,
      repairShop: input.repairShop ?? null,
      cost: input.cost,
      currency: input.currency,
      description: input.description ?? null,
    },
  });
  await recordActivity(userId, 'REPAIR_ADDED', `Added repair for ${item.name}`, itemId);
  return repair;
}
