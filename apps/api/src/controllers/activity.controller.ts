import { asyncHandler } from '../utils/async-handler.js';
import { prisma } from '../database/prisma.js';
import { pagination } from '@ovelo/validation';
export const activityController = asyncHandler(async (req, res) => {
  const { page, pageSize } = pagination.parse(req.query);
  const where = { userId: req.auth!.userId };
  const [data, total] = await prisma.$transaction([
    prisma.activity.findMany({
      where,
      select: {
        id: true,
        action: true,
        description: true,
        createdAt: true,
        item: { select: { id: true, name: true, inventoryCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.activity.count({ where }),
  ]);
  res.json({ data: { data, total, page, pageSize } });
});
