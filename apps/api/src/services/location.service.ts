import { prisma } from '../database/prisma.js';
import { AppError } from '../middleware/error.js';
import type { z } from 'zod';
import type { locationSchema } from '@ovelo/validation';
import { validateMapsUrl } from './maps.service.js';
type LocationInput = z.infer<typeof locationSchema>;
async function assertParent(userId: string, parentId: string | null | undefined) {
  if (
    parentId &&
    !(await prisma.location.findFirst({ where: { id: parentId, userId }, select: { id: true } }))
  )
    throw new AppError(400, 'INVALID_PARENT', 'Parent location not found.');
}
export const listLocations = (userId: string) =>
  prisma.location.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      address: true, mapsUrl: true, latitude: true, longitude: true,
      items: { where: { userId, deletedAt: null }, select: { id: true, name: true, status: true } },
      _count: { select: { items: { where: { userId, deletedAt: null } }, children: true } },
    },
    orderBy: { name: 'asc' },
  });
export async function createLocation(userId: string, input: LocationInput) {
  await assertParent(userId, input.parentId);
  return prisma.location.create({
    data: { ...input, userId, mapsUrl: input.mapsUrl ? validateMapsUrl(input.mapsUrl).toString() : null, parentId: input.parentId ?? null },
    select: { id: true, name: true, type: true, parentId: true, address: true, mapsUrl: true, latitude: true, longitude: true },
  });
}
export async function deleteLocation(userId: string, id: string) {
  const location = await prisma.location.findFirst({ where: { id, userId }, select: { id: true } });
  if (!location) throw new AppError(404, 'LOCATION_NOT_FOUND', 'Location not found.');
  await prisma.location.delete({ where: { id } });
}
export const listCategories = (userId: string) =>
  prisma.category.findMany({
    where: { OR: [{ userId }, { userId: null }] },
    select: { id: true, name: true, icon: true, userId: true },
    orderBy: { name: 'asc' },
  });
export async function createCategory(userId: string, name: string, icon: string) {
  return prisma.category.create({
    data: { userId, name, icon },
    select: { id: true, name: true, icon: true },
  });
}

async function assertContainerParent(
  userId: string,
  parentId: string | null | undefined,
  selfId?: string,
) {
  if (!parentId) return;
  let current = parentId;
  for (let i = 0; i < 100 && current; i++) {
    if (current === selfId)
      throw new AppError(400, 'CONTAINER_CYCLE', 'Containers cannot contain themselves.');
    const node = await prisma.container.findFirst({
      where: { id: current, userId },
      select: { parentId: true },
    });
    if (!node) throw new AppError(400, 'INVALID_PARENT', 'Parent container not found.');
    current = node.parentId ?? '';
  }
  if (current) throw new AppError(400, 'CONTAINER_DEPTH', 'Container nesting is too deep.');
}
export const listContainers = (userId: string) =>
  prisma.container.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
      locationId: true,
      parentId: true,
      _count: { select: { items: true, children: true } },
    },
    orderBy: { name: 'asc' },
  });
export async function createContainer(
  userId: string,
  input: {
    name: string;
    locationId?: string | null;
    parentId?: string | null;
    description?: string | null;
  },
) {
  if (
    input.locationId &&
    !(await prisma.location.findFirst({
      where: { id: input.locationId, userId },
      select: { id: true },
    }))
  )
    throw new AppError(400, 'INVALID_LOCATION', 'Location not found.');
  await assertContainerParent(userId, input.parentId);
  return prisma.container.create({
    data: {
      userId,
      name: input.name,
      description: input.description ?? null,
      locationId: input.locationId ?? null,
      parentId: input.parentId ?? null,
    },
    select: { id: true, name: true, description: true, locationId: true, parentId: true },
  });
}
