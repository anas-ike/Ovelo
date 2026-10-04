import { prisma } from '../database/prisma.js';
export const recordActivity = (
  userId: string,
  action: string,
  description: string,
  itemId?: string,
) => prisma.activity.create({ data: { userId, action, description, itemId } });
