import type { Prisma } from '@prisma/client';
import { prisma } from '../database/prisma.js';
import type { ItemSearch } from '@ovelo/validation';

export const itemSelect = {
  id: true,
  inventoryCode: true,
  name: true,
  description: true,
  status: true,
  purchaseDate: true,
  purchasePrice: true,
  estimatedValue: true,
  currency: true,
  store: true,
  serialNumber: true,
  modelNumber: true,
  manufacturer: true,
  notes: true,
  saleDate: true,
  salePrice: true,
  buyerNote: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, icon: true } },
  location: { select: { id: true, name: true } },
  container: { select: { id: true, name: true } },
  warranties: {
    select: { id: true, startDate: true, endDate: true, provider: true, warrantyNumber: true },
    orderBy: { endDate: 'asc' as const },
  },
  _count: { select: { documents: true, repairs: true } },
} satisfies Prisma.ItemSelect;
export async function findItems(userId: string, filters: ItemSearch) {
  const where: Prisma.ItemWhereInput = {
    userId,
    deletedAt: null,
    status: filters.status,
    categoryId: filters.categoryId,
    locationId: filters.locationId,
  };
  if (filters.q)
    where.OR = [
      { name: { contains: filters.q, mode: 'insensitive' } },
      { manufacturer: { contains: filters.q, mode: 'insensitive' } },
      { modelNumber: { contains: filters.q, mode: 'insensitive' } },
      { serialNumber: { contains: filters.q, mode: 'insensitive' } },
      { store: { contains: filters.q, mode: 'insensitive' } },
      { notes: { contains: filters.q, mode: 'insensitive' } },
      { inventoryCode: { contains: filters.q, mode: 'insensitive' } },
      { category: { name: { contains: filters.q, mode: 'insensitive' } } },
      { location: { name: { contains: filters.q, mode: 'insensitive' } } },
    ];
  if (filters.minPrice !== undefined || filters.maxPrice !== undefined)
    where.purchasePrice = { gte: filters.minPrice, lte: filters.maxPrice };
  if (filters.warranty) {
    const now = new Date();
    const soon = new Date(now.getTime() + 90 * 86400000);
    where.warranties =
      filters.warranty === 'active'
        ? { some: { endDate: { gt: soon } } }
        : filters.warranty === 'expiring'
          ? { some: { endDate: { gte: now, lte: soon } } }
          : { some: { endDate: { lt: now } } };
  }
  const orderBy: Prisma.ItemOrderByWithRelationInput =
    filters.sort === 'name'
      ? { name: 'asc' }
      : filters.sort === 'price'
        ? { purchasePrice: 'desc' }
        : filters.sort === 'updated'
          ? { updatedAt: 'desc' }
          : { createdAt: 'desc' };
  const [data, total] = await prisma.$transaction([
    prisma.item.findMany({
      where,
      select: itemSelect,
      orderBy,
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.item.count({ where }),
  ]);
  return { data, total, page: filters.page, pageSize: filters.pageSize };
}
export async function findItem(userId: string, id: string) {
  return prisma.item.findFirst({ where: { id, userId, deletedAt: null }, select: itemSelect });
}
