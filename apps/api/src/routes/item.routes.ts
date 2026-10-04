import { Router } from 'express';
import { requireAuth, csrf } from '../middleware/auth.js';
import {
  dashboardController,
  listItems,
  getItem,
  createItemController,
  updateItemController,
  deleteItemController,
  sellItemController,
  warrantyController,
  repairController,
} from '../controllers/item.controller.js';
import {
  barcodeController,
  qrController,
  revokeQrController,
} from '../controllers/identifier.controller.js';
export const itemRouter = Router();
itemRouter.use(requireAuth);
itemRouter.get('/dashboard', dashboardController);
itemRouter.get('/', listItems);
itemRouter.post('/', csrf, createItemController);
itemRouter.get('/:id', getItem);
itemRouter.patch('/:id', csrf, updateItemController);
itemRouter.delete('/:id', csrf, deleteItemController);
itemRouter.post('/:id/sell', csrf, sellItemController);
itemRouter.post('/:id/warranties', csrf, warrantyController);
itemRouter.post('/:id/repairs', csrf, repairController);
itemRouter.get('/:id/qr', qrController);
itemRouter.delete('/:id/qr', csrf, revokeQrController);
itemRouter.get('/:id/barcode', barcodeController);
