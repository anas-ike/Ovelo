import {
  itemSearchSchema,
  itemSchema,
  itemUpdateSchema,
  saleSchema,
  warrantySchema,
  repairSchema,
} from '@ovelo/validation';
import { asyncHandler } from '../utils/async-handler.js';
import {
  createItem,
  deleteItem,
  getDashboard,
  updateItem,
  sellItem,
} from '../services/item.service.js';
import { findItem, findItems } from '../repositories/item.repository.js';
import { AppError } from '../middleware/error.js';
import { saveWarranty, saveRepair, removeRecord, assertItem } from '../services/item-records.service.js';
import { prisma } from '../database/prisma.js';
export const listItems = asyncHandler(async (req, res) =>
  res.json({ data: await findItems(req.auth!.userId, itemSearchSchema.parse(req.query)) }),
);
export const getItem = asyncHandler(async (req, res) => {
  const item = await findItem(req.auth!.userId, String(req.params.id));
  if (!item) throw new AppError(404, 'ITEM_NOT_FOUND', 'Item not found.');
  res.json({ data: item });
});
export const createItemController = asyncHandler(async (req, res) =>
  res.status(201).json({ data: await createItem(req.auth!.userId, itemSchema.parse(req.body)) }),
);
export const updateItemController = asyncHandler(async (req, res) =>
  res.json({
    data: await updateItem(
      req.auth!.userId,
      String(req.params.id),
      itemUpdateSchema.parse(req.body),
    ),
  }),
);
export const deleteItemController = asyncHandler(async (req, res) => {
  await deleteItem(req.auth!.userId, String(req.params.id));
  res.status(204).send();
});
export const sellItemController = asyncHandler(async (req, res) =>
  res.json({
    data: await sellItem(req.auth!.userId, String(req.params.id), saleSchema.parse(req.body)),
  }),
);
export const dashboardController = asyncHandler(async (req, res) =>
  res.json({ data: await getDashboard(req.auth!.userId) }),
);
export const warrantyController = asyncHandler(async (req, res) =>
  res.status(201).json({
    data: await saveWarranty(
      req.auth!.userId,
      String(req.params.id),
      warrantySchema.parse(req.body),
    ),
  }),
);
export const repairController = asyncHandler(async (req, res) =>
  res.status(201).json({
    data: await saveRepair(req.auth!.userId, String(req.params.id), repairSchema.parse(req.body)),
  }),
);
export const updateWarrantyController = asyncHandler(async (req, res) => res.json({ data: await saveWarranty(req.auth!.userId, String(req.params.id), warrantySchema.parse(req.body), String(req.params.recordId)) }));
export const updateRepairController = asyncHandler(async (req, res) => res.json({ data: await saveRepair(req.auth!.userId, String(req.params.id), repairSchema.parse(req.body), String(req.params.recordId)) }));
export const removeWarrantyController = asyncHandler(async (req, res) => { await removeRecord(req.auth!.userId, String(req.params.id), String(req.params.recordId), 'warranty'); res.status(204).send(); });
export const removeRepairController = asyncHandler(async (req, res) => { await removeRecord(req.auth!.userId, String(req.params.id), String(req.params.recordId), 'repair'); res.status(204).send(); });
export const itemActivityController = asyncHandler(async (req, res) => {
  const itemId = String(req.params.id); await assertItem(req.auth!.userId, itemId);
  res.json({ data: await prisma.activity.findMany({ where: { userId: req.auth!.userId, itemId }, orderBy: { createdAt: 'desc' }, take: 100,
    select: { id: true, action: true, description: true, createdAt: true } }) });
});
